import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Clapperboard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { requireContext } from "@/server/auth";
import type { ProductAnalysis } from "@/server/ai/types";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { CreativeThumb } from "@/components/cards";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeleteProductButton } from "./delete-button";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireContext();
  const product = await db.product.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { creatives: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!product) notFound();
  const analysis = parseJson<ProductAnalysis | null>(product.analysis, null);

  return (
    <div className="space-y-10">
      {product.analysisStatus === "pending" && <AutoRefresh />}
      <Link href="/app/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt={product.name} className="aspect-[4/5] w-full bg-zinc-50 object-contain p-8" />
        </Card>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="capitalize">{product.category}</Badge>
              {product.source === "shopify" && <Badge tone="green">Shopify</Badge>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-3">{product.description}</p>}
            {product.productUrl && (
              <a href={product.productUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                View on store <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/app/create?product=${product.id}&kind=photo`} variant="brand" size="lg"><Camera className="h-4 w-4" /> Create photos</ButtonLink>
            <ButtonLink href={`/app/create?product=${product.id}&kind=video&preset=ugc_ad`} variant="primary" size="lg"><Clapperboard className="h-4 w-4" /> Create UGC video</ButtonLink>
            <DeleteProductButton id={product.id} />
          </div>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold">Product fidelity profile</h2>
              {product.analysisStatus === "pending" && <Badge tone="amber"><Loader2 className="h-3 w-3 animate-spin" /> Analyzing</Badge>}
              {product.analysisStatus === "failed" && <Badge tone="red">Analysis failed</Badge>}
            </div>
            {analysis ? (
              <div className="grid gap-5 text-sm sm:grid-cols-2">
                <Field label="Colors">
                  <div className="flex flex-wrap gap-2">
                    {analysis.colors.map((c) => (
                      <span key={c.hex + c.name} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[12px]">
                        <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c.hex }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label="Materials">{analysis.materials.join(", ") || "—"}</Field>
                <Field label="Logos">{analysis.logos.join("; ") || "—"}</Field>
                <Field label="Fit">{analysis.fit || "—"}</Field>
                {analysis.graphics.length > 0 && <Field label="Graphics">{analysis.graphics.join("; ")}</Field>}
                <Field label="Locked constraints" wide>
                  <ul className="list-disc space-y-1 pl-4 text-ink-2">{analysis.fidelityNotes.map((n) => <li key={n}>{n}</li>)}</ul>
                </Field>
              </div>
            ) : (
              <p className="text-sm text-ink-3">We&apos;re extracting colors, logos, materials and details from your photo…</p>
            )}
          </Card>
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Creatives for this product</h2>
        {product.creatives.length === 0 ? (
          <EmptyState icon={<Camera className="h-5 w-5" />} title="Nothing generated yet" body="Create your first photo or UGC video for this product." action={<ButtonLink href={`/app/create?product=${product.id}`} variant="brand">Create content</ButtonLink>} />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {product.creatives.map((c) => <CreativeThumb key={c.id} creative={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-4">{label}</div>
      <div className="text-ink-2">{children}</div>
    </div>
  );
}
