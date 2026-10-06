"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ALL_PRESETS } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { ColorInput, ImageDrop } from "@/components/uploader";

interface Kit {
  brandName: string; logoUrl: string | null; colors: string[]; fonts: string; toneOfVoice: string; targetCustomer: string;
  categories: string[]; preferredStyles: string[]; preferredCreatorIds: string[];
}

const TONES = ["Confident", "Playful", "Minimal", "Luxurious", "Edgy", "Warm", "Sporty", "Sustainable"];

export function BrandKitForm({ initial, creators }: { initial: Kit; creators: { id: string; name: string; avatarUrl: string }[] }) {
  const router = useRouter();
  const [kit, setKit] = useState(initial);
  const [categoriesText, setCategoriesText] = useState(initial.categories.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (key: "preferredStyles" | "preferredCreatorIds", id: string) =>
    setKit((k) => ({ ...k, [key]: k[key].includes(id) ? k[key].filter((x) => x !== id) : [...k[key], id] }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { ...kit, categories: categoriesText.split(",").map((s) => s.trim()).filter(Boolean) };
    const res = await fetch("/api/brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) return setError((await res.json()).error ?? "Could not save");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card className="space-y-6 p-6 sm:p-8">
          <h2 className="font-semibold">Identity</h2>
          <div className="grid gap-6 sm:grid-cols-[140px_1fr]">
            <div>
              <span className="label">Logo</span>
              <ImageDrop compact value={kit.logoUrl} onChange={(logoUrl) => setKit({ ...kit, logoUrl })} label="Upload" className="[&>div]:h-[140px]" />
            </div>
            <div className="space-y-5">
              <div><label className="label">Brand name</label><input className="input" value={kit.brandName} onChange={(e) => setKit({ ...kit, brandName: e.target.value })} /></div>
              <div><label className="label">Fonts</label><input className="input" value={kit.fonts} onChange={(e) => setKit({ ...kit, fonts: e.target.value })} placeholder="e.g. Inter Tight / Canela" /></div>
            </div>
          </div>
          <div><span className="label">Brand colors</span><ColorInput colors={kit.colors} onChange={(colors) => setKit({ ...kit, colors })} max={8} /></div>
        </Card>

        <Card className="space-y-6 p-6 sm:p-8">
          <h2 className="font-semibold">Voice & audience</h2>
          <div>
            <label className="label">Tone of voice</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button type="button" key={t} className="chip" onClick={() => setKit({ ...kit, toneOfVoice: kit.toneOfVoice ? `${kit.toneOfVoice}, ${t.toLowerCase()}` : t })}>+ {t}</button>
              ))}
            </div>
            <textarea className="input min-h-[80px]" value={kit.toneOfVoice} onChange={(e) => setKit({ ...kit, toneOfVoice: e.target.value })} placeholder="How does your brand talk? e.g. confident, understated, a little playful" />
          </div>
          <div><label className="label">Target customer</label><textarea className="input min-h-[80px]" value={kit.targetCustomer} onChange={(e) => setKit({ ...kit, targetCustomer: e.target.value })} placeholder="e.g. Women 22–35, city professionals who love minimal, quality basics" /></div>
          <div><label className="label">Product categories</label><input className="input" value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)} placeholder="hoodies, denim, outerwear" /></div>
        </Card>

        <Card className="space-y-4 p-6 sm:p-8">
          <h2 className="font-semibold">Preferred creative styles</h2>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PRESETS.map((p) => (
              <button type="button" key={p.id} onClick={() => toggle("preferredStyles", p.id)} className={cn("chip", kit.preferredStyles.includes(p.id) && "chip-active")}>{p.label}</button>
            ))}
          </div>
          <h2 className="pt-4 font-semibold">Preferred AI creators</h2>
          <div className="flex flex-wrap gap-3">
            {creators.map((c) => {
              const on = kit.preferredCreatorIds.includes(c.id);
              return (
                <button type="button" key={c.id} onClick={() => toggle("preferredCreatorIds", c.id)} className="flex flex-col items-center gap-1">
                  <span className={cn("relative h-14 w-14 overflow-hidden rounded-full border-2", on ? "border-brand" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                    {on && <span className="absolute inset-0 flex items-center justify-center bg-brand/40 text-white"><Check className="h-5 w-5" /></span>}
                  </span>
                  <span className="text-[12px] text-ink-3">{c.name}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="lg:sticky lg:top-8 lg:h-fit">
        <Card className="p-6">
          <div className="text-[12px] font-medium uppercase tracking-wide text-ink-4">Preview</div>
          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <div className="flex h-24 items-center justify-center" style={{ background: kit.colors[0] ?? "#16161A" }}>
              {kit.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={kit.logoUrl} alt="" className="h-12 object-contain" />
              ) : (
                <span className="font-display text-xl font-bold" style={{ color: kit.colors[1] ?? "#fff" }}>{kit.brandName || "Your brand"}</span>
              )}
            </div>
            <div className="flex">{kit.colors.map((c) => <span key={c} className="h-3 flex-1" style={{ background: c }} />)}</div>
            <p className="p-4 text-[13px] text-ink-3">{kit.toneOfVoice || "Add a tone of voice so scripts and captions sound like you."}</p>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="brand" className="mt-5 w-full" loading={saving}>
            {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save brand kit"}
          </Button>
        </Card>
      </div>
    </form>
  );
}
