/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Camera, Check, Clapperboard, Layers, Megaphone, Play, ShieldCheck, Sparkles, Upload, UserRound, Wand2 } from "lucide-react";
import { Logo } from "@/components/sidebar";
import { buttonClass } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { PHOTO_PRESETS, VIDEO_PRESETS } from "@/lib/catalog";

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2"><Logo /><span className="font-display text-lg font-bold">Studio</span></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-3 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#formats" className="hover:text-ink">Formats</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonClass("ghost", "sm")}>Log in</Link>
            <Link href="/signup" className={buttonClass("primary", "sm")}>Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand/20 via-fuchsia-300/20 to-amber-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[13px] font-medium text-ink-2 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> The AI creative studio for fashion & e-commerce brands
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-[68px]">
            Turn One Product Into Hundreds of Ad Creatives.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-3 sm:text-xl">
            Generate realistic product photos, UGC videos and social ads with AI — without hiring models, photographers or creators.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={buttonClass("brand", "lg", "h-14 px-8 text-base")}>Create Your First Creative <ArrowRight className="h-4 w-4" /></Link>
            <a href="#how" className={buttonClass("secondary", "lg", "h-14 px-6 text-base")}><Play className="h-4 w-4" /> See how it works</a>
          </div>
          <p className="mt-4 text-[13px] text-ink-4">20 free credits · no card required</p>

          <BeforeAfter />
        </div>
      </section>

      {/* Workflow */}
      <section id="how" className="border-t border-line bg-canvas py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-4xl font-bold tracking-tight">Upload once. Create forever.</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-3">The whole workflow takes under a minute. No prompts, no design skills.</p>
          <div className="mt-14 grid gap-4 md:grid-cols-4">
            {[
              { icon: Upload, title: "Upload product", body: "One photo. We lock in exact colors, logos, prints and materials." },
              { icon: UserRound, title: "Choose AI creator", body: "Pick a model or your own brand creator with a consistent face." },
              { icon: Wand2, title: "Generate", body: "Photos, UGC videos, hooks and scripts — 10 variations in one click." },
              { icon: Layers, title: "Get photos + videos + ads", body: "Download and publish to TikTok, Reels, Shorts and Meta." },
            ].map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><s.icon className="h-5 w-5" /></span>
                  <span className="font-display text-sm font-bold text-ink-4">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[13px] font-bold uppercase tracking-wider">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-3">{s.body}</p>
                {i < 3 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border border-line bg-white p-1 text-ink-3 md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Your product, exactly", body: "We analyze every logo, print and color and enforce them on every generation. No warped logos, no wrong shades." },
            { icon: UserRound, title: "Consistent AI creators", body: "Build a brand creator once and feature them across every product and campaign — same face, every time." },
            { icon: Megaphone, title: "Built for ad testing", body: "Generate 10 variations that change hook, creator, location, angle and CTA so you find winners faster." },
          ].map((v) => (
            <div key={v.title} className="rounded-3xl bg-canvas p-8">
              <v.icon className="h-6 w-6 text-brand" />
              <h3 className="mt-5 font-display text-xl font-bold">{v.title}</h3>
              <p className="mt-2 text-ink-3">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formats */}
      <section id="formats" className="border-t border-line bg-canvas py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-4xl font-bold tracking-tight">Every format your ads need</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <FormatList icon={Camera} title="Photos" items={PHOTO_PRESETS.map((p) => p.label)} />
            <FormatList icon={Clapperboard} title="Videos" items={VIDEO_PRESETS.map((p) => p.label)} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-4xl font-bold tracking-tight">Cheaper than one UGC creator</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-3">1 credit per photo · 1 credit per second of video. Cancel anytime.</p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.id} className={`rounded-3xl border p-8 ${p.highlighted ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                <div className="font-display text-xl font-bold">{p.name}</div>
                <div className={`mt-1 text-sm ${p.highlighted ? "text-white/60" : "text-ink-3"}`}>{p.tagline}</div>
                <div className="mt-6 flex items-baseline gap-1"><span className="font-display text-5xl font-bold">${p.priceMonthly}</span><span className={p.highlighted ? "text-white/50" : "text-ink-4"}>/mo</span></div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}
                </ul>
                <Link href="/signup" className={buttonClass(p.highlighted ? "brand" : "secondary", "lg", "mt-8 w-full")}>Get started</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink px-8 py-20 text-center text-white">
          <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand/50 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <h2 className="relative font-display text-4xl font-bold tracking-tight sm:text-5xl">Your next 100 ads start with one photo.</h2>
          <Link href="/signup" className={buttonClass("brand", "lg", "relative mt-8 h-14 px-8 text-base")}>Create Your First Creative <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-line py-10 text-center text-sm text-ink-4">© {new Date().getFullYear()} Studio · AI Creative Studio for E-commerce</footer>
    </div>
  );
}

function FormatList({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
      <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-brand" /><h3 className="font-display text-xl font-bold">{title}</h3></div>
      <div className="mt-6 flex flex-wrap gap-2">{items.map((i) => <span key={i} className="chip">{i}</span>)}</div>
    </div>
  );
}

/** PRODUCT IMAGE → AI MODEL PHOTO → UGC VIDEO → AD CREATIVE */
function BeforeAfter() {
  const Arrow = () => <ArrowRight className="hidden h-5 w-5 shrink-0 text-ink-4 md:block" />;
  return (
    <div className="mx-auto mt-16 flex max-w-5xl flex-col items-center gap-4 md:flex-row md:items-end md:justify-center">
      <Tile label="Product image">
        <div className="flex h-full items-center justify-center bg-zinc-100 p-6"><img src="/landing/hoodie.svg" alt="Product" className="max-h-full" /></div>
      </Tile>
      <Arrow />
      <Tile label="AI model photo">
        <div className="relative h-full bg-gradient-to-b from-[#F4E9E1] to-[#E6CFC0]">
          <img src="/landing/creator-sofia.svg" alt="AI model" className="absolute inset-0 h-full w-full object-cover" />
          <img src="/landing/hoodie.svg" alt="" className="absolute bottom-[-14%] left-1/2 w-[86%] -translate-x-1/2" />
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold">Sofia · London</span>
        </div>
      </Tile>
      <Arrow />
      <Tile label="UGC video" tall>
        <div className="relative h-full bg-gradient-to-b from-[#EDE7F8] to-[#D3C6F2]">
          <img src="/landing/creator-maya.svg" alt="UGC creator" className="absolute inset-0 h-full w-full object-cover" />
          <img src="/landing/hoodie.svg" alt="" className="absolute bottom-[-10%] left-1/2 w-[92%] -translate-x-1/2" />
          <div className="absolute inset-x-2 top-[18%] rounded-md bg-white px-2 py-1.5 text-[11px] font-bold leading-tight shadow">Okay, I wasn&apos;t expecting this hoodie to fit this well…</div>
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><Play className="h-3 w-3 fill-white" /></span>
        </div>
      </Tile>
      <Arrow />
      <Tile label="Ad creative">
        <div className="relative flex h-full flex-col bg-ink p-3 text-left text-white">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">North Apparel</div>
          <div className="mt-1 font-display text-[17px] font-extrabold leading-tight">The hoodie everyone keeps asking about.</div>
          <img src="/landing/hoodie.svg" alt="" className="mx-auto mt-auto w-[78%]" />
          <span className="mt-2 rounded-md bg-white py-1.5 text-center text-[11px] font-bold text-ink">Shop now →</span>
        </div>
      </Tile>
    </div>
  );
}

function Tile({ label, children, tall }: { label: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className="w-[200px]">
      <div className={`overflow-hidden rounded-2xl border border-line bg-white shadow-lift ${tall ? "h-[300px]" : "h-[250px]"}`}>{children}</div>
      <div className="mt-3 text-[12px] font-bold uppercase tracking-widest text-ink-3">{label}</div>
    </div>
  );
}
