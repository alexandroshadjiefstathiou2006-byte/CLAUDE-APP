"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Copy, Fingerprint, Loader2, Pencil, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, ButtonLink, Card } from "./ui";
import { CreatorForm, type CreatorFormValues } from "./creator-form";

interface Ref { id: string; kind: string; url: string; mimeType: string; provider: string; createdAt: string }
interface Job { id: string; preset: string | null; status: string; progress: number; error: string | null; createdAt: string }
interface State {
  creator: CreatorFormValues & { id: string; identityId: string | null; status: string; workspaceId: string | null; avatarUrl: string; isBrandCreator: boolean };
  candidates: Ref[];
  master: Ref | null;
  pack: Ref[];
  jobs: Job[];
  pending: Job[];
}

const PACK: { kind: string; label: string }[] = [
  { kind: "front", label: "Front-facing" },
  { kind: "three_quarter", label: "3/4 angle" },
  { kind: "side", label: "Side angle" },
  { kind: "smiling", label: "Smiling" },
  { kind: "neutral", label: "Neutral" },
];

export function CreatorIdentityStudio({ creatorId, autoGenerate, previewMode, creditPerImage }: { creatorId: string; autoGenerate: boolean; previewMode: boolean; creditPerImage: number }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/creators/${creatorId}`, { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, [creatorId]);

  useEffect(() => {
    load();
  }, [load]);

  // poll while portraits are generating
  const pendingCount = state?.pending.length ?? 0;
  useEffect(() => {
    if (!pendingCount) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [pendingCount, load]);

  async function post(path: string, body: unknown, label: string) {
    setBusy(label);
    setError(null);
    const res = await fetch(`/api/creators/${creatorId}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Something went wrong");
    await load();
    router.refresh(); // credit balance in the sidebar
  }

  const generate = () => post("/generate", { count: 4 }, "generate");

  // first visit from the "Create AI Creator" form: start generating immediately
  useEffect(() => {
    if (autoGenerate && state && !autoStarted.current && state.candidates.length === 0 && state.pending.length === 0) {
      autoStarted.current = true;
      generate();
      router.replace(`/app/creators/${creatorId}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, state]);

  if (!state) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-4" /></div>;
  }

  const { creator, candidates, master, pack } = state;
  const editable = !!creator.workspaceId;
  const pendingCandidates = state.pending.filter((j) => j.preset === "candidate").length;
  const failedCandidates = state.jobs.filter((j) => j.preset === "candidate" && j.status === "failed").slice(0, 1);
  const latestJob = (kind: string) => state.jobs.find((j) => j.preset === kind);

  async function saveEdits(values: CreatorFormValues) {
    setBusy("save");
    const res = await fetch(`/api/creators/${creatorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Could not save");
    setEditing(false);
    load();
  }

  async function remove() {
    if (!confirm(`Delete ${creator.name}? Existing creatives stay in your library.`)) return;
    await fetch(`/api/creators/${creatorId}`, { method: "DELETE" });
    router.push("/app/creators");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Link href="/app/creators" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> AI Creators
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={master?.url ?? creator.avatarUrl} alt={creator.name} className="h-16 w-16 rounded-2xl border border-line object-cover" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[28px] font-bold tracking-tight">{creator.name}</h1>
              {creator.status === "draft" ? <Badge tone="amber">Draft — choose a face</Badge> : <Badge tone="green">Identity locked</Badge>}
              {!editable && <Badge>Stock creator</Badge>}
            </div>
            <p className="mt-0.5 text-sm capitalize text-ink-3">
              {creator.age} · {creator.gender} · {creator.style}
              {creator.niche ? ` · ${creator.niche}` : ""}
            </p>
            {creator.identityId && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(creator.identityId!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/[.04] px-2.5 py-1 font-mono text-[12px] text-ink-3 hover:bg-black/[.07]"
                title="Persistent identity ID"
              >
                <Fingerprint className="h-3.5 w-3.5" /> {creator.identityId} {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {creator.status === "active" && (
            <ButtonLink href={`/app/create?creator=${creator.id}&kind=photo`} variant="brand"><Sparkles className="h-4 w-4" /> Create content with {creator.name}</ButtonLink>
          )}
          {editable && <Button variant="secondary" onClick={() => setEditing((e) => !e)}><Pencil className="h-4 w-4" /> {editing ? "Close" : "Edit details"}</Button>}
          {editable && <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>

      {previewMode && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Preview mode:</strong> no image AI is configured, so portraits are illustrated placeholders. Set <code>IMAGE_PROVIDER</code> and its API key to generate photorealistic fictional portraits — the workflow stays the same.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" /> {error}</div>
      )}

      {editing && editable && (
        <Card className="p-6 sm:p-8">
          <CreatorForm
            initial={{ name: creator.name, age: creator.age, gender: creator.gender, appearance: creator.appearance, hair: creator.hair, eyes: creator.eyes, bodyType: creator.bodyType, style: creator.style, personality: creator.personality, niche: creator.niche, location: creator.location }}
            submitLabel="Save details"
            onSubmit={saveEdits}
            busy={busy === "save"}
          />
          {master && <p className="mt-4 text-[13px] text-ink-4">Changing details doesn&apos;t change the locked face. Generate new options below to pick a different face.</p>}
        </Card>
      )}

      {/* Step 1: candidates */}
      {(editable || candidates.length > 0) && (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{master ? "Face options" : "1. Choose a face"}</h2>
              <p className="text-sm text-ink-3">Fictional portraits generated from the description. The one you pick becomes the master identity.</p>
            </div>
            {editable && (
              <Button variant={candidates.length ? "secondary" : "brand"} onClick={generate} loading={busy === "generate"} disabled={pendingCandidates > 0}>
                <Wand2 className="h-4 w-4" /> {candidates.length ? "Generate more options" : "Generate Creator"} · {4 * creditPerImage} credits
              </Button>
            )}
          </div>
          {candidates.length === 0 && pendingCandidates === 0 ? (
            <Card className="flex flex-col items-center px-6 py-14 text-center">
              <Wand2 className="h-6 w-6 text-brand" />
              <p className="mt-3 max-w-sm text-sm text-ink-3">Click <strong>Generate Creator</strong> to create 4 fictional portrait options for {creator.name}.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: pendingCandidates }, (_, i) => <PendingTile key={`p${i}`} label="Generating…" />)}
              {candidates.map((c) => {
                const selected = master?.url === c.url;
                return (
                  <div key={c.id} className="animate-fadein">
                    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl border bg-zinc-100 shadow-card", selected ? "border-brand ring-4 ring-brand/15" : "border-line")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt="Candidate portrait" className="h-full w-full object-cover" />
                      {selected && <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white shadow"><Check className="h-4 w-4" /></span>}
                    </div>
                    {editable && (
                      <Button
                        size="sm"
                        variant={selected ? "secondary" : "primary"}
                        className="mt-2.5 w-full"
                        disabled={selected || state.pending.length > 0}
                        loading={busy === `select:${c.id}`}
                        onClick={() => post("/select", { referenceId: c.id }, `select:${c.id}`)}
                      >
                        {selected ? "Master identity" : master ? "Switch to this face" : "Use this face"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {failedCandidates.map((j) => (
            <p key={j.id} className="mt-3 text-sm text-red-600">{j.error}</p>
          ))}
        </section>
      )}

      {/* Step 2: identity pack */}
      {master && (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{editable ? "2. Identity pack" : "Identity references"}</h2>
              <p className="text-sm text-ink-3">The same person from fixed angles. These are sent with every generation to keep {creator.name} consistent.</p>
            </div>
            {editable && (
              <Button variant="secondary" onClick={() => post("/pack", {}, "pack")} loading={busy === "pack"} disabled={state.pending.length > 0}>
                <RefreshCw className="h-4 w-4" /> Regenerate pack · {5 * creditPerImage} credits
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <RefTile url={master.url} label="Master" highlight />
            {PACK.map(({ kind, label }) => {
              const ref = pack.find((r) => r.kind === kind);
              const job = latestJob(kind);
              if (job && !["completed", "failed"].includes(job.status)) return <PendingTile key={kind} label={label} />;
              if (ref) return <RefTile key={kind} url={ref.url} label={label} />;
              if (job?.status === "failed") return <FailedTile key={kind} label={label} error={job.error} />;
              return <EmptyTile key={kind} label={label} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function RefTile({ url, label, highlight }: { url: string; label: string; highlight?: boolean }) {
  return (
    <div className="animate-fadein">
      <div className={cn("aspect-[4/5] overflow-hidden rounded-2xl border bg-zinc-100 shadow-card", highlight ? "border-brand ring-4 ring-brand/15" : "border-line")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-full w-full object-cover" />
      </div>
      <div className="mt-2 px-1 text-[13px] font-medium text-ink-2">{label}</div>
    </div>
  );
}

function PendingTile({ label }: { label: string }) {
  return (
    <div>
      <div className="skeleton flex aspect-[4/5] items-center justify-center rounded-2xl border border-line">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
      <div className="mt-2 px-1 text-[13px] font-medium text-ink-3">{label}</div>
    </div>
  );
}

function FailedTile({ label, error }: { label: string; error: string | null }) {
  return (
    <div>
      <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50/60 p-3 text-center">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="line-clamp-4 text-[11px] text-red-700">{error ?? "Failed — credits refunded"}</p>
      </div>
      <div className="mt-2 px-1 text-[13px] font-medium text-ink-3">{label}</div>
    </div>
  );
}

function EmptyTile({ label }: { label: string }) {
  return (
    <div>
      <div className="aspect-[4/5] rounded-2xl border border-dashed border-line bg-white" />
      <div className="mt-2 px-1 text-[13px] font-medium text-ink-4">{label}</div>
    </div>
  );
}
