"use client";

import { useEffect, useRef, useState } from "react";

export interface JobView {
  id: string;
  type: string;
  preset: string | null;
  status: "queued" | "generating" | "processing" | "completed" | "failed";
  progress: number;
  error: string | null;
  batchId: string | null;
  createdAt: string;
  creative: { id: string; title: string; kind: string; mediaUrl: string; thumbnailUrl: string | null; mimeType: string } | null;
}

const TERMINAL = new Set(["completed", "failed"]);

/**
 * Poll generation jobs every 2s until all are finished.
 * Pass explicit ids, or `active: true` to watch everything in flight for this workspace.
 */
export function useJobs(opts: { ids?: string[]; active?: boolean; onSettled?: () => void }) {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const settled = useRef(opts.onSettled);
  settled.current = opts.onSettled;
  const key = opts.ids?.join(",") ?? (opts.active ? "active" : "");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let hadPending = false;
    const query = opts.ids ? `ids=${encodeURIComponent(key)}` : "active=1";

    async function tick() {
      try {
        const res = await fetch(`/api/generations?${query}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { jobs: JobView[]; creditBalance: number };
        if (cancelled) return;
        setJobs(data.jobs);
        setCreditBalance(data.creditBalance);
        const pending = data.jobs.some((j) => !TERMINAL.has(j.status));
        if (pending) hadPending = true;
        if (!pending && hadPending) {
          hadPending = false;
          settled.current?.();
        }
        // explicit ids: stop once all are finished; active mode: keep watching slowly for new work
        if (pending) timer = setTimeout(tick, 2000);
        else if (opts.active) timer = setTimeout(tick, 8000);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 4000);
      }
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { jobs, creditBalance };
}

export const STATUS_LABEL: Record<JobView["status"], string> = {
  queued: "Queued",
  generating: "Generating…",
  processing: "Processing…",
  completed: "Completed",
  failed: "Failed",
};
