import { apiHandler, HttpError } from "@/server/auth";
import { stripe } from "@/server/billing/stripe";

export const POST = apiHandler(async (ctx) => {
  const s = stripe();
  if (!s) throw new HttpError(503, "Billing is not configured");
  if (!ctx.workspace.stripeCustomerId) throw new HttpError(400, "No billing account yet — choose a plan first");
  const session = await s.billingPortal.sessions.create({
    customer: ctx.workspace.stripeCustomerId,
    return_url: `${process.env.APP_URL ?? "http://localhost:3000"}/app/billing`,
  });
  return { url: session.url };
});
