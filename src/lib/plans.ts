/** Subscription plans. Stripe price ids come from env so pricing can change without code. */
export interface Plan {
  id: "starter" | "growth" | "pro";
  name: string;
  priceMonthly: number;
  credits: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
  stripePriceEnv: string;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    credits: 100,
    tagline: "For new brands testing AI creative.",
    features: ["100 credits / month", "All photo formats", "UGC videos up to 15s", "3 brand creators", "Commercial license"],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 149,
    credits: 500,
    tagline: "For brands running paid social every week.",
    features: ["500 credits / month", "Everything in Starter", "Videos up to 30s", "10 variations per run", "Unlimited brand creators"],
    highlighted: true,
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 399,
    credits: 2000,
    tagline: "For scaling brands and agencies.",
    features: ["2,000 credits / month", "Everything in Growth", "Priority generation queue", "Campaign generator (beta)", "Team seats"],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
];

export const SIGNUP_BONUS_CREDITS = 20;

export const getPlan = (id: string) => PLANS.find((p) => p.id === id);
export const planPriceId = (plan: Plan) => process.env[plan.stripePriceEnv] || "";
export const planForPriceId = (priceId: string) => PLANS.find((p) => planPriceId(p) === priceId);
