/**
 * Job runner. Claims jobs from the DB queue, runs the generation pipeline, saves results.
 * Runs inside `npm run worker` (production) or in-process in development (JOB_RUNNER=inline).
 *
 * Lifecycle: queued → generating → (processing ↺ poll) → completed | failed (+ credit refund)
 *
 * Photo:  product photo (reference) [+ creator identity portrait] → image provider → Creative
 * Video:  script → keyframe image (creator wearing the product, via image provider, product photo
 *         as reference) → [voiceover] → image-to-video provider → poll → Creative
 */
import type { GenerationJob } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { getPreset, type PhotoPreset, type VideoPreset } from "@/lib/catalog";
import { imageProvider, scriptProvider, videoProvider, voiceProvider } from "@/server/ai/registry";
import type { CreatorContext, GeneratedFile, ProviderResult, VideoRequest } from "@/server/ai/types";
import { describeError, ProviderError } from "@/server/ai/errors";
import { isRaster, toProviderImage, type ImageBytes } from "@/server/ai/media";
import {
  buildCreatorPortraitPrompt, buildKeyframePrompt, buildPhotoPrompt, buildVideoPrompt, dialogueForClip, NEGATIVE_PROMPT,
} from "@/server/generation/prompts";
import { storage } from "@/server/storage";
import { refundJob } from "@/server/billing/credits";
import { toProductContext } from "./context";
import type { AnalyzeJobInput, CreativeJobInput, VideoJobState } from "./types";

const MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = Number(process.env.VIDEO_POLL_INTERVAL_MS ?? 8000);
const STALE_LOCK_MS = 15 * 60 * 1000;
const MAX_PROCESSING_MS = 30 * 60 * 1000;

const log = (job: { id: string; type: string }, msg: string, extra?: unknown) =>
  console.log(`[job ${job.id} ${job.type}] ${msg}`, extra === undefined ? "" : typeof extra === "string" ? extra : JSON.stringify(extra));

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
        ...(candidate.status === "queued" ? { status: "generating", startedAt: candidate.startedAt ?? now, progress: Math.max(candidate.progress, 5) } : {}),
      },
    });
    if (res.count === 1) return db.generationJob.findUnique({ where: { id: candidate.id } });
  }
  return null;
}

/** Release locks held by crashed workers. */
export async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS);
  const stale = await db.generationJob.findMany({ where: { lockedAt: { lt: cutoff }, status: { in: ["generating", "processing"] } } });
  for (const job of stale) await handleFailure(job, new ProviderError("worker", "timeout", "Worker lock expired (crash or hang)"));
}

/* ── Running ───────────────────────────────────────────────────── */

export async function runJob(job: GenerationJob) {
  try {
    if (job.type === "analyze_product") return await runAnalyze(job);
    if (job.type === "photo") return await runPhoto(job);
    if (job.type === "video") return await runVideo(job);
    throw new ProviderError("worker", "config", `Unknown job type ${job.type}`);
  } catch (err) {
    await handleFailure(job, err);
  }
}

