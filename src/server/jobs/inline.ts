/**
 * In-process worker for development (JOB_RUNNER=inline, the default).
 * In production set JOB_RUNNER=external and run `npm run worker` as its own process/container,
 * so web requests never share CPU/memory with generation work.
 */
const g = globalThis as unknown as { __studioWorker?: { timer: NodeJS.Timeout; busy: boolean } };

export function kickWorker() {
  if ((process.env.JOB_RUNNER ?? "inline") !== "inline") return;
  if (g.__studioWorker) return;
  const state = { busy: false, timer: undefined as unknown as NodeJS.Timeout };
  const tick = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      const { drainQueue, recoverStaleJobs } = await import("./runner");
      await recoverStaleJobs();
      await drainQueue({ concurrency: 3, maxJobs: 25 });
    } catch (err) {
      console.error("[inline-worker]", err);
    } finally {
      state.busy = false;
    }
  };
  state.timer = setInterval(tick, 1500);
  g.__studioWorker = state;
  void tick();
}
