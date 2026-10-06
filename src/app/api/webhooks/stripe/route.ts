import { NextResponse } from "next/server";
import { handleStripeEvent, stripe } from "@/server/billing/stripe";

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 }); // Stripe will retry
  }
  return NextResponse.json({ received: true });
}
