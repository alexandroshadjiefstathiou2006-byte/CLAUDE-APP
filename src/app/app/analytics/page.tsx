import { BarChart3, Film, ImageIcon, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function AnalyticsPage() {
  const { workspace } = await requireContext();
  const [photos, videos, products, spent] = await Promise.all([
    db.creative.count({ where: { workspaceId: workspace.id, kind: "photo" } }),
    db.creative.count({ where: { workspaceId: workspace.id, kind: "video" } }),
    db.product.count({ where: { workspaceId: workspace.id } }),
    db.creditLedger.aggregate({ where: { workspaceId: workspace.id, reason: "generation" }, _sum: { delta: true } }),
  ]);
  const stats = [
    { label: "Photos generated", value: photos, icon: ImageIcon },
    { label: "Videos generated", value: videos, icon: Film },
    { label: "Products", value: products, icon: Package },
    { label: "Credits used", value: -(spent._sum.delta ?? 0), icon: BarChart3 },
  ];
  return (
    <>
      <PageHeader title="Analytics" subtitle="Creative output today — ad performance once Meta & TikTok are connected." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-6">
            <s.icon className="h-5 w-5 text-brand" />
            <div className="mt-4 font-display text-3xl font-bold tabular-nums">{s.value}</div>
            <div className="text-sm text-ink-3">{s.label}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 flex flex-col items-center p-12 text-center">
        <Badge tone="brand">Coming soon</Badge>
        <h2 className="mt-3 font-display text-xl font-semibold">Know which hooks actually sell</h2>
        <p className="mt-2 max-w-md text-sm text-ink-3">Connect Meta Ads and TikTok Ads to see CTR, hook rate and ROAS per creative — and automatically generate more of what works.</p>
      </Card>
    </>
  );
}
