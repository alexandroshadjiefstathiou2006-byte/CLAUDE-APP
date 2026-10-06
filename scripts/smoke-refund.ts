/** Smoke test: a failing provider retries, then marks the job failed and refunds credits. */
import { db } from "@/lib/db";
import { createGenerationJobs, GenerationRequestSchema } from "@/server/jobs/enqueue";
import { drainQueue } from "@/server/jobs/runner";

async function main() {
  const user = await db.user.findUniqueOrThrow({ where: { email: "demo@studio.dev" }, include: { memberships: true } });
  const workspaceId = user.memberships[0].workspaceId;
  const product = await db.product.findFirstOrThrow({ where: { workspaceId } });
  const bal = async () => (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).creditBalance;
  const before = await bal();
  const { jobIds } = await createGenerationJobs({ workspaceId, userId: user.id, request: GenerationRequestSchema.parse({ productId: product.id, presetId: "studio", quality: "high" }) });
  console.log("after debit", before, "→", await bal());
  for (let i = 0; i < 30; i++) {
    await drainQueue();
    const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobIds[0] } });
    if (job.status === "failed" || job.status === "completed") { console.log(job.status, job.attempts, job.error); break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("after refund", await bal(), "(expected", before + ")");
}
main().then(() => process.exit(0));
