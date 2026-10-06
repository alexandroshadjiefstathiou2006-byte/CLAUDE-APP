"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Camera, Check, Clapperboard, Coins, Film, Images, Mic, Package, Plus, Sparkles, UserRound, Wand2,
} from "lucide-react";
import {
  AD_STYLES, MAX_VARIATIONS, PHOTO_ASPECTS, PHOTO_PRESETS, PLATFORMS, VIDEO_DURATIONS, VIDEO_PRESETS, generationCost, getPreset,
  type CreativeKind, type Quality,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Badge, Button, ButtonLink, Card } from "./ui";
import { CreatorCard, useCreatorFilters, type CreatorView } from "./creator-library";
import { JobCard } from "./job-card";
import { useJobs } from "./use-jobs";

interface ProductLite { id: string; name: string; imageUrl: string; analysisStatus: string }

type Step = "product" | "creator" | "format" | "customize" | "results";
const STEPS: { id: Exclude<Step, "results">; label: string; icon: React.ElementType }[] = [
  { id: "product", label: "Product", icon: Package },
  { id: "creator", label: "AI Creator", icon: UserRound },
  { id: "format", label: "Format", icon: Wand2 },
  { id: "customize", label: "Customize", icon: Sparkles },
];

const VARIATION_OPTIONS = [1, 3, 5, MAX_VARIATIONS];

