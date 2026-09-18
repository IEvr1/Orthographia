import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export type CheckoutPlan = "monthly" | "yearly" | "family";

export function priceIdForPlan(plan: CheckoutPlan): string {
  const map: Record<CheckoutPlan, string | undefined> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_YEARLY,
    family: process.env.STRIPE_PRICE_FAMILY_YEARLY,
  };
  const priceId = map[plan];
  if (!priceId) throw new Error(`Missing Stripe price env for plan: ${plan}`);
  return priceId;
}

export function planTypeForPrice(priceId: string): "child" | "family" {
  if (priceId === process.env.STRIPE_PRICE_FAMILY_YEARLY) return "family";
  return "child";
}

export function maxProfilesForPlan(planType: "child" | "family"): number {
  return planType === "family" ? 3 : 1;
}
