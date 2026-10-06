"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";

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
  status?: string;
  identityId?: string | null;
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
        {creator.isBrandCreator && creator.status !== "draft" && <Badge tone="brand" className="absolute left-2.5 top-2.5 bg-white/95 shadow-sm"><Sparkles className="h-3 w-3" /> Brand creator</Badge>}
        {creator.status === "draft" && <Badge tone="amber" className="absolute left-2.5 top-2.5 bg-white/95 shadow-sm">Draft — choose a face</Badge>}
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
  const router = useRouter();
  const { filtered, bar } = useCreatorFilters(creators);
  const [open, setOpen] = useState<CreatorView | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {bar}
        <Button onClick={() => router.push("/app/creators/new")}><Plus className="h-4 w-4" /> Create AI Creator</Button>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((c) => (
          <CreatorCard key={c.id} creator={c} onClick={() => (c.isBrandCreator ? router.push(`/app/creators/${c.id}`) : setOpen(c))} />
        ))}
      </div>
      {filtered.length === 0 && <p className="py-12 text-center text-sm text-ink-3">No creators match these filters.</p>}
      {open && <CreatorModal creator={open} onClose={() => setOpen(null)} />}
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
          {creator.identityId && <p className="mt-2 font-mono text-[12px] text-ink-4">{creator.identityId}</p>}
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

export { Modal };
