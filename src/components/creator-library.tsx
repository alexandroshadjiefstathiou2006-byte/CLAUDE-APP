"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";
import { ImageDrop } from "./uploader";

export interface CreatorView {
  id: string;
  name: string;
  gender: string;
  age: number;
  appearance: string;
  bodyType: string;
  hair: string;
  style: string;
  location: string;
  categories: string;
  bio: string;
  avatarUrl: string;
  isBrandCreator: boolean;
}

const AGE_BUCKETS = [
  { id: "18-24", min: 18, max: 24 },
  { id: "25-34", min: 25, max: 34 },
  { id: "35-49", min: 35, max: 49 },
  { id: "50+", min: 50, max: 120 },
];

export function useCreatorFilters(creators: CreatorView[]) {
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const styles = useMemo(() => [...new Set(creators.map((c) => c.style))], [creators]);
  const bodies = useMemo(() => [...new Set(creators.map((c) => c.bodyType))], [creators]);
  const filtered = creators.filter((c) => {
    const bucket = AGE_BUCKETS.find((b) => b.id === age);
    return (!gender || c.gender === gender) && (!style || c.style === style) && (!body || c.bodyType === body) && (!bucket || (c.age >= bucket.min && c.age <= bucket.max));
  });
  const bar = (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      <FilterGroup label="Gender" options={["female", "male"]} value={gender} onChange={setGender} />
      <FilterGroup label="Age" options={AGE_BUCKETS.map((b) => b.id)} value={age} onChange={setAge} />
      <FilterGroup label="Style" options={styles} value={style} onChange={setStyle} />
      <FilterGroup label="Body" options={bodies} value={body} onChange={setBody} />
    </div>
  );
  return { filtered, bar };
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12px] font-medium uppercase tracking-wide text-ink-4">{label}</span>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(value === o ? null : o)} className={cn("chip capitalize", value === o && "chip-active")}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function CreatorCard({ creator, selected, onClick }: { creator: CreatorView; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("group w-full text-left", !onClick && "cursor-default")}>
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl border bg-zinc-100 shadow-card transition", selected ? "border-brand ring-4 ring-brand/15" : "border-line group-hover:shadow-lift")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creator.avatarUrl} alt={creator.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        {creator.isBrandCreator && <Badge tone="brand" className="absolute left-2.5 top-2.5 bg-white/95 shadow-sm"><Sparkles className="h-3 w-3" /> Brand creator</Badge>}
        {selected && <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow"><Check className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2.5 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{creator.name}</span>
          <span className="text-[13px] text-ink-4">{creator.age}</span>
        </div>
        <div className="flex items-center gap-1 text-[12px] capitalize text-ink-3">
          {creator.style} · <MapPin className="h-3 w-3" /> {creator.location}
        </div>
      </div>
    </button>
  );
}

export function CreatorLibrary({ creators }: { creators: CreatorView[] }) {
  const { filtered, bar } = useCreatorFilters(creators);
  const [open, setOpen] = useState<CreatorView | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {bar}
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create brand creator</Button>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((c) => <CreatorCard key={c.id} creator={c} onClick={() => setOpen(c)} />)}
      </div>
      {filtered.length === 0 && <p className="py-12 text-center text-sm text-ink-3">No creators match these filters.</p>}
      {open && <CreatorModal creator={open} onClose={() => setOpen(null)} />}
      {creating && <CreateCreatorModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-lift animate-fadein", wide ? "max-w-4xl" : "max-w-xl")}>
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 shadow-card hover:bg-zinc-50" aria-label="Close"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}

function CreatorModal({ creator, onClose }: { creator: CreatorView; onClose: () => void }) {
  const cats: string[] = JSON.parse(creator.categories || "[]");
  return (
    <Modal onClose={onClose} wide>
      <div className="grid sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creator.avatarUrl} alt={creator.name} className="aspect-[4/5] h-full w-full object-cover" />
        <div className="flex flex-col p-8">
          <h2 className="font-display text-3xl font-bold">{creator.name}</h2>
          <p className="mt-1 capitalize text-ink-3">{creator.age} · {creator.gender} · {creator.location}</p>
          <p className="mt-4 text-[15px] text-ink-2">{creator.bio}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <Info label="Appearance" value={creator.appearance} />
            <Info label="Hair" value={creator.hair} />
            <Info label="Body type" value={creator.bodyType} />
            <Info label="Style" value={creator.style} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5">{cats.map((c) => <Badge key={c} className="capitalize">{c}</Badge>)}</div>
          <div className="mt-auto flex gap-2 pt-8">
            <a href={`/app/create?creator=${creator.id}&kind=photo`} className="flex-1"><Button variant="brand" className="w-full">Create photos</Button></a>
            <a href={`/app/create?creator=${creator.id}&kind=video&preset=ugc_ad`} className="flex-1"><Button className="w-full">Create UGC video</Button></a>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-4">{label}</dt>
      <dd className="mt-0.5 capitalize text-ink-2">{value}</dd>
    </div>
  );
}

function CreateCreatorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", gender: "female", age: 26, appearance: "", bodyType: "average", hair: "long brown", style: "casual", location: "", bio: "" });
  const [ref, setRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: k === "age" ? Number(e.target.value) : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/creators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, referenceImageUrl: ref }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create creator");
    router.refresh();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-8">
        <div>
          <h2 className="font-display text-2xl font-bold">Create a brand creator</h2>
          <p className="mt-1 text-sm text-ink-3">Their identity is locked and reused across every product, so your brand has a consistent face.</p>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-5">
          <ImageDrop compact value={ref} onChange={setRef} label="Reference" hint="optional" className="[&>div]:h-[150px]" />
          <div className="space-y-4">
            <div><label className="label">Name</label><input className="input" required value={form.name} onChange={set("name")} placeholder="e.g. Ava" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={set("gender")}><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option></select>
              </div>
              <div><label className="label">Age</label><input type="number" min={18} max={80} className="input" value={form.age} onChange={set("age")} /></div>
            </div>
          </div>
        </div>
        <div><label className="label">Appearance</label><input className="input" required value={form.appearance} onChange={set("appearance")} placeholder="e.g. East Asian, light skin, freckles, warm smile" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Hair</label><input className="input" value={form.hair} onChange={set("hair")} /></div>
          <div><label className="label">Body type</label>
            <select className="input" value={form.bodyType} onChange={set("bodyType")}>{["slim", "petite", "average", "athletic", "curvy", "plus-size", "tall"].map((b) => <option key={b}>{b}</option>)}</select>
          </div>
          <div><label className="label">Style</label>
            <select className="input" value={form.style} onChange={set("style")}>{["casual", "streetwear", "minimal", "luxury", "athletic", "boho"].map((b) => <option key={b}>{b}</option>)}</select>
          </div>
          <div><label className="label">Location</label><input className="input" value={form.location} onChange={set("location")} placeholder="e.g. Paris" /></div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="brand" loading={busy}>Create creator</Button>
        </div>
      </form>
    </Modal>
  );
}

export { Modal };
