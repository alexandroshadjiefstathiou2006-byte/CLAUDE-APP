/**
 * Job runner. Claims jobs from the DB queue, runs the generation pipeline, saves results.
 * Runs inside `npm run worker` (production) or in-process in development (JOB_RUNNER=inline).
 *
 * Lifecycle: queued → generating → (processing ↺ poll) → completed | failed (+ credit refund)
 */
import type { GenerationJob } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { getPreset, type PhotoPreset, type VideoPreset } from "@/lib/catalog";
import { imageProvider, scriptProvider, videoProvider, voiceProvider } from "@/server/ai/registry";
import type { GeneratedFile, ProviderResult, VideoRequest } from "@/server/ai/types";
import { buildPhotoPrompt, buildVideoPrompt, NEGATIVE_PROMPT } from "@/server/generation/prompts";
import { storage } from "@/server/storage";
import { refundJob } from "@/server/billing/credits";
import { toProductContext } from "./context";
import type { AnalyzeJobInput, CreativeJobInput, VideoJobState } from "./types";

const MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 4000;
const STALE_LOCK_MS = 15 * 60 * 1000;

/* ── Claiming ──────────────────────────────────────────────────── */

/** Atomically claim one runnable job. Works on SQLite and Postgres (conditional update). */
export async function claimNextJob(): Promise<GenerationJob | null> {
  for (let tries = 0; tries < 5; tries++) {
    const candidate = await db.generationJob.findFirst({
      where: { status: { in: ["queued", "processing"] }, lockedAt: null, runAfter: { lte: new Date() } },
      orderBy: [{ runAfter: "asc" }],
    });
    if (!candidate) return null;
    const now = new Date();
    const res = await db.generationJob.updateMany({
      where: { id: candidate.id, lockedAt: null, status: candidate.status },
      data: {
        lockedAt: now,
        ...(candidate.status === "queued" ? { status: "generating", startedAt: now, progress: 5 } : {}),
      },
    });
    if (res.count === 1) return db.generationJob.findUnique({ where: { id: candidate.id } });
    // someone else claimed it — try the next one
  }
  return null;
}

/** Release locks held by crashed workers. */
export async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS);
  const stale = await db.generationJob.findMany({ where: { lockedAt: { lt: cutoff }, status: { in: ["generating", "processing"] } } });
  for (const job of stale) await handleFailure(job, new Error("Worker timed out"));
}

/* ── Running ───────────────────────────────────────────────────── */

export async function runJob(job: GenerationJob) {
  try {
    if (job.type === "analyze_product") return await runAnalyze(job);
    if (job.type === "photo") return await runPhoto(job);
    if (job.type === "video") return await runVideo(job);
    throw new Error(`Unknown job type ${job.type}`);
  } catch (err) {
    await handleFailure(job, err);
  }
}

async function handleFailure(job: GenerationJob, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const attempts = job.attempts + 1;
  console.error(`[job ${job.id}] attempt ${attempts} failed: ${message}`);
  if (attempts < MAX_ATTEMPTS) {
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        attempts,
        lockedAt: null,
        error: message,
        // retry from scratch unless we were only polling a provider
        status: job.status === "processing" ? "processing" : "queued",
        runAfter: new Date(Date.now() + 2000 * 2 ** attempts),
      },
    });
    return;
  }
  await db.generationJob.update({
    where: { id: job.id },
    data: { status: "failed", attempts, lockedAt: null, error: message, completedAt: new Date() },
  });
  if (job.type === "analyze_product") {
    const input = parseJson<AnalyzeJobInput | null>(job.input, null);
    if (input) await db.product.update({ where: { id: input.productId }, data: { analysisStatus: "failed" } }).catch(() => {});
  }
  await refundJob(job.id);
}

const setProgress = (id: string, progress: number) => db.generationJob.update({ where: { id }, data: { progress } });

async function runAnalyze(job: GenerationJob) {
  const { productId } = parseJson<AnalyzeJobInput>(job.input, { productId: "" });
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product no longer exists");
  const image = await storage().read(product.imageUrl);
  const analysis = await scriptProvider().analyzeProduct(toProductContext(product), image);
  await db.product.update({ where: { id: productId }, data: { analysis: toJson(analysis), analysisStatus: "completed" } });
  await db.generationJob.update({
    where: { id: job.id },
    data: { status: "completed", progress: 100, lockedAt: null, completedAt: new Date(), output: toJson(analysis), provider: scriptProvider().name },
  });
}

/** Refresh product analysis if it finished after the job was queued (fidelity matters). */
async function freshInput(job: GenerationJob) {
  const input = parseJson<CreativeJobInput>(job.input, null as unknown as CreativeJobInput);
  if (!input.product.analysis) {
    const p = await db.product.findUnique({ where: { id: input.product.id } });
    if (p?.analysis) input.product = toProductContext(p);
  }
  return input;
}

async function runPhoto(job: GenerationJob) {
  const input = await freshInput(job);
  const preset = getPreset(input.presetId) as PhotoPreset;
  const scripts = scriptProvider();

  const concept = await scripts.generatePhotoConcept({
    product: input.product,
    creator: input.creator,
    brand: input.brand,
    presetId: preset.id,
    styleTone: input.options.styleTone,
    variation: input.variation,
  });
  await setProgress(job.id, 25);

  const prompt = buildPhotoPrompt({ preset, product: input.product, creator: input.creator, brand: input.brand, variation: input.variation, aspect: input.options.aspect });
  const productImage = await storage().read(input.product.imageUrl);
  const creatorReferences = input.creator
    ? await Promise.all([input.creator.avatarUrl, ...input.creator.referenceImages].slice(0, 3).map((u) => storage().read(u).catch(() => null)))
    : [];

  const images = imageProvider();
  const result = await images.generate({
    prompt,
    negativePrompt: concept.negativePrompt || NEGATIVE_PROMPT,
    productImage,
    creatorReferences: creatorReferences.filter((x): x is NonNullable<typeof x> => !!x),
    aspect: input.options.aspect,
    quality: input.options.quality,
    seed: input.variation.seed,
    meta: { title: concept.title, presetLabel: preset.label, product: input.product, creator: input.creator, location: input.variation.location, camera: input.variation.camera },
  });
  if (result.status !== "completed") throw new Error("Image provider returned a pending result; async image providers need poll support");

  await finalize(job, input, result.files[0], {
    kind: "photo",
    title: concept.title,
    provider: images.name,
    script: { caption: concept.caption, prompt },
    tags: ["photo", ...(preset.needsCreator ? ["model"] : [])],
  });
}

