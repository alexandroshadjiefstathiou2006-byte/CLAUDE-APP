"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

export interface CreatorFormValues {
  name: string;
  age: number;
  gender: "female" | "male" | "nonbinary";
  appearance: string;
  hair: string;
  eyes: string;
  bodyType: string;
  style: string;
  personality: string;
  niche: string;
  location: string;
}

export const EMPTY_CREATOR: CreatorFormValues = {
  name: "",
  age: 25,
  gender: "female",
  appearance: "",
  hair: "",
  eyes: "",
  bodyType: "average",
  style: "casual",
  personality: "",
  niche: "",
  location: "",
};

const BODY_TYPES = ["slim", "petite", "average", "athletic", "curvy", "plus-size", "tall"];
const STYLES = ["casual", "streetwear", "minimal", "luxury", "athletic", "boho", "preppy", "y2k"];
const APPEARANCE_HINTS = ["light skin, freckles", "olive skin, warm brown eyes", "deep brown skin, high cheekbones", "East Asian, soft features", "South Asian, medium brown skin", "tan skin, dimples"];
const HAIR_HINTS = ["long wavy brown", "short black fade", "shoulder-length blonde", "curly dark brown", "auburn bob", "silver pixie"];
const EYE_HINTS = ["brown", "hazel", "green", "blue", "grey"];
const PERSONALITY_HINTS = ["warm, funny, relatable", "calm and aesthetic", "confident, energetic", "honest reviewer, detail-oriented"];
const NICHE_HINTS = ["streetwear for Gen Z", "minimal capsule wardrobes", "fitness & athleisure", "affordable luxury", "sustainable fashion"];

export function CreatorForm({
  initial = EMPTY_CREATOR,
  submitLabel,
  onSubmit,
  busy,
  error,
}: {
  initial?: CreatorFormValues;
  submitLabel: string;
  onSubmit: (v: CreatorFormValues) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [v, setV] = useState<CreatorFormValues>(initial);
  const set = <K extends keyof CreatorFormValues>(k: K, value: CreatorFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const text = (k: keyof CreatorFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_110px_160px]">
        <Field label="Name">
          <input className="input" required maxLength={40} value={v.name} onChange={text("name")} placeholder="e.g. Ava" />
        </Field>
        <Field label="Age">
          <input className="input" type="number" min={18} max={80} required value={v.age} onChange={(e) => set("age", Number(e.target.value))} />
        </Field>
        <Field label="Gender">
          <select className="input" value={v.gender} onChange={text("gender")}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
          </select>
        </Field>
      </div>

      <Field label="Appearance" hint="Skin tone, facial features, ethnicity — describe features, never a real person.">
        <input className="input" required minLength={3} maxLength={240} value={v.appearance} onChange={text("appearance")} placeholder="e.g. olive skin, light freckles, warm smile" />
        <Hints items={APPEARANCE_HINTS} onPick={(h) => set("appearance", h)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hair">
          <input className="input" required value={v.hair} onChange={text("hair")} placeholder="e.g. long wavy brown" />
          <Hints items={HAIR_HINTS} onPick={(h) => set("hair", h)} />
        </Field>
        <Field label="Eyes">
          <input className="input" value={v.eyes} onChange={text("eyes")} placeholder="e.g. hazel" />
          <Hints items={EYE_HINTS} onPick={(h) => set("eyes", h)} />
        </Field>
      </div>

      <Field label="Body type">
        <Chips items={BODY_TYPES} value={v.bodyType} onPick={(x) => set("bodyType", x)} />
      </Field>
      <Field label="Fashion style">
        <Chips items={STYLES} value={v.style} onPick={(x) => set("style", x)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Personality" hint="Shapes expressions, scripts and tone.">
          <input className="input" value={v.personality} onChange={text("personality")} placeholder="e.g. warm, funny, relatable" />
          <Hints items={PERSONALITY_HINTS} onPick={(h) => set("personality", h)} />
        </Field>
        <Field label="Target niche">
          <input className="input" value={v.niche} onChange={text("niche")} placeholder="e.g. streetwear for Gen Z" />
          <Hints items={NICHE_HINTS} onPick={(h) => set("niche", h)} />
        </Field>
      </div>

      <Field label="Location (optional)">
        <input className="input" value={v.location} onChange={text("location")} placeholder="e.g. London" />
      </Field>

      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-[13px] text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>AI creators are fictional people generated from your description. Don&apos;t describe or compare them to celebrities or real individuals.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="brand" size="lg" loading={busy} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-ink-4">{hint}</p>}
    </div>
  );
}

function Hints({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((h) => (
        <button key={h} type="button" onClick={() => onPick(h)} className="rounded-full bg-black/[.04] px-2.5 py-1 text-[12px] text-ink-3 transition hover:bg-black/[.08] hover:text-ink">
          {h}
        </button>
      ))}
    </div>
  );
}

function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <button key={x} type="button" onClick={() => onPick(x)} className={cn("chip capitalize", value === x && "chip-active")}>
          {x}
        </button>
      ))}
    </div>
  );
}
