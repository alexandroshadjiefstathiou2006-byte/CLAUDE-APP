import { Check, Coins } from "lucide-react";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { CREDIT_COSTS } from "@/lib/catalog";
import { requireContext } from "@/server/auth";
import { stripeEnabled } from "@/server/billing/stripe";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PlanButton, PortalButton } from "./billing-actions";

const REASONS: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  subscription_grant: "Monthly plan credits",
  generation: "Generation",
  refund: "Refund (failed generation)",
  manual: "Adjustment",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const { success } = await searchParams;
  const { workspace } = await requireContext();
  const ledger = await db.creditLedger.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 25 });
  const live = stripeEnabled();

  return (
    <div className="space-y-10">
      <PageHeader title="Billing" subtitle="Simple monthly plans. Credits refresh every billing cycle." actions={live && workspace.stripeCustomerId ? <PortalButton /> : null} />

      {success && <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">Payment received — your credits will appear in a moment.</div>}
      {!live && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Stripe isn&apos;t configured.</strong> Add <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code> and price ids to <code>.env</code>. In development, choosing a plan simulates a subscription.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <Card className="p-6 sm:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-3"><Coins className="h-4 w-4 text-amber-500" /> Credit balance</div>
          <div className="mt-2 font-display text-5xl font-bold tabular-nums">{workspace.creditBalance}</div>
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-3">
            Plan: <Badge tone="brand" className="capitalize">{workspace.plan}</Badge>
            {workspace.subscriptionStatus && <Badge>{workspace.subscriptionStatus}</Badge>}
          </div>
          {workspace.currentPeriodEnd && <div className="mt-1 text-[13px] text-ink-4">Renews {workspace.currentPeriodEnd.toLocaleDateString()}</div>}
        </Card>
        <Card className="p-6 sm:col-span-2">
          <div className="text-sm font-medium text-ink-3">What credits buy</div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              ["Photo", `${CREDIT_COSTS.photoStandard} credit`],
              ["High-quality photo", `${CREDIT_COSTS.photoHigh} credits`],
              ["10s video", `${10 * CREDIT_COSTS.videoPerSecond} credits`],
              ["20s video", `${20 * CREDIT_COSTS.videoPerSecond} credits`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-canvas p-3">
                <div className="text-ink-3">{k}</div>
                <div className="mt-0.5 font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-ink-4">Failed generations are refunded automatically.</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = workspace.plan === p.id;
          return (
            <Card key={p.id} className={p.highlighted ? "relative border-ink p-7 ring-1 ring-ink" : "p-7"}>
              {p.highlighted && <span className="absolute -top-3 left-7 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white">Most popular</span>}
              <div className="font-display text-xl font-bold">{p.name}</div>
              <div className="mt-1 text-sm text-ink-3">{p.tagline}</div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">${p.priceMonthly}</span>
                <span className="text-ink-4">/month</span>
              </div>
              <div className="mt-1 text-sm font-medium text-brand">{p.credits.toLocaleString()} credits / month</div>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>)}
              </ul>
              <PlanButton planId={p.id} current={current} highlighted={p.highlighted} live={live} />
            </Card>
          );
        })}
      </div>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Credit history</h2>
        <Card className="divide-y divide-line">
          {ledger.length === 0 && <div className="p-6 text-sm text-ink-3">No activity yet.</div>}
          {ledger.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-6 py-3.5 text-sm">
              <div>
                <div className="font-medium">{REASONS[l.reason] ?? l.reason}</div>
                <div className="text-[12px] text-ink-4">{l.createdAt.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className={l.delta > 0 ? "font-semibold text-emerald-600" : "font-semibold"}>{l.delta > 0 ? `+${l.delta}` : l.delta}</div>
                <div className="text-[12px] text-ink-4">bal. {l.balanceAfter}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
