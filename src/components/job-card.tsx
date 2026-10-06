"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { getPreset } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Media } from "./ui";
import { STATUS_LABEL, type JobView } from "./use-jobs";

export function JobCard({ job, aspect = "aspect-[4/5]" }: { job: JobView; aspect?: string }) {
  const preset = job.preset ? getPreset(job.preset) : undefined;
  const done = job.status === "completed" && job.creative;
  return (
    <div className="animate-fadein">
      <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-white shadow-card", aspect)}>
        {done ? (
          <Link href={`/app/library?open=${job.creative!.id}`} className="block h-full w-full">
            <Media url={job.creative!.mediaUrl} mimeType={job.creative!.mimeType} alt={job.creative!.title} className="h-full w-full object-cover" />
          </Link>
        ) : job.status === "failed" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-red-50/50 p-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div className="text-sm font-medium text-red-700">Generation failed</div>
            <div className="line-clamp-3 text-[12px] text-red-600/80">{job.error ?? "Unknown error"}</div>
            <div className="text-[12px] text-ink-3">Credits refunded</div>
          </div>
        ) : (
          <div className="skeleton flex h-full flex-col items-center justify-center gap-3 p-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-card">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </div>
            </div>
            <div className="text-sm font-semibold text-ink-2">{STATUS_LABEL[job.status]}</div>
            <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-black/[.06]">
              <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.max(6, job.progress)}%` }} />
            </div>
          </div>
        )}
        <span
          className={cn(
            "absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur",
            done ? "bg-black/60 text-white" : "bg-white/90 text-ink-2 shadow-sm",
          )}
        >
          {done && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
          {preset?.label ?? job.type}
        </span>
        {done && (
          <a
            href={`${job.creative!.mediaUrl}?download=${encodeURIComponent(job.creative!.title.slice(0, 40))}`}
            className="absolute bottom-2.5 right-2.5 rounded-full bg-white/95 p-2 text-ink shadow-card transition hover:scale-105"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
      <div className="mt-2 line-clamp-1 px-1 text-[13px] font-medium text-ink-2">{done ? job.creative!.title : STATUS_LABEL[job.status]}</div>
    </div>
  );
}
