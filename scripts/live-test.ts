/**
 * LIVE end-to-end test of the real generation pipeline.
 *
 *   npx tsx scripts/live-test.ts                 # full run (photos + video + failure tests)
 *   npx tsx scripts/live-test.ts --skip-video    # images only
 *   npx tsx scripts/live-test.ts --product path/to/garment.jpg --creator Sofia
 *   npx tsx scripts/live-test.ts --only-failures # auth failure / retry / exhaustion tests
 *
 * Uses whatever providers .env configures (IMAGE_PROVIDER, VIDEO_PROVIDER, ...). With "mock"
 * providers it still validates the job system, but the report clearly marks it as NOT a real test.
 *
 * Everything goes through the real job queue: credits debit → worker → provider → storage →
 * Creative row → (refund on failure). Outputs + a Markdown report are written to test-output/<ts>/.
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { execFileSync } from "child_process";
import bcrypt from "bcryptjs";

process.env.JOB_RUNNER = "external"; // this script drives the worker itself

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const GARMENTS = {
  polo: "https://raw.githubusercontent.com/yisol/IDM-VTON/main/gradio_demo/example/cloth/09163_00.jpg",
  leopard: "https://raw.githubusercontent.com/yisol/IDM-VTON/main/gradio_demo/example/cloth/09256_00.jpg",
};

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const { db } = await import("@/lib/db");
  const { applyCredits } = await import("@/server/billing/credits");
  const { storage, localStorageRoot } = await import("@/server/storage");
  const { createGenerationJobs, GenerationRequestSchema, enqueueProductAnalysis } = await import("@/server/jobs/enqueue");
  const { drainQueue } = await import("@/server/jobs/runner");
  const { imageProvider, videoProvider, scriptProvider, voiceProvider, providerSummary, testFaults } = await import("@/server/ai/registry");
  const { generationCost } = await import("@/lib/catalog");

  const providers = providerSummary();
  const real = { image: providers.image !== "mock", video: providers.video !== "mock", script: providers.script !== "mock" };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join("test-output", stamp);
  await fs.mkdir(outDir, { recursive: true });
  console.log(`\n=== Live generation test ${stamp} ===`);
  console.log("Providers:", providers);
  if (!real.image && !real.video) console.log("⚠️  All media providers are MOCK — this validates the pipeline, NOT real AI output.\n");

  /* ── Preflight: keys + network ─────────────────────────────── */
  const hosts: Record<string, { env: string[]; url: string }> = {
    openai: { env: ["OPENAI_API_KEY"], url: "https://api.openai.com/v1/models" },
    google: { env: ["GEMINI_API_KEY"], url: "https://generativelanguage.googleapis.com/v1beta/models" },
    fal: { env: ["FAL_KEY"], url: "https://queue.fal.run/" },
    elevenlabs: { env: ["ELEVENLABS_API_KEY"], url: "https://api.elevenlabs.io/v1/models" },
    anthropic: { env: ["ANTHROPIC_API_KEY"], url: "https://api.anthropic.com/v1/models" },
  };
  const used = new Set([providers.image, providers.video, providers.script, providers.voice].filter((p) => p !== "mock"));
  for (const p of used) {
    const h = hosts[p];
    if (!h) continue;
    const keyOk = h.env.every((e) => !!process.env[e]);
    let net = "unreachable";
    try {
      const r = await fetch(h.url, { signal: AbortSignal.timeout(8000) });
      net = `HTTP ${r.status}`;
    } catch (e) {
      net = `unreachable (${(e as Error).message})`;
    }
    check(`preflight ${p}: key present (${h.env.join(", ")})`, keyOk);
    check(`preflight ${p}: network ${new URL(h.url).host}`, !net.startsWith("unreachable"), net);
  }

  /* ── Isolated test workspace ───────────────────────────────── */
  const email = `live-test-${stamp}@studio.dev`;
  const user = await db.user.create({ data: { email, name: "Live Test", passwordHash: await bcrypt.hash("live-test", 4) } });
  const ws = await db.workspace.create({ data: { name: `Live Test ${stamp}` } });
  await db.membership.create({ data: { userId: user.id, workspaceId: ws.id } });
  await db.$transaction((tx) => applyCredits(tx, { workspaceId: ws.id, delta: 300, reason: "manual" }));
  const balance = async () => (await db.workspace.findUniqueOrThrow({ where: { id: ws.id } })).creditBalance;

  async function waitFor(jobIds: string[], timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await drainQueue({ concurrency: 3 });
      const jobs = await db.generationJob.findMany({ where: { id: { in: jobIds } } });
      if (jobs.every((j) => j.status === "completed" || j.status === "failed")) return jobs;
      const statuses = jobs.map((j) => `${j.status}${j.progress ? ` ${j.progress}%` : ""}`).join(", ");
      process.stdout.write(`   … ${Math.round((Date.now() - start) / 1000)}s [${statuses}]\r`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    return db.generationJob.findMany({ where: { id: { in: jobIds } } });
  }

  /* ── Product ───────────────────────────────────────────────── */
  let productPath = opt("product", "");
  if (!productPath) {
    productPath = "test-assets/09163_00.jpg";
    await fs.mkdir("test-assets", { recursive: true });
    for (const [name, url] of Object.entries(GARMENTS)) {
      const file = `test-assets/${path.basename(url)}`;
      try {
        await fs.access(file);
      } catch {
        const r = await fetch(url);
        if (r.ok) await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
        else console.log(`could not download ${name}: ${r.status}`);
      }
    }
  }
  const bytes = await fs.readFile(productPath);
  const { url: imageUrl } = await storage().put({ folder: `ws/${ws.id}/uploads`, data: bytes, mimeType: productPath.endsWith(".png") ? "image/png" : "image/jpeg" });
  const product = await db.product.create({
    data: {
      workspaceId: ws.id,
      name: opt("name", "Color-Block Polo Shirt"),
      description: opt("desc", "Fitted short-sleeve polo shirt. Light sky-blue collar, shoulders and upper chest; navy body and navy sleeves with light-blue cuffs; three-button placket; small black brand label at the neck."),
      imageUrl,
    },
  });
  await fs.copyFile(productPath, path.join(outDir, `00-product${path.extname(productPath)}`));
  await enqueueProductAnalysis(ws.id, product.id);
  const [analysisJob] = await waitFor((await db.generationJob.findMany({ where: { workspaceId: ws.id, type: "analyze_product" } })).map((j) => j.id), 180_000);
  const analyzed = await db.product.findUniqueOrThrow({ where: { id: product.id } });
  check(`product analysis via ${scriptProvider().name}`, analysisJob.status === "completed", analysisJob.status === "completed" ? (analyzed.analysis ?? "").slice(0, 220) : `${analysisJob.errorCode}: ${analysisJob.errorDetail?.slice(0, 300)}`);
  await fs.writeFile(path.join(outDir, "product-analysis.json"), analyzed.analysis ?? "null");

  const creatorName = opt("creator", "Sofia");
  const creator = (await db.creator.findFirst({ where: { workspaceId: null, name: creatorName } })) ?? (await db.creator.findFirstOrThrow({ where: { workspaceId: null } }));

  const results: { label: string; jobId: string; status: string; provider: string | null; ms: number; file?: string; error?: string; credits: number }[] = [];

  async function verifyCreativeJob(label: string, jobId: string, expectKind: "photo" | "video", startedAt: number) {
    const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId }, include: { creative: true } });
    const entry = { label, jobId, status: job.status, provider: job.provider, ms: Date.now() - startedAt, credits: job.creditsCost } as (typeof results)[number];
    if (job.status !== "completed" || !job.creative) {
      entry.error = `${job.errorCode}: ${job.error} | ${job.errorDetail?.slice(0, 400)}`;
      check(`${label} completed`, false, entry.error);
      results.push(entry);
      return;
    }
    const c = job.creative;
    const filePath = path.join(localStorageRoot, c.mediaUrl.replace("/api/files/", ""));
    const stat = await fs.stat(filePath).catch(() => null);
    check(`${label} completed via ${job.provider}`, true, `${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    check(`${label} stored file`, !!stat && stat.size > 1000, `${c.mimeType}, ${stat?.size ?? 0} bytes, ${c.width}x${c.height}`);
    check(`${label} kind/mime`, c.kind === expectKind && (expectKind === "video" ? c.mimeType.startsWith("video/") || !real.video : c.mimeType.startsWith("image/")), c.mimeType);
    if (c.mimeType === "video/mp4" && stat) {
      try {
        const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", filePath]).toString();
        const p = JSON.parse(probe);
        const streams = (p.streams as { codec_type: string; width?: number; height?: number }[]).map((s) => s.codec_type + (s.width ? ` ${s.width}x${s.height}` : "")).join(", ");
        check(`${label} playable mp4`, Number(p.format.duration) > 1, `duration ${Number(p.format.duration).toFixed(1)}s, streams: ${streams}`);
        execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", filePath, "-frames:v", "1", path.join(outDir, `${label}-frame1s.png`)]);
      } catch (e) {
        check(`${label} playable mp4`, false, (e as Error).message);
      }
    }
    const ext = c.mimeType.split("/")[1].replace("svg+xml", "svg").replace("jpeg", "jpg");
    const out = path.join(outDir, `${label}.${ext}`);
    await fs.copyFile(filePath, out);
    entry.file = out;
    // download through the HTTP route if the app is running
    const app = process.env.APP_URL ?? "http://localhost:3000";
    try {
      const r = await fetch(`${app}${c.mediaUrl}?download=${label}.${ext}`, { signal: AbortSignal.timeout(5000) });
      const dl = Buffer.from(await r.arrayBuffer());
      check(`${label} downloadable via ${app}`, r.ok && dl.length === stat!.size && /attachment/.test(r.headers.get("content-disposition") ?? ""), `${r.status}, ${dl.length} bytes`);
    } catch {
      console.log(`   (skipped HTTP download check — app not running at ${app})`);
    }
    results.push(entry);
  }

  /* ── Phase 1: 3 model photos with one creator ──────────────── */
  if (!flag("only-failures")) {
    const before = await balance();
    const t0 = Date.now();
    const req = GenerationRequestSchema.parse({ productId: product.id, presetId: opt("photo-preset", "model"), creatorIds: [creator.id], count: 3, quality: "standard", aspect: "4:5" });
    const { jobIds, creditsUsed } = await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: req });
    const expected = generationCost({ kind: "photo", quality: "standard", count: 3 });
    check("photo credits debited at enqueue", (await balance()) === before - expected && creditsUsed === expected, `${before} → ${await balance()} (expected -${expected})`);
    await waitFor(jobIds, 15 * 60_000);
    console.log();
    for (const [i, id] of jobIds.entries()) await verifyCreativeJob(`photo-${i + 1}`, id, "photo", t0);
    const failed = (await db.generationJob.findMany({ where: { id: { in: jobIds }, status: "failed" } })).length;
    check("photo credits final balance", (await balance()) === before - expected + failed * (expected / 3), `balance ${await balance()}, failed jobs refunded: ${failed}`);
    const ref = await db.creator.findUniqueOrThrow({ where: { id: creator.id } });
    check("creator identity portrait stored (consistency anchor)", !real.image || ref.referenceImages !== "[]", ref.referenceImages);
    if (ref.avatarUrl.startsWith("/api/files/") && !ref.avatarUrl.endsWith(".svg")) {
      await fs.copyFile(path.join(localStorageRoot, ref.avatarUrl.replace("/api/files/", "")), path.join(outDir, "creator-identity-portrait.png"));
    }
  }

  /* ── Phase 2: 1 UGC video ─────────────────────────────────── */
  if (!flag("skip-video") && !flag("only-failures")) {
    const dur = videoProvider().durationOptions[0];
    const before = await balance();
    const t0 = Date.now();
    const { jobIds } = await createGenerationJobs({
      workspaceId: ws.id,
      userId: user.id,
      request: GenerationRequestSchema.parse({ productId: product.id, presetId: "ugc_ad", creatorIds: [creator.id], count: 1, durationSec: dur, platform: "tiktok", styleId: "authentic" }),
    });
    check("video credits debited", (await balance()) === before - generationCost({ kind: "video", durationSec: dur, count: 1 }), `${before} → ${await balance()}`);
    // watch the status transitions
    const seen = new Set<string>();
    const start = Date.now();
    while (Date.now() - start < 30 * 60_000) {
      await drainQueue({ concurrency: 1 });
      const j = await db.generationJob.findUniqueOrThrow({ where: { id: jobIds[0] } });
      seen.add(j.status);
      if (j.status === "completed" || j.status === "failed") break;
      process.stdout.write(`   … video ${Math.round((Date.now() - start) / 1000)}s ${j.status} ${j.progress}%\r`);
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log();
    check("video went through async processing state", seen.has("processing") || !real.video, [...seen].join(" → "));
    await verifyCreativeJob("ugc-video", jobIds[0], "video", t0);
    const j = await db.generationJob.findUniqueOrThrow({ where: { id: jobIds[0] } });
    const state = JSON.parse(j.output ?? "{}");
    if (state.keyframeUrl?.startsWith("/api/files/ws/")) await fs.copyFile(path.join(localStorageRoot, state.keyframeUrl.replace("/api/files/", "")), path.join(outDir, "ugc-video-keyframe.png"));
    await fs.writeFile(path.join(outDir, "ugc-video-script.json"), JSON.stringify({ hook: state.script?.hook, dialogue: state.dialogue, prompt: state.prompt, scenes: state.script?.scenes }, null, 2));
  }

  /* ── Phase 3: failure handling ─────────────────────────────── */
  if (!flag("skip-failures")) {
    // a) auth failure: bad key → fail fast (no retries) → refund
    if (real.image) {
      const keyVar = providers.image === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
      const saved = process.env[keyVar];
      process.env[keyVar] = "invalid-key-live-test";
      const before = await balance();
      const { jobIds } = await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "studio", count: 1 }) });
      const [j] = await waitFor(jobIds, 120_000);
      process.env[keyVar] = saved;
      check("auth failure → failed without retries", j.status === "failed" && j.attempts === 1 && j.errorCode === "auth", `status=${j.status} attempts=${j.attempts} code=${j.errorCode}`);
      check("auth failure → user-facing message (no key leaked)", !!j.error && !j.error.includes("invalid-key-live-test"), j.error ?? "");
      check("auth failure → credits refunded", (await balance()) === before, `${before} → ${await balance()}`);
      console.log(`   real provider error detail: ${j.errorDetail?.slice(0, 300)}`);
    }
    // b) transient failures → retried → succeeds, charged once
    {
      const before = await balance();
      testFaults.imageFailures = 2;
      const { jobIds } = await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "studio", count: 1 }) });
      const [j] = await waitFor(jobIds, 10 * 60_000);
      check("transient failures retried then succeeded", j.status === "completed" && j.attempts === 2, `status=${j.status} attempts(failed tries)=${j.attempts}`);
      check("retried job charged exactly once", (await balance()) === before - j.creditsCost, `${before} → ${await balance()}`);
      if (j.status === "completed") {
        const c = await db.creative.findUniqueOrThrow({ where: { jobId: j.id } });
        await fs.copyFile(path.join(localStorageRoot, c.mediaUrl.replace("/api/files/", "")), path.join(outDir, `studio-photo.${c.mimeType.split("/")[1].replace("svg+xml", "svg")}`));
      }
    }
    // c) retries exhausted → failed + refund
    {
      const before = await balance();
      testFaults.imageFailures = 3;
      const { jobIds } = await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "studio", count: 1 }) });
      const [j] = await waitFor(jobIds, 10 * 60_000);
      testFaults.imageFailures = 0;
      check("retries exhausted → failed after 3 attempts", j.status === "failed" && j.attempts === 3, `status=${j.status} attempts=${j.attempts} error="${j.error}"`);
      check("retries exhausted → credits refunded", (await balance()) === before, `${before} → ${await balance()}`);
    }
  }

  /* ── Ledger + report ───────────────────────────────────────── */
  const ledger = await db.creditLedger.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "asc" } });
  const sum = ledger.reduce((s, l) => s + l.delta, 0);
  check("ledger sum equals cached balance", sum === (await balance()), `ledger ${sum} vs balance ${await balance()}`);

  const img = imageProvider();
  const vid = videoProvider();
  const report = [
    `# Live generation test — ${stamp}`,
    "",
    `Providers: image=**${providers.image}**, video=**${providers.video}**, script=**${providers.script}**, voice=**${providers.voice}**`,
    !real.image && !real.video ? "\n> ⚠️ Media providers were MOCK — this run validates the pipeline only, not AI output quality.\n" : "",
    `Product: \`${productPath}\` · Creator: ${creator.name} · Voice provider: ${voiceProvider().name}`,
    "",
    "## Checks",
    "",
    "| | Check | Detail |",
    "|---|---|---|",
    ...checks.map((c) => `| ${c.ok ? "✅" : "❌"} | ${c.name} | ${c.detail.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 300)} |`),
    "",
    "## Generations",
    "",
    "| Label | Status | Provider | Time | Credits | File / error |",
    "|---|---|---|---|---|---|",
    ...results.map((r) => `| ${r.label} | ${r.status} | ${r.provider ?? "-"} | ${(r.ms / 1000).toFixed(0)}s | ${r.credits} | ${r.file ? path.basename(r.file) : (r.error ?? "").replace(/\|/g, "\\|").slice(0, 200)} |`),
    "",
    "## Estimated provider cost (USD)",
    "",
    `- Image (${img.name}): ~$${img.estimatedCostUsd.standard.toFixed(3)} standard / $${img.estimatedCostUsd.high.toFixed(3)} high per image`,
    `- Video (${vid.name}): ~$${vid.estimatedCostUsdPerSecond.toFixed(3)}/s → ${vid.durationOptions[0]}s clip ≈ $${(vid.estimatedCostUsdPerSecond * vid.durationOptions[0]).toFixed(2)} (+1 keyframe image)`,
    "",
  ].join("\n");
  await fs.writeFile(path.join(outDir, "REPORT.md"), report);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed. Outputs + REPORT.md in ${outDir}`);
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
