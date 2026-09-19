import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../server/auth.js";
import { ensureSchema } from "../../server/db.js";
import { getStripeCustomerId } from "../../server/subscriptions.js";
import { getStripe } from "../../server/stripe.js";

function cors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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

  try {
    await ensureSchema();
    const customerId = await getStripeCustomerId(auth.userId);
    if (!customerId) {
      return res.status(404).json({ error: "no customer" });
    }

    const stripe = getStripe();
    const origin = appOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    const message = err instanceof Error ? err.message : "internal error";
    return res.status(500).json({ error: message });
  }
}
