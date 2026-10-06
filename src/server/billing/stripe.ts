/**
 * Stripe integration. Keys: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_{STARTER,GROWTH,PRO}.
 * Monthly credits are granted on every paid invoice (idempotent per invoice id).
 */
import Stripe from "stripe";
import { db } from "@/lib/db";
import { planForPriceId, type Plan } from "@/lib/plans";
import { grantCreditsOnce } from "./credits";

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

async function activePlanForCustomer(s: Stripe, customerId: string): Promise<{ plan?: Plan; sub?: Stripe.Subscription }> {
  const subs = await s.subscriptions.list({ customer: customerId, status: "all", limit: 5 });
  const sub = subs.data.find((x) => ["active", "trialing", "past_due"].includes(x.status)) ?? subs.data[0];
  const priceId = sub?.items.data[0]?.price.id;
  return { plan: priceId ? planForPriceId(priceId) : undefined, sub };
}

function periodEnd(sub: Stripe.Subscription | undefined) {
  // field moved from subscription to subscription item in newer API versions
  const raw = (sub as unknown as { current_period_end?: number })?.current_period_end ??
    (sub?.items.data[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return raw ? new Date(raw * 1000) : null;
}

export async function handleStripeEvent(event: Stripe.Event) {
  const s = stripe();
  if (!s) return;

  // Idempotency: process each event once
  const seen = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      if (workspaceId && typeof session.customer === "string") {
        await db.workspace.update({
          where: { id: workspaceId },
          data: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
            plan: session.metadata?.planId ?? undefined,
          },
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const plan = planForPriceId(sub.items.data[0]?.price.id ?? "");
      const ended = event.type === "customer.subscription.deleted" || sub.status === "canceled";
      await db.workspace.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          plan: ended ? "free" : (plan?.id ?? undefined),
          currentPeriodEnd: periodEnd(sub),
        },
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId || !invoice.id) break;
      let ws = await db.workspace.findUnique({ where: { stripeCustomerId: customerId } });
      if (!ws) {
        // invoice can arrive before checkout.session.completed — resolve via customer metadata
        const customer = await s.customers.retrieve(customerId);
        const wid = !customer.deleted ? customer.metadata?.workspaceId : undefined;
        if (wid) ws = await db.workspace.update({ where: { id: wid }, data: { stripeCustomerId: customerId } });
      }
      if (!ws) break;
      const { plan, sub } = await activePlanForCustomer(s, customerId);
      if (!plan) break;
      await db.workspace.update({ where: { id: ws.id }, data: { plan: plan.id, subscriptionStatus: sub?.status, currentPeriodEnd: periodEnd(sub) } });
      await grantCreditsOnce(ws.id, plan.credits, "subscription_grant", `stripe_invoice:${invoice.id}`);
      break;
    }
  }

  await db.webhookEvent.create({ data: { id: event.id, provider: "stripe", type: event.type } }).catch(() => {});
}
