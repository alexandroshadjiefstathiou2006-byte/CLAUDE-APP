/**
 * Standalone generation worker: `npm run worker`.
 * Scale horizontally by running more instances — job claiming is atomic.
 */
import { drainQueue, recoverStaleJobs } from "@/server/jobs/runner";
import { providerSummary } from "@/server/ai/registry";

const IDLE_MS = 1000;
let stopping = false;

async function main() {
  console.log("[worker] started with providers", providerSummary());
  let lastRecover = 0;
  while (!stopping) {
    if (Date.now() - lastRecover > 60_000) {
      await recoverStaleJobs();
      lastRecover = Date.now();
    }
    const ran = await drainQueue({ concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4), maxJobs: 50 });
    if (ran === 0) await new Promise((r) => setTimeout(r, IDLE_MS));
  }
  console.log("[worker] stopped");
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