async function handleFailure(job: GenerationJob, err: unknown) {
  const { userMessage, detail, retryable, code } = describeError(err);
  const attempts = job.attempts + 1;
  const willRetry = retryable && attempts < MAX_ATTEMPTS;
  console.error(`[job ${job.id} ${job.type}] attempt ${attempts}/${MAX_ATTEMPTS} failed (${code}, ${willRetry ? "will retry" : "final"}): ${detail}`);
  if (willRetry) {
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        attempts,
        lockedAt: null,
        errorCode: code,
        errorDetail: detail.slice(0, 4000),
        // retry from where we were: provider polling resumes polling, everything else restarts
        status: job.status === "processing" ? "processing" : "queued",
        runAfter: new Date(Date.now() + 3000 * 2 ** attempts),
      },
    });
    return;
  }
  await db.generationJob.update({
    where: { id: job.id },
    data: { status: "failed", attempts, lockedAt: null, error: userMessage, errorCode: code, errorDetail: detail.slice(0, 4000), completedAt: new Date() },
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
  if (!product) throw new ProviderError("worker", "invalid_request", "Product no longer exists");
  const image = await toProviderImage(await storage().read(product.imageUrl));
  const analysis = await scriptProvider().analyzeProduct(toProductContext(product), image);
  await db.product.update({ where: { id: productId }, data: { analysis: toJson(analysis), analysisStatus: "completed" } });
  await db.generationJob.update({
    where: { id: job.id },
    data: { status: "completed", progress: 100, lockedAt: null, completedAt: new Date(), output: toJson(analysis), provider: scriptProvider().name },
  });
}

/** Refresh product analysis if it finished after the job was queued (fidelity matters). */
async function freshInput(job: GenerationJob): Promise<CreativeJobInput> {
  const input = parseJson<CreativeJobInput | null>(job.input, null);
  if (!input) throw new ProviderError("worker", "invalid_request", "Job input is corrupt");
  if (!input.product.analysis) {
    const p = await db.product.findUnique({ where: { id: input.product.id } });
    if (p?.analysis) input.product = toProductContext(p);
  }
  return input;
}

/** The ORIGINAL product photo, normalized (raster, ≤1536px) — always the primary reference. */
async function productReference(input: CreativeJobInput): Promise<ImageBytes> {
  return toProviderImage(await storage().read(input.product.imageUrl));
}

/**
 * Identity anchor for a creator: a raster reference photo. Brand creators may have an uploaded
 * reference; for others we generate a neutral photoreal portrait ONCE (no product, no tenant data)
 * and reuse it as the face reference for every future generation → consistent identity.
 */
async function creatorReference(job: GenerationJob, creator: CreatorContext | null): Promise<ImageBytes | null> {
  if (!creator) return null;
  const images = imageProvider();
  const row = await db.creator.findUnique({ where: { id: creator.id } });
  const refs = parseJson<string[]>(row?.referenceImages, creator.referenceImages);
  for (const url of refs) {
    try {
      const img = await storage().read(url);
      if (isRaster(img.mimeType)) return toProviderImage(img, 1024);
    } catch {
      /* missing file — fall through */
    }
  }
  if (images.name === "mock") return null;
  try {
    log(job, `generating identity portrait for creator ${creator.name}`);
    const res = await images.generate({
      prompt: buildCreatorPortraitPrompt(creator),
      productImage: null,
      aspect: "4:5",
      quality: "standard",
      seed: creator.seed,
      meta: { title: creator.name, presetLabel: "portrait", product: null, creator, location: "studio", camera: "portrait" },
    });
    if (res.status !== "completed") return null;
    const file = res.files[0];
    const { url } = await storage().put({ folder: "creators/portraits", data: file.data, mimeType: file.mimeType });
    // Only the first writer wins; concurrent jobs keep whichever portrait was stored first.
    const latest = await db.creator.findUnique({ where: { id: creator.id } });
    const existing = parseJson<string[]>(latest?.referenceImages, []);
    if (existing.length === 0) {
      await db.creator.update({ where: { id: creator.id }, data: { referenceImages: toJson([url]), avatarUrl: url } });
      return toProviderImage(file, 1024);
    }
    return creatorReference(job, creator);
  } catch (err) {
    // Non-fatal: generate without the identity anchor rather than failing the user's job.
    log(job, "identity portrait failed, continuing without face reference", describeError(err).detail);
    return null;
  }
}

async function runPhoto(job: GenerationJob) {
  const input = await freshInput(job);
  const preset = getPreset(input.presetId) as PhotoPreset;
  const images = imageProvider();

  const concept = await scriptProvider().generatePhotoConcept({
    product: input.product,
    creator: input.creator,
    brand: input.brand,
    presetId: preset.id,
    styleTone: input.options.styleTone,
    variation: input.variation,
  });
  await setProgress(job.id, 15);

  const productImage = await productReference(input);
  const creatorRef = preset.needsCreator ? await creatorReference(job, input.creator) : null;
  await setProgress(job.id, 30);

  const prompt = buildPhotoPrompt({ preset, product: input.product, creator: input.creator, brand: input.brand, variation: input.variation, aspect: input.options.aspect, hasCreatorRef: !!creatorRef });
  log(job, `image request → ${images.name}`, { refs: 1 + (creatorRef ? 1 : 0), aspect: input.options.aspect, quality: input.options.quality });
  const started = Date.now();
  const result = await images.generate({
    prompt,
    negativePrompt: concept.negativePrompt || NEGATIVE_PROMPT,
    productImage,
    creatorReferences: creatorRef ? [creatorRef] : [],
    aspect: input.options.aspect,
    quality: input.options.quality,
    seed: input.variation.seed,
    meta: { title: concept.title, presetLabel: preset.label, product: input.product, creator: input.creator, location: input.variation.location, camera: input.variation.camera },
  });
  if (result.status !== "completed") throw new ProviderError(images.name, "config", "Image provider returned a pending result (async image providers need poll support)");
  log(job, `image received in ${Date.now() - started}ms`, { bytes: result.files[0].data.length, type: result.files[0].mimeType });

  await finalize(job, input, result.files[0], {
    kind: "photo",
    title: concept.title,
    provider: images.name,
    script: { caption: concept.caption, prompt, usedCreatorReference: !!creatorRef },
    tags: ["photo", ...(preset.needsCreator ? ["model"] : [])],
  });
}

function videoRequest(input: CreativeJobInput, preset: VideoPreset, state: VideoJobState, keyframe: ImageBytes, productImage: ImageBytes, voiceover: ImageBytes | null): VideoRequest {
  return {
    prompt: state.prompt ?? "",
    script: state.script ?? null,
    keyframe,
    productImage,
    voiceover,
    aspect: input.options.aspect === "4:5" ? "4:5" : "9:16",
    durationSec: input.options.durationSec,
    seed: input.variation.seed,
    meta: { title: state.script?.hook ?? preset.label, presetLabel: preset.label, product: input.product, creator: input.creator, location: input.variation.location },
  };
}

async function saveState(jobId: string, state: VideoJobState, extra: Record<string, unknown> = {}) {
  await db.generationJob.update({ where: { id: jobId }, data: { output: toJson(state), ...extra } });
}

async function runVideo(job: GenerationJob) {
  const input = await freshInput(job);
  const preset = getPreset(input.presetId) as VideoPreset;
  const videos = videoProvider();
  const images = imageProvider();
  const productImage = await productReference(input);
  let state = parseJson<VideoJobState>(job.output, {});

  let result: ProviderResult;
  if (job.status === "processing" && job.providerJobId) {
    // Phase 2: poll the provider
    if (job.startedAt && Date.now() - job.startedAt.getTime() > MAX_PROCESSING_MS) {
      throw new ProviderError(videos.name, "timeout", `Video still not ready after ${MAX_PROCESSING_MS / 60000} min`, { retryable: false });
    }
    const keyframe = state.keyframeUrl ? await toProviderImage(await storage().read(state.keyframeUrl)) : productImage;
    const voice = state.voiceUrl ? await storage().read(state.voiceUrl).catch(() => null) : null;
    result = await videos.poll(job.providerJobId, videoRequest(input, preset, state, keyframe, productImage, voice));
  } else {
    // Phase 1: script → keyframe → voice → submit. Each finished step is persisted so retries don't pay twice.
    if (!state.script) {
      state.script = await scriptProvider().generateUGCScript({
        product: input.product,
        creator: input.creator,
        brand: input.brand,
        presetId: preset.id,
        styleTone: input.options.styleTone,
        platform: input.options.platform,
        durationSec: input.options.durationSec,
        variation: input.variation,
      });
      await saveState(job.id, state, { progress: 15 });
    }
    const script = state.script;

    if (!state.keyframeUrl) {
      if (images.name === "mock") {
        state.keyframeUrl = input.product.imageUrl;
      } else {
        const creatorRef = preset.needsCreator ? await creatorReference(job, input.creator) : null;
        const kfPrompt = buildKeyframePrompt({ preset, product: input.product, creator: input.creator, brand: input.brand, variation: input.variation, firstScene: script.scenes[0], hasCreatorRef: !!creatorRef });
        log(job, `keyframe request → ${images.name}`);
        const kf = await images.generate({
          prompt: kfPrompt,
          productImage,
          creatorReferences: creatorRef ? [creatorRef] : [],
          aspect: "9:16",
          quality: "standard",
          seed: input.variation.seed,
          meta: { title: "keyframe", presetLabel: preset.label, product: input.product, creator: input.creator, location: input.variation.location, camera: script.scenes[0]?.shot ?? "" },
        });
        if (kf.status !== "completed") throw new ProviderError(images.name, "config", "Keyframe generation returned pending");
        state.keyframeUrl = (await storage().put({ folder: `ws/${job.workspaceId}/keyframes`, data: kf.files[0].data, mimeType: kf.files[0].mimeType })).url;
      }
      await saveState(job.id, state, { progress: 35 });
    }

    // Voiceover only when the video model can't speak itself.
    let voice: ImageBytes | null = null;
    if (preset.talking && !videos.nativeAudio && script.script && state.voiceUrl === undefined) {
      voice = await voiceProvider().synthesize({ text: script.script, voiceId: input.creator?.voiceId, style: input.options.styleTone });
      state.voiceUrl = voice ? (await storage().put({ folder: `ws/${job.workspaceId}/audio`, data: voice.data, mimeType: voice.mimeType })).url : null;
      await saveState(job.id, state);
    }

    const dialogue = preset.talking && videos.nativeAudio ? dialogueForClip(script.scenes, script.hook, input.options.durationSec) : null;
    state.prompt = buildVideoPrompt({ preset, product: input.product, creator: input.creator, brand: input.brand, variation: input.variation, scenes: script.scenes, dialogue, clipSeconds: input.options.durationSec });
    state.dialogue = dialogue;
    await saveState(job.id, state, { progress: 40 });

    const keyframe = await toProviderImage(await storage().read(state.keyframeUrl!));
    log(job, `video submit → ${videos.name}`, { seconds: input.options.durationSec, dialogue: !!dialogue });
    result = await videos.submit(videoRequest(input, preset, state, keyframe, productImage, voice));
  }

  if (result.status === "pending") {
    await db.generationJob.update({
      where: { id: job.id },
      data: {
        status: "processing",
        providerJobId: result.providerJobId,
        provider: videos.name,
        output: toJson(state),
        progress: Math.min(95, Math.max(job.progress + 3, result.progress ?? 50)),
        lockedAt: null,
        runAfter: new Date(Date.now() + POLL_INTERVAL_MS),
      },
    });
    return;
  }

  log(job, "video completed", { bytes: result.files[0].data.length });
  await finalize(job, input, result.files[0], {
    kind: "video",
    title: state.script?.hook ?? preset.label,
    provider: videos.name,
    script: { ...state.script, platform: input.options.platform, voiceUrl: state.voiceUrl ?? null, dialogue: state.dialogue ?? null, keyframeUrl: state.keyframeUrl },
    tags: preset.tags,
    thumbnailUrl: state.keyframeUrl,
  });
}

async function finalize(
  job: GenerationJob,
  input: CreativeJobInput,
  file: GeneratedFile,
  meta: { kind: "photo" | "video"; title: string; provider: string; script: unknown; tags: string[]; thumbnailUrl?: string },
) {
  if (!file?.data?.length) throw new ProviderError(meta.provider, "bad_output", "Provider returned an empty file");
  const stored = await storage().put({ folder: `ws/${job.workspaceId}/creatives`, data: file.data, mimeType: file.mimeType });
  const thumbnailUrl = file.mimeType.startsWith("image/") ? stored.url : (meta.thumbnailUrl ?? input.product.imageUrl);

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
