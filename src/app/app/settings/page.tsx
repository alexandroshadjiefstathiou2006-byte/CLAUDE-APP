import { Store } from "lucide-react";
import { requireContext } from "@/server/auth";
import { providerSummary } from "@/server/ai/registry";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const { workspace, user } = await requireContext();
  const providers = providerSummary();
  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace, integrations and AI engine." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Workspace</h2>
          <Row k="Brand" v={workspace.name} />
          <Row k="Owner" v={`${user.name} · ${user.email}`} />
          <Row k="Plan" v={workspace.plan[0].toUpperCase() + workspace.plan.slice(1)} />
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Integrations</h2>
          {[
            { name: "Shopify", desc: "Import products, images, variants & URLs" },
            { name: "Meta Ads", desc: "Push creatives straight to Ads Manager" },
            { name: "TikTok Ads", desc: "Upload creatives & read performance" },
          ].map((i) => (
            <div key={i.name} className="flex items-center justify-between rounded-xl border border-line p-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-ink-3" />
                <div><div className="text-sm font-semibold">{i.name}</div><div className="text-[13px] text-ink-4">{i.desc}</div></div>
              </div>
              <Badge>Soon</Badge>
            </div>
          ))}
        </Card>
        <Card className="space-y-4 p-6 lg:col-span-2">
          <h2 className="font-semibold">AI engine</h2>
          <p className="text-sm text-ink-3">Providers are configured by environment variables. &quot;mock&quot; renders previews without calling any AI API.</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(providers).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-canvas p-4">
                <div className="text-[12px] font-medium uppercase tracking-wide text-ink-4">{k}</div>
                <div className="mt-1 flex items-center gap-2 font-semibold capitalize">{v} {v === "mock" && <Badge tone="amber">preview</Badge>}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-ink-3">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
