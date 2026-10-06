import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, Megaphone, Package, Rocket, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { CreativeThumb, ProductCard } from "@/components/cards";
import { ActiveJobsBanner } from "@/components/active-jobs";

export default async function Dashboard() {
  const { workspace, user } = await requireContext();
  const [products, creatives, creativeCount] = await Promise.all([
    db.product.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { creatives: true } } } }),
    db.creative.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.creative.count({ where: { workspaceId: workspace.id } }),
  ]);
  const firstName = user.name.split(" ")[0];

  const actions = [
    { href: "/app/create?kind=photo", label: "Create Photo", desc: "Model, lifestyle & studio shots", icon: Camera, tint: "bg-violet-50 text-violet-600" },
    { href: "/app/create?kind=video&preset=ugc_ad", label: "Create UGC Video", desc: "Creator-style video with script", icon: Clapperboard, tint: "bg-pink-50 text-pink-600" },
    { href: "/app/create?kind=video&preset=tiktok_ad&count=5", label: "Create Ad", desc: "5 hook variations, ready to test", icon: Megaphone, tint: "bg-amber-50 text-amber-600" },
    { href: "#", label: "Create Campaign", desc: "One product → full campaign", icon: Rocket, tint: "bg-emerald-50 text-emerald-600", soon: true },
  ];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl bg-ink px-8 py-10 text-white sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-brand/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-64 w-64 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="relative max-w-xl">
          <p className="text-sm font-medium text-white/60">Welcome back, {firstName}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-[34px]">What are we creating today?</h1>
          <p className="mt-2 text-[15px] text-white/70">
            {creativeCount > 0 ? `${creativeCount} creatives in your library. ` : ""}
            You have <span className="font-semibold text-white">{workspace.creditBalance} credits</span> available.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/app/create" variant="brand" size="lg"><Sparkles className="h-4 w-4" /> Create Content</ButtonLink>
            <ButtonLink href="/app/products/new" variant="secondary" size="lg" className="border-white/15 bg-white/10 text-white hover:border-white/40">
              <Package className="h-4 w-4" /> Add Product
            </ButtonLink>
          </div>
        </div>
      </section>

      <ActiveJobsBanner />

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} aria-disabled={a.soon} className={a.soon ? "pointer-events-none" : "group"}>
              <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tint}`}><a.icon className="h-5 w-5" /></span>
                  {a.soon ? <Badge>Soon</Badge> : <ArrowRight className="h-4 w-4 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-ink" />}
                </div>
                <div className="mt-4 font-semibold">{a.label}</div>
                <div className="text-[13px] text-ink-3">{a.desc}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent products</h2>
          <Link href="/app/products" className="text-sm font-medium text-ink-3 hover:text-ink">View all</Link>
        </div>
        {products.length === 0 ? (
          <EmptyState icon={<Package className="h-5 w-5" />} title="Add your first product" body="Upload one product photo — we'll analyze its colors, logos and details so every creative stays accurate." action={<ButtonLink href="/app/products/new">+ Add Product</ButtonLink>} />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent creatives</h2>
          <Link href="/app/library" className="text-sm font-medium text-ink-3 hover:text-ink">Open library</Link>
        </div>
        {creatives.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No creatives yet" body="Pick a product, choose an AI creator and a format. Your photos and videos appear here." action={<ButtonLink href="/app/create" variant="brand">Create your first creative</ButtonLink>} />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {creatives.map((c) => <CreativeThumb key={c.id} creative={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}
