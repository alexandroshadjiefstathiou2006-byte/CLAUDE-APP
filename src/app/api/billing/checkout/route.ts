import { z } from "zod/v4";
import { db } from "@/lib/db";
import { getPlan, planPriceId } from "@/lib/plans";
import { apiHandler, HttpError } from "@/server/auth";
import { stripe } from "@/server/billing/stripe";

const Body = z.object({ planId: z.enum(["starter", "growth", "pro"]) });

export const POST = apiHandler(async (ctx, req: Request) => {
  const s = stripe();
  if (!s) throw new HttpError(503, "Billing is not configured (set STRIPE_SECRET_KEY)");
  const { planId } = Body.parse(await req.json());
  const plan = getPlan(planId)!;
  const price = planPriceId(plan);
  if (!price) throw new HttpError(503, `Set ${plan.stripePriceEnv} to the Stripe price id`);

  let customerId = ctx.workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({ email: ctx.user.email, name: ctx.workspace.name, metadata: { workspaceId: ctx.workspace.id } });
    customerId = customer.id;
    await db.workspace.update({ where: { id: ctx.workspace.id }, data: { stripeCustomerId: customerId } });
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    metadata: { workspaceId: ctx.workspace.id, planId },
    subscription_data: { metadata: { workspaceId: ctx.workspace.id, planId } },
    success_url: `${appUrl}/app/billing?success=1`,
    cancel_url: `${appUrl}/app/billing`,
    allow_promotion_codes: true,
  });
  return { url: session.url };
});