function videoRequest(input: CreativeJobInput, preset: VideoPreset, state: VideoJobState, productImage: { data: Buffer; mimeType: string }, voiceover: { data: Buffer; mimeType: string } | null): VideoRequest {
  return {
    prompt: state.prompt ?? "",
    script: state.script ?? null,
    productImage,
    voiceover,
    aspect: input.options.aspect === "1:1" ? "1:1" : input.options.aspect,
    durationSec: input.options.durationSec,
    seed: input.variation.seed,
    meta: { title: state.script?.hook ?? preset.label, presetLabel: preset.label, product: input.product, creator: input.creator, location: input.variation.location },
  };
}

async function runVideo(job: GenerationJob) {
  const input = await freshInput(job);
  const preset = getPreset(input.presetId) as VideoPreset;
  const videos = videoProvider();
  const productImage = await storage().read(input.product.imageUrl);
  let state = parseJson<VideoJobState>(job.output, {});

  let result: ProviderResult;
  if (job.status === "processing" && job.providerJobId) {
    // Phase 2: poll the provider
    const voice = state.voiceUrl ? await storage().read(state.voiceUrl).catch(() => null) : null;
    result = await videos.poll(job.providerJobId, videoRequest(input, preset, state, productImage, voice));
  } else {
    // Phase 1: script → voice → submit
    const script = await scriptProvider().generateUGCScript({
      product: input.product,
      creator: input.creator,
      brand: input.brand,
      presetId: preset.id,
      styleTone: input.options.styleTone,
      platform: input.options.platform,
      durationSec: input.options.durationSec,
      variation: input.variation,
    });
    await setProgress(job.id, 20);

    let voice: { data: Buffer; mimeType: string } | null = null;
    let voiceUrl: string | null = null;
    if (preset.talking && script.script) {
      voice = await voiceProvider().synthesize({ text: script.script, voiceId: input.creator?.voiceId, style: input.options.styleTone });
      if (voice) voiceUrl = (await storage().put({ folder: `ws/${job.workspaceId}/audio`, data: voice.data, mimeType: voice.mimeType })).url;
    }
    const scenesSummary = script.scenes.map((s) => `${s.order}. ${s.action} (${s.shot}, ${s.durationSec}s)`).join("; ");
    const prompt = buildVideoPrompt({ preset, product: input.product, creator: input.creator, brand: input.brand, variation: input.variation, scenesSummary });
    state = { script, prompt, voiceUrl };
    await setProgress(job.id, 35);
    result = await videos.submit(videoRequest(input, preset, state, productImage, voice));
  }

  if (result.status === "pending") {
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        status: "processing",
        providerJobId: result.providerJobId,
        provider: videos.name,
        output: toJson(state),
        progress: Math.max(job.progress, result.progress ?? 50),
        lockedAt: null,
        runAfter: new Date(Date.now() + POLL_INTERVAL_MS),
      },
    });
    return;
  }

  await finalize(job, input, result.files[0], {
    kind: "video",
    title: state.script?.hook ?? preset.label,
    provider: videos.name,
    script: { ...state.script, platform: input.options.platform, voiceUrl: state.voiceUrl },
    tags: preset.tags,
  });
}

async function finalize(
  job: GenerationJob,
  input: CreativeJobInput,
  file: GeneratedFile,
  meta: { kind: "photo" | "video"; title: string; provider: string; script: unknown; tags: string[] },
) {
  const stored = await storage().put({ folder: `ws/${job.workspaceId}/creatives`, data: file.data, mimeType: file.mimeType });
  const thumbnailUrl = file.mimeType.startsWith("image/") ? stored.url : input.product.imageUrl;

  await db.$transaction([
    db.creative.create({
      data: {
        workspaceId: job.workspaceId,
        jobId: job.id,
        productId: input.product.id,
        creatorId: input.creator?.id ?? null,
        kind: meta.kind,
        preset: input.presetId,
        title: meta.title.slice(0, 140),
        mediaUrl: stored.url,
        thumbnailUrl,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
        durationSec: file.durationSec ?? (meta.kind === "video" ? input.options.durationSec : null),
        script: toJson(meta.script),
        tags: toJson(meta.tags),
        batchId: job.batchId,
      },
    }),
    db.generationJob.update({
      where: { id: job.id },
      data: { status: "completed", progress: 100, lockedAt: null, completedAt: new Date(), provider: meta.provider, error: null },
    }),
  ]);
}

/* ── Loop ──────────────────────────────────────────────────────── */

/** Process jobs until the queue is empty or `maxJobs` reached. Returns how many ran. */
export async function drainQueue(opts: { concurrency?: number; maxJobs?: number } = {}) {
  const concurrency = opts.concurrency ?? 4;
  const maxJobs = opts.maxJobs ?? 100;
  let ran = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (ran < maxJobs) {
      const job = await claimNextJob();
      if (!job) return;
      ran++;
      await runJob(job);
    }
  });
  await Promise.all(workers);
  return ran;
}
