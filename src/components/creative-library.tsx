"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Film, Heart, ImageIcon, Images, Layers, Pencil, Sparkles, Trash2 } from "lucide-react";
import { getPreset } from "@/lib/catalog";
import { cn, timeAgo } from "@/lib/utils";
import { Badge, Button, EmptyState, Media } from "./ui";
import { Modal } from "./creator-library";
import { JobCard } from "./job-card";
import { useJobs } from "./use-jobs";

export interface CreativeView {
  id: string;
  title: string;
  kind: string;
  preset: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  durationSec: number | null;
  script: string | null;
  tags: string;
  favorite: boolean;
  createdAt: string;
  productId: string | null;
  creatorId: string | null;
  product: { id: string; name: string } | null;
  creator: { id: string; name: string; avatarUrl: string } | null;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "ugc", label: "UGC" },
  { id: "ads", label: "Ads" },
  { id: "favorites", label: "Favorites" },
];

function matches(c: CreativeView, filter: string) {
  const tags: string[] = JSON.parse(c.tags || "[]");
  switch (filter) {
    case "photos": return c.kind === "photo";
    case "videos": return c.kind === "video";
    case "ugc": return tags.includes("ugc");
    case "ads": return tags.includes("ad");
    case "favorites": return c.favorite;
    default: return true;
  }
}

