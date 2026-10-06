"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useJobs } from "./use-jobs";

/** Shows in-flight generations on the dashboard and refreshes the page when they complete. */
export function ActiveJobsBanner() {
  const router = useRouter();
  const { jobs } = useJobs({ active: true, onSettled: () => router.refresh() });
  const pending = jobs.filter((j) => j.status !== "completed" && j.status !== "failed");
  if (pending.length === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4 text-sm animate-fadein">
      <Loader2 className="h-4 w-4 animate-spin text-brand" />
      <span className="font-medium text-brand-700">
        {pending.length} creative{pending.length > 1 ? "s" : ""} generating…
      </span>
      <span className="text-brand-700/70">They&apos;ll appear in your library automatically.</span>
    </div>
  );
}
