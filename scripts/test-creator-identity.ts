/**
 * End-to-end test of the Creator Identity Generator through the real job queue.
 *   npx tsx scripts/test-creator-identity.ts            # mock portraits (no API calls)
 *   npx tsx scripts/test-creator-identity.ts --stub     # capturing stub provider: verifies the exact
 *                                                       # identity refs + product image + prompt a real
 *                                                       # provider receives (no paid API calls)
 */
import "dotenv/config";
process.env.JOB_RUNNER = "external";

async function main() {
  const stub = process.argv.includes("--stub");
  const { db } = await import("@/lib/db");
  const bcrypt = (await import("bcryptjs")).default;
  const sharp = (await import("sharp")).default;
  const { applyCredits } = await import("@/server/billing/credits");
  const { createDraftCreator, generateCandidates, selectMaster, creatorIdentityState, CreatorAttributes, CreatorError } = await import("@/server/creators/service");
  const { createGenerationJobs, GenerationRequestSchema } = await import("@/server/jobs/enqueue");
  const { drainQueue } = await import("@/server/jobs/runner");
  const { testOverrides } = await import("@/server/ai/registry");
  const { storage } = await import("@/server/storage");
  type Req = import("@/server/ai/types").ImageRequest;

  const calls: Req[] = [];
  if (stub) {
    // A stand-in for a real image API: returns a real PNG and records every request.
    testOverrides.image = {
      name: "stub",
      estimatedCostUsd: { standard: 0, high: 0 },
      async generate(req) {
        calls.push(req);
        const png = await sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 120 + calls.length * 10, g: 110, b: 140 } } }).png().toBuffer();
        return { status: "completed", files: [{ data: png, mimeType: "image/png", width: 400, height: 500 }] };
      },
    };
  }

  let failures = 0;
  const check = (name: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const drain = async () => {
    for (let i = 0; i < 20; i++) {
      await drainQueue({ concurrency: 4 });
      if ((await db.generationJob.count({ where: { status: { in: ["queued", "generating", "processing"] } } })) === 0) return;
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const stamp = Date.now();
  const user = await db.user.create({ data: { email: `identity-${stamp}@studio.dev`, name: "Identity Test", passwordHash: await bcrypt.hash("x", 4) } });
  const ws = await db.workspace.create({ data: { name: "Identity Test" } });
  await db.membership.create({ data: { userId: user.id, workspaceId: ws.id } });
  await db.$transaction((tx) => applyCredits(tx, { workspaceId: ws.id, delta: 50, reason: "manual" }));
  const balance = async () => (await db.workspace.findUniqueOrThrow({ where: { id: ws.id } })).creditBalance;

  // fictional-only guard
  try {
    await createDraftCreator(ws.id, CreatorAttributes.parse({ name: "X", age: 30, gender: "female", appearance: "looks like a famous pop star", hair: "blonde", bodyType: "slim", style: "luxury" }));
    check("lookalike description rejected", false);
  } catch (e) {
    check("lookalike description rejected", e instanceof CreatorError && e.status === 400, (e as Error).message);
  }

  // 1. draft
  const creator = await createDraftCreator(
    ws.id,
    CreatorAttributes.parse({ name: "Ava", age: 26, gender: "female", appearance: "olive skin, light freckles, warm smile", hair: "long wavy brown", eyes: "hazel", bodyType: "athletic", style: "streetwear", personality: "warm, funny, relatable", niche: "streetwear for Gen Z", location: "London" }),
  );
  check("draft creator has persistent identity id", !!creator.identityId?.startsWith("idn_") && creator.status === "draft", creator.identityId ?? "");

  // 2. candidates
  const before = await balance();
  const { jobIds } = await generateCandidates(ws.id, user.id, creator.id, 4);
  check("4 candidate jobs queued, 4 credits debited", jobIds.length === 4 && (await balance()) === before - 4, `${before} → ${await balance()}`);
  await drain();
  let st = await creatorIdentityState(ws.id, creator.id);
  check("4 candidate portraits stored", st.candidates.length === 4, st.candidates.map((c) => c.mimeType).join(", "));
  if (stub) {
    const candReqs = calls.splice(0);
    check("candidate requests: text-only (no product, no identity refs)", candReqs.every((r) => r.productImage === null && (r.identityReferences ?? []).length === 0));
    check("candidate prompts state the person is fictional", candReqs.every((r) => /FICTIONAL person/.test(r.prompt)));
  }

  // 3. select master → identity pack
  const chosen = st.candidates[1];
  await selectMaster(ws.id, user.id, creator.id, chosen.id);
  await drain();
  st = await creatorIdentityState(ws.id, creator.id);
  check("selected candidate is the master reference", st.master?.url === chosen.url && st.creator.status === "active");
  check("identity pack has all 5 angles", ["front", "three_quarter", "side", "smiling", "neutral"].every((k) => st.pack.some((p) => p.kind === k)), st.pack.map((p) => p.kind).join(", "));
  check("identity id unchanged after selection", st.creator.identityId === creator.identityId);
  if (stub) {
    const packReqs = calls.splice(0);
    check("pack requests: conditioned on the master reference", packReqs.length === 5 && packReqs.every((r) => r.productImage === null && r.identityReferences?.length === 1 && r.identityReferences[0].kind === "master"));
  }

  // 4. product generation passes identity refs + product image + prompt
  const productPng = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#1f2a44" } }).png().toBuffer();
  const { url: imageUrl } = await storage().put({ folder: `ws/${ws.id}/uploads`, data: productPng, mimeType: "image/png" });
  const product = await db.product.create({ data: { workspaceId: ws.id, name: "Navy Hoodie", imageUrl, analysisStatus: "completed" } });
  const gen = await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "model", creatorIds: [creator.id], count: 1 }) });
  await drain();
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: gen.jobIds[0] }, include: { creative: true } });
  check("product photo with creator completed", job.status === "completed", job.error ?? "");
  if (stub) {
    const r = calls.splice(0)[0];
    const kinds = (r?.identityReferences ?? []).map((x) => x.kind);
    check("provider received the product reference image", !!r?.productImage && r.productImage.data.length > 0);
    check("provider received identity references (master first)", kinds[0] === "master" && kinds.length >= 2, kinds.join(", "));
    check("prompt explains product image + identity images", /Image 1 is the EXACT product/.test(r.prompt) && /Images 2–\d show the model's identity/.test(r.prompt));
    check("creative records which identity was used", (job.creative?.script ?? "").includes(creator.identityId!));
  }

  // draft creators can't be used for product generation
  const draft2 = await createDraftCreator(ws.id, CreatorAttributes.parse({ name: "Noa", age: 30, gender: "male", appearance: "deep brown skin", hair: "short black fade", bodyType: "slim", style: "minimal" }));
  try {
    await createGenerationJobs({ workspaceId: ws.id, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "model", creatorIds: [draft2.id], count: 1 }) });
    check("draft creator blocked from product generation", false);
  } catch (e) {
    check("draft creator blocked from product generation", /no identity yet/.test((e as Error).message), (e as Error).message);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  await db.$disconnect();
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
