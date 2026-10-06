"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

/** Drag-and-drop image uploader that uploads immediately and returns the stored URL. */
export function ImageDrop({
  value, onChange, label, hint, className, compact,
}: { value: string | null; onChange: (url: string | null) => void; label: string; hint?: string; className?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file?: File) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await uploadFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <div
        onClick={() => !value && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white transition",
          compact ? "h-28" : "aspect-[4/5]",
          drag ? "border-brand bg-brand-50" : value ? "border-transparent bg-zinc-50" : "border-line hover:border-ink-4",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-contain p-4" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute right-3 top-3 rounded-full bg-white p-1.5 shadow-card hover:bg-zinc-50"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><ImagePlus className="h-5 w-5" /></span>
            <span className="text-sm font-semibold">{label}</span>
            {hint && <span className="text-[12px] text-ink-4">{hint}</span>}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}

export function ColorInput({ colors, onChange, max = 6 }: { colors: string[]; onChange: (c: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((c, i) => (
        <label key={i} className="group relative h-9 w-9 cursor-pointer rounded-full border border-line shadow-sm" style={{ background: c }}>
          <input type="color" value={c} className="absolute inset-0 opacity-0" onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))} />
          <button type="button" onClick={(e) => { e.preventDefault(); onChange(colors.filter((_, j) => j !== i)); }} className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 shadow group-hover:block" aria-label="Remove color">
            <X className="h-3 w-3" />
          </button>
        </label>
      ))}
      {colors.length < max && (
        <button type="button" onClick={() => onChange([...colors, "#5B4BFF"])} className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-ink-4 text-ink-3 hover:border-ink hover:text-ink" aria-label="Add color">
          +
        </button>
      )}
    </div>
  );
}
