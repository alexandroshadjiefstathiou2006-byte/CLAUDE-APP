/** Development only: simulate a subscription when Stripe isn't configured, so the full flow can be tried. */
import crypto from "crypto";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { apiHandler, HttpError } from "@/server/auth";
import { grantCreditsOnce } from "@/server/billing/credits";
import { stripeEnabled } from "@/server/billing/stripe";

const Body = z.object({ planId: z.enum(["starter", "growth", "pro"]) });

export const POST = apiHandler(async (ctx, req: Request) => {
  if (process.env.NODE_ENV === "production" || stripeEnabled()) throw new HttpError(404, "Not found");
  const plan = getPlan(Body.parse(await req.json()).planId)!;
  await db.workspace.update({ where: { id: ctx.workspace.id }, data: { plan: plan.id, subscriptionStatus: "active (simulated)" } });
  await grantCreditsOnce(ctx.workspace.id, plan.credits, "subscription_grant", `dev:${crypto.randomUUID()}`);
  return { ok: true };
});