export function CreativeLibrary({ creatives: initial, openId, initialFilter }: { creatives: CreativeView[]; openId?: string; initialFilter?: string }) {
  const router = useRouter();
  const [creatives, setCreatives] = useState(initial);
  const [filter, setFilter] = useState(FILTERS.some((f) => f.id === initialFilter) ? initialFilter! : "all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const { jobs } = useJobs({ active: true, onSettled: () => router.refresh() });
  const pending = jobs.filter((j) => j.status !== "completed");

  useEffect(() => setCreatives(initial), [initial]);

  const products = useMemo(() => {
    const m = new Map<string, string>();
    initial.forEach((c) => c.product && m.set(c.product.id, c.product.name));
    return [...m];
  }, [initial]);

  const visible = creatives.filter((c) => matches(c, filter) && (productFilter === "all" || c.productId === productFilter));
  const current = creatives.find((c) => c.id === open);

  async function update(id: string, patch: Partial<Pick<CreativeView, "title" | "favorite">>) {
    setCreatives((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await fetch(`/api/creatives/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }
  async function remove(id: string) {
    if (!confirm("Delete this creative?")) return;
    setCreatives((cs) => cs.filter((c) => c.id !== id));
    setOpen(null);
    await fetch(`/api/creatives/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function duplicate(id: string) {
    const res = await fetch(`/api/creatives/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const { creative } = await res.json();
      const src = creatives.find((c) => c.id === id)!;
      setCreatives((cs) => [{ ...src, ...creative, createdAt: new Date().toISOString() }, ...cs]);
      setOpen(creative.id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn("chip", filter === f.id && "chip-active")}>
              {f.id === "favorites" && <Heart className="h-3.5 w-3.5" />}
              {f.label}
            </button>
          ))}
        </div>
        {products.length > 1 && (
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="input h-9 w-auto py-0 text-sm">
            <option value="all">All products</option>
            {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      {pending.length > 0 && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {pending.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}

      {visible.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={<Images className="h-5 w-5" />}
          title={filter === "all" ? "Your library is empty" : "Nothing here yet"}
          body={filter === "favorites" ? "Tap the heart on any creative to save it here." : "Generate photos and videos — they're saved here automatically."}
          action={<Link href="/app/create"><Button variant="brand"><Sparkles className="h-4 w-4" /> Create content</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((c) => (
            <div key={c.id} className="group">
              <button onClick={() => setOpen(c.id)} className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line bg-zinc-100 shadow-card transition group-hover:shadow-lift">
                <Media url={c.mediaUrl} mimeType={c.mimeType} poster={c.thumbnailUrl} alt={c.title} className="h-full w-full object-cover" />
                <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                  {c.kind === "video" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  {getPreset(c.preset)?.label}
                  {c.durationSec ? ` · ${c.durationSec}s` : ""}
                </span>
              </button>
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="truncate text-[13px] font-medium text-ink-2">{c.title}</span>
                <button onClick={() => update(c.id, { favorite: !c.favorite })} aria-label="Favorite" className="shrink-0">
                  <Heart className={cn("h-4 w-4 transition", c.favorite ? "fill-rose-500 text-rose-500" : "text-ink-4 hover:text-ink")} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <CreativeModal
          creative={current}
          onClose={() => { setOpen(null); router.replace("/app/library", { scroll: false }); }}
          onUpdate={(p) => update(current.id, p)}
          onDelete={() => remove(current.id)}
          onDuplicate={() => duplicate(current.id)}
        />
      )}
    </div>
  );
}

interface ScriptData {
  hook?: string;
  script?: string;
  caption?: string;
  cta?: string;
  hashtags?: string[];
  platform?: string;
  voiceUrl?: string | null;
  dialogue?: string | null;
  scenes?: { order: number; title: string; shot: string; action: string; line?: string; durationSec: number }[];
}

function CreativeModal({ creative, onClose, onUpdate, onDelete, onDuplicate }: {
  creative: CreativeView; onClose: () => void; onUpdate: (p: { title?: string; favorite?: boolean }) => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(creative.title);
  useEffect(() => setTitle(creative.title), [creative.title]);
  const script: ScriptData | null = creative.script ? JSON.parse(creative.script) : null;
  const preset = getPreset(creative.preset);
  const ext = creative.mimeType === "video/mp4" ? "mp4" : creative.mimeType === "image/png" ? "png" : creative.mimeType === "image/svg+xml" ? "svg" : "jpg";
  const filename = `${creative.title.replace(/[^\w\- ]/g, "").slice(0, 40) || "creative"}.${ext}`;
  const variationsHref = `/app/create?product=${creative.productId ?? ""}&preset=${creative.preset}${creative.creatorId ? `&creator=${creative.creatorId}` : ""}&count=5&from=${creative.id}`;

  return (
    <Modal onClose={onClose} wide>
      <div className="grid md:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex items-center justify-center bg-zinc-100 p-4 md:min-h-[600px]">
          <Media url={creative.mediaUrl} mimeType={creative.mimeType} poster={creative.thumbnailUrl} alt={creative.title} controls className="max-h-[78vh] w-auto rounded-xl shadow-card" />
        </div>
        <div className="flex flex-col p-6 md:max-h-[92vh] md:overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 pr-10">
            <Badge tone="brand">{preset?.label}</Badge>
            {creative.durationSec && <Badge>{creative.durationSec}s</Badge>}
            {script?.platform && <Badge className="capitalize">{script.platform.replace("_", " ")}</Badge>}
          </div>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); onUpdate({ title }); setEditing(false); }} className="mt-3 flex gap-2">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              <Button size="sm" type="submit" className="h-auto">Save</Button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} className="group mt-3 flex items-start gap-2 text-left">
              <h2 className="font-display text-xl font-bold leading-snug">{creative.title}</h2>
              <Pencil className="mt-1.5 h-3.5 w-3.5 shrink-0 text-ink-4 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}
          <div className="mt-2 text-[13px] text-ink-4">
            {creative.product?.name}{creative.creator ? ` · ${creative.creator.name}` : ""} · {timeAgo(creative.createdAt)}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <a href={`${creative.mediaUrl}?download=${encodeURIComponent(filename)}`} className="col-span-2">
              <Button variant="brand" className="w-full"><Download className="h-4 w-4" /> Download</Button>
            </a>
            <Link href={variationsHref} className="col-span-2"><Button className="w-full"><Layers className="h-4 w-4" /> Generate variations</Button></Link>
            <Button variant="secondary" onClick={() => onUpdate({ favorite: !creative.favorite })}>
              <Heart className={cn("h-4 w-4", creative.favorite && "fill-rose-500 text-rose-500")} /> {creative.favorite ? "Saved" : "Favorite"}
            </Button>
            <Button variant="secondary" onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicate</Button>
          </div>

          {script?.hook && (
            <div className="mt-6 space-y-4 text-sm">
              <Section label="Hook"><p className="font-semibold text-ink">“{script.hook}”</p></Section>
              {script.scenes && script.scenes.length > 0 && (
                <Section label="Scenes">
                  <ol className="space-y-2.5">
                    {script.scenes.map((s) => (
                      <li key={s.order} className="flex gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-[11px] font-semibold">{s.order}</span>
                        <div>
                          <div className="font-medium text-ink-2">{s.title} <span className="font-normal text-ink-4">· {s.durationSec}s · {s.shot}</span></div>
                          <div className="text-ink-3">{s.action}</div>
                          {s.line && <div className="mt-0.5 italic text-ink-2">“{s.line}”</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
              {script.dialogue && <Section label="Spoken in video"><p className="italic text-ink-2">“{script.dialogue}”</p></Section>}
              {script.voiceUrl && <Section label="Voiceover"><audio src={script.voiceUrl} controls className="w-full" /></Section>}
            </div>
          )}
          {script?.caption && (
            <div className="mt-4 text-sm">
              <Section label="Caption">
                <p className="text-ink-2">{script.caption}</p>
                {script.hashtags && <p className="mt-1 text-brand">{script.hashtags.join(" ")}</p>}
              </Section>
            </div>
          )}

          <button onClick={onDelete} className="mt-8 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-red-600 hover:underline">
            <Trash2 className="h-3.5 w-3.5" /> Delete creative
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-4">{label}</div>
      {children}
    </div>
  );
}