export function CreateStudio(props: {
  products: ProductLite[];
  creators: CreatorView[];
  credits: number;
  brandName: string;
  initial: { productId?: string; creatorId?: string; kind?: CreativeKind; presetId?: string; count?: number; sourceCreativeId?: string };
}) {
  const router = useRouter();
  const { initial } = props;
  const initialPreset = initial.presetId ? getPreset(initial.presetId) : undefined;

  const [productId, setProductId] = useState<string | null>(props.products.some((p) => p.id === initial.productId) ? initial.productId! : null);
  const [creatorIds, setCreatorIds] = useState<string[]>(initial.creatorId ? [initial.creatorId] : []);
  const [kind, setKind] = useState<CreativeKind>(initialPreset?.kind ?? initial.kind ?? "photo");
  const [presetId, setPresetId] = useState<string | null>(initialPreset?.id ?? null);
  const [quality, setQuality] = useState<Quality>("standard");
  const [aspect, setAspect] = useState<"4:5" | "1:1" | "9:16">("4:5");
  const [platform, setPlatform] = useState("tiktok");
  const [duration, setDuration] = useState<number>(15);
  const [styleId, setStyleId] = useState("authentic");
  const [count, setCount] = useState<number>(Math.min(MAX_VARIATIONS, Math.max(1, initial.count ?? (initialPreset?.kind === "video" ? 1 : 3))));
  const [step, setStep] = useState<Step>(() => {
    if (!productId) return "product";
    if (initial.creatorId && initialPreset) return "customize";
    if (initialPreset && !initialPreset.needsCreator) return "customize";
    return "creator";
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [credits, setCredits] = useState(props.credits);

  const product = props.products.find((p) => p.id === productId);
  const preset = presetId ? getPreset(presetId) : undefined;
  const selectedCreators = creatorIds.map((id) => props.creators.find((c) => c.id === id)).filter(Boolean) as CreatorView[];
  const cost = preset ? generationCost({ kind: preset.kind, quality, durationSec: duration, count }) : 0;
  const { jobs, creditBalance } = useJobs({ ids: jobIds.length ? jobIds : undefined, onSettled: () => router.refresh() });
  const liveCredits = creditBalance ?? credits;

  const canContinue: Record<Exclude<Step, "results">, boolean> = {
    product: !!productId,
    creator: true,
    format: !!preset && (!preset.needsCreator || creatorIds.length > 0),
    customize: !!preset && cost <= liveCredits,
  };

  function toggleCreator(id: string) {
    setCreatorIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 5 ? cur : [...cur, id]));
  }

  function choosePreset(id: string) {
    const p = getPreset(id)!;
    setPresetId(id);
    if (p.kind === "video" && count > 5) setCount(5);
  }

  async function generate() {
    if (!productId || !preset) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        presetId: preset.id,
        creatorIds: preset.needsCreator ? creatorIds : [],
        count,
        quality,
        aspect,
        platform,
        durationSec: duration,
        styleId,
        sourceCreativeId: initial.sourceCreativeId,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(res.status === 402 ? `You need ${data.needed} credits but have ${data.available}.` : data.error ?? "Could not start generation");
      return;
    }
    setCredits((c) => c - data.creditsUsed);
    setJobIds(data.jobIds);
    setStep("results");
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="pb-32">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">{step === "results" ? "Your creatives are on the way" : "What do you want to create?"}</h1>
          <p className="mt-1 text-[15px] text-ink-3">
            {step === "results" ? "Generation runs in the background — you can leave this page, everything is saved to your library." : "Product → creator → format → generate. On-brand for " + props.brandName + "."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium">
          <Coins className="h-4 w-4 text-amber-500" /> {liveCredits} credits
        </span>
      </div>

      {step !== "results" && (
        <ol className="mb-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            const reachable = i <= stepIndex || STEPS.slice(0, i).every((x) => canContinue[x.id]);
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => setStep(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition",
                    active ? "bg-ink text-white" : done ? "bg-white text-ink shadow-card" : "text-ink-4",
                  )}
                >
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", active ? "bg-white/20" : done ? "bg-emerald-500 text-white" : "bg-black/[.06]")}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Step: product ─────────────────────────────── */}
      {step === "product" && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 animate-fadein">
          <Link href="/app/products/new" className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white text-ink-3 transition hover:border-ink-4 hover:text-ink">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-semibold">Add Product</span>
          </Link>
          {props.products.map((p) => (
            <button key={p.id} type="button" onClick={() => { setProductId(p.id); setStep("creator"); }} className="group text-left">
              <div className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl border bg-white shadow-card transition", productId === p.id ? "border-brand ring-4 ring-brand/15" : "border-line group-hover:shadow-lift")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-5" />
                {productId === p.id && <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check className="h-4 w-4" /></span>}
              </div>
              <div className="mt-2.5 truncate px-1 text-sm font-semibold">{p.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── Step: creator ─────────────────────────────── */}
      {step === "creator" && <CreatorStep creators={props.creators} selected={creatorIds} onToggle={toggleCreator} onSkip={() => { setCreatorIds([]); setKind(preset?.kind ?? kind); setStep("format"); }} />}

      {/* ── Step: format ──────────────────────────────── */}
      {step === "format" && (
        <div className="space-y-6 animate-fadein">
          <div className="inline-flex rounded-xl bg-black/[.05] p-1">
            {(["photo", "video"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={cn("flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition", kind === k ? "bg-white shadow-card" : "text-ink-3")}>
                {k === "photo" ? <Camera className="h-4 w-4" /> : <Clapperboard className="h-4 w-4" />}
                {k === "photo" ? "Photos" : "Videos"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(kind === "photo" ? PHOTO_PRESETS : VIDEO_PRESETS).map((p) => {
              const blocked = p.needsCreator && creatorIds.length === 0;
              const unit = generationCost({ kind: p.kind, quality: "standard", durationSec: 15, count: 1 });
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (blocked ? setStep("creator") : choosePreset(p.id))}
                  className={cn("group overflow-hidden rounded-2xl border bg-white text-left shadow-card transition hover:shadow-lift", presetId === p.id ? "border-brand ring-4 ring-brand/15" : "border-line", blocked && "opacity-60")}
                >
                  <div className={cn("relative flex h-24 items-end bg-gradient-to-br p-4", p.accent)}>
                    {p.kind === "photo" ? <Camera className="h-6 w-6 text-ink/40" /> : <Film className="h-6 w-6 text-ink/40" />}
                    {p.kind === "video" && p.talking && <Badge className="absolute right-3 top-3 bg-white/80"><Mic className="h-3 w-3" /> Voice</Badge>}
                    {presetId === p.id && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check className="h-4 w-4" /></span>}
                  </div>
                  <div className="p-4">
                    <div className="font-semibold">{p.label}</div>
                    <div className="mt-0.5 text-[13px] text-ink-3">{p.description}</div>
                    <div className="mt-3 text-[12px] font-medium text-ink-4">
                      {blocked ? "Choose a creator first" : p.kind === "photo" ? `${unit} credit / photo` : "1 credit / second"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step: customize ───────────────────────────── */}
      {step === "customize" && preset && product && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] animate-fadein">
          <Card className="space-y-8 p-6 sm:p-8">
            {preset.kind === "photo" ? (
              <>
                <OptionRow label="Quality">
                  <Seg value={quality} onChange={(v) => setQuality(v as Quality)} options={[{ id: "standard", label: "Standard · 1 cr" }, { id: "high", label: "High quality · 2 cr" }]} />
                </OptionRow>
                <OptionRow label="Format">
                  <Seg value={aspect} onChange={(v) => setAspect(v as typeof aspect)} options={PHOTO_ASPECTS.map((a) => ({ id: a.id, label: a.label }))} />
                </OptionRow>
              </>
            ) : (
              <>
                <OptionRow label="Ad style">
                  <div className="flex flex-wrap gap-2">
                    {AD_STYLES.map((s) => (
                      <button key={s.id} type="button" onClick={() => setStyleId(s.id)} className={cn("chip", styleId === s.id && "chip-active")}>{s.label}</button>
                    ))}
                  </div>
                </OptionRow>
                <OptionRow label="Platform">
                  <Seg value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))} />
                </OptionRow>
                <OptionRow label="Duration">
                  <Seg value={String(duration)} onChange={(v) => setDuration(Number(v))} options={VIDEO_DURATIONS.map((d) => ({ id: String(d), label: `${d}s` }))} />
                </OptionRow>
              </>
            )}
            <OptionRow label="Variations" hint="Each variation changes the hook, location, camera angle and CTA — perfect for ad testing.">
              <Seg value={String(count)} onChange={(v) => setCount(Number(v))} options={VARIATION_OPTIONS.filter((n) => preset.kind === "photo" || n <= 5).map((n) => ({ id: String(n), label: n === 1 ? "Single" : `${n} variations` }))} />
              {count > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(preset.kind === "video" ? ["Hook", "Script", "Location", "Camera angle", "Shot sequence", "CTA", "Tone"] : ["Location", "Camera angle", "Background", "Pose"]).map((x) => <Badge key={x} tone="brand">{x}</Badge>)}
                  {selectedCreators.length > 1 && <Badge tone="brand">AI model ({selectedCreators.length})</Badge>}
                </div>
              )}
            </OptionRow>
          </Card>

          <Card className="h-fit p-6">
            <div className="text-[12px] font-medium uppercase tracking-wide text-ink-4">Summary</div>
            <div className="mt-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-xl border border-line bg-zinc-50 object-contain p-1" />
              <div className="min-w-0">
                <div className="truncate font-semibold">{product.name}</div>
                <div className="text-[13px] text-ink-3">{preset.label}</div>
              </div>
            </div>
            {preset.needsCreator && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {selectedCreators.map((c) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.id} src={c.avatarUrl} alt={c.name} className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                  ))}
                </div>
                <span className="text-[13px] text-ink-3">{selectedCreators.map((c) => c.name).join(", ")}</span>
              </div>
            )}
            <div className="my-5 h-px bg-line" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-3">{count} × {preset.kind === "video" ? `${duration}s video` : `${quality} photo`}</span>
              <span className="font-display text-2xl font-bold">{cost} <span className="text-sm font-medium text-ink-4">credits</span></span>
            </div>
            {cost > liveCredits && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                Not enough credits. <Link href="/app/billing" className="font-semibold underline">Upgrade your plan</Link>
              </p>
            )}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
            <Button variant="brand" size="lg" className="mt-5 w-full" loading={submitting} disabled={!canContinue.customize} onClick={generate}>
              <Sparkles className="h-4 w-4" /> Generate {count > 1 ? `${count} creatives` : ""}
            </Button>
          </Card>
        </div>
      )}

      {/* ── Results ───────────────────────────────────── */}
      {step === "results" && (
        <div className="space-y-8 animate-fadein">
          <div className={cn("grid gap-5", preset?.kind === "video" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
            {(jobs.length ? jobs : jobIds.map((id) => ({ id, status: "queued", progress: 0, preset: presetId, type: preset?.kind ?? "photo", error: null, batchId: null, createdAt: "", creative: null }) as const)).map((j) => (
              <JobCard key={j.id} job={j as never} aspect={preset?.kind === "video" || aspect === "9:16" ? "aspect-[9/16]" : aspect === "1:1" ? "aspect-square" : "aspect-[4/5]"} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="brand" onClick={() => { setJobIds([]); setStep("customize"); }}><Sparkles className="h-4 w-4" /> Generate more</Button>
            <Button variant="secondary" onClick={() => { setJobIds([]); setPresetId(null); setStep("format"); }}>Try another format</Button>
            <ButtonLink href="/app/library" variant="ghost"><Images className="h-4 w-4" /> Open library</ButtonLink>
          </div>
        </div>
      )}

      {/* ── Sticky footer navigation ───────────────────── */}
      {step !== "results" && step !== "customize" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 backdrop-blur lg:left-[248px]">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3 text-sm text-ink-3">
              {product && <SummaryPill img={product.imageUrl} label={product.name} />}
              {selectedCreators.length > 0 && <SummaryPill img={selectedCreators[0].avatarUrl} label={selectedCreators.map((c) => c.name).join(", ")} round />}
              {preset && <span className="hidden rounded-full bg-black/[.04] px-3 py-1.5 font-medium text-ink-2 sm:inline">{preset.label}</span>}
            </div>
            <div className="flex shrink-0 gap-2">
              {stepIndex > 0 && <Button variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}><ArrowLeft className="h-4 w-4" /> Back</Button>}
              <Button disabled={!canContinue[step as Exclude<Step, "results">]} onClick={() => setStep(STEPS[stepIndex + 1].id)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatorStep({ creators, selected, onToggle, onSkip }: { creators: CreatorView[]; selected: string[]; onToggle: (id: string) => void; onSkip: () => void }) {
  const { filtered, bar } = useCreatorFilters(creators);
  return (
    <div className="space-y-6 animate-fadein">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {bar}
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-ink-4">Pick up to 5 to vary the model across variations</span>
          <Button variant="secondary" size="sm" onClick={onSkip}>Product only — no model</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {filtered.map((c) => <CreatorCard key={c.id} creator={c} selected={selected.includes(c.id)} onClick={() => onToggle(c.id)} />)}
      </div>
    </div>
  );
}

function SummaryPill({ img, label, round }: { img: string; label: string; round?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-full bg-black/[.04] py-1 pl-1 pr-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" className={cn("h-7 w-7 bg-white object-cover", round ? "rounded-full" : "rounded-full object-contain")} />
      <span className="truncate font-medium text-ink-2">{label}</span>
    </span>
  );
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-[13px] text-ink-4">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className={cn("chip", value === o.id && "chip-active")}>{o.label}</button>
      ))}
    </div>
  );
}
