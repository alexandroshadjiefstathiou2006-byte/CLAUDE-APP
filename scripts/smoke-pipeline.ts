/** Smoke test: enqueue a photo batch + a video and drain the queue with the configured providers. */
import { db } from "@/lib/db";
import { createGenerationJobs, GenerationRequestSchema } from "@/server/jobs/enqueue";
import { drainQueue } from "@/server/jobs/runner";

async function main() {
  process.env.JOB_RUNNER = "external";
  const user = await db.user.findUniqueOrThrow({ where: { email: "demo@studio.dev" }, include: { memberships: true } });
  const workspaceId = user.memberships[0].workspaceId;
  const product = await db.product.findFirstOrThrow({ where: { workspaceId } });
  const creators = await db.creator.findMany({ where: { workspaceId: null }, take: 2 });
  const before = (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).creditBalance;

  const photo = await createGenerationJobs({ workspaceId, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "mirror_selfie", creatorIds: creators.map((c) => c.id), count: 3 }) });
  const video = await createGenerationJobs({ workspaceId, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "ugc_ad", creatorIds: [creators[0].id], count: 2, durationSec: 15 }) });
  console.log("credits", before, "→", (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).creditBalance);

  const ids = [...photo.jobIds, ...video.jobIds];
  for (let i = 0; i < 20; i++) {
    await drainQueue();
    const jobs = await db.generationJob.findMany({ where: { id: { in: ids } } });
    if (jobs.every((j) => j.status === "completed" || j.status === "failed")) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const jobs = await db.generationJob.findMany({ where: { id: { in: ids } }, include: { creative: true } });
  for (const j of jobs) console.log(j.type, j.status, j.error ?? "", j.creative?.title, j.creative?.mediaUrl);
}
main().then(() => process.exit(0));
