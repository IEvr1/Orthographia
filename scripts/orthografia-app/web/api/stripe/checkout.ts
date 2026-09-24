import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../server/auth.js";
import { cors } from "../../server/cors.js";
import { ensureSchema } from "../../server/db.js";
import {
  ensureUser,
  getStripeCustomerId,
  setStripeCustomerId,
} from "../../server/subscriptions.js";
import { getStripe, priceIdForPlan, type CheckoutPlan } from "../../server/stripe.js";

function appOrigin(req: VercelRequest): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: "unauthorized" });

  const plan = (req.body?.plan ?? "") as CheckoutPlan;
  if (!["monthly", "yearly", "family"].includes(plan)) {
    return res.status(400).json({ error: "invalid plan" });
  }

  try {
    await ensureSchema();
    await ensureUser(auth.userId, auth.email);

    const stripe = getStripe();
    let customerId = await getStripeCustomerId(auth.userId);
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.email ?? undefined,
        metadata: { clerkUserId: auth.userId },
      });
      customerId = customer.id;
      await setStripeCustomerId(auth.userId, customerId);
    }

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      client_reference_id: auth.userId,
      metadata: { clerkUserId: auth.userId, plan },
      subscription_data: {
        metadata: { clerkUserId: auth.userId, plan },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    const message = err instanceof Error ? err.message : "internal error";
    return res.status(500).json({ error: message });
  }
}
