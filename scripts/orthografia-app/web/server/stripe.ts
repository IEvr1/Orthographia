import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function envTrim(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getStripe(): Stripe {
  const key = envTrim("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export type CheckoutPlan = "monthly" | "yearly" | "family";

export function priceIdForPlan(plan: CheckoutPlan): string {
  const map: Record<CheckoutPlan, string | undefined> = {
    monthly: envTrim("STRIPE_PRICE_MONTHLY"),
    yearly: envTrim("STRIPE_PRICE_YEARLY"),
    family: envTrim("STRIPE_PRICE_FAMILY_YEARLY"),
  };
  const priceId = map[plan];
  if (!priceId) throw new Error(`Missing Stripe price env for plan: ${plan}`);
  return priceId;
}

export function planTypeForPrice(priceId: string): "child" | "family" {
  if (priceId === envTrim("STRIPE_PRICE_FAMILY_YEARLY")) return "family";
  return "child";
}

export function maxProfilesForPlan(planType: "child" | "family"): number {
  return planType === "family" ? 3 : 1;
}
