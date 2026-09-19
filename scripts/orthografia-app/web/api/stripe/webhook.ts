import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { ensureSchema } from "../../server/db.js";
import {
  cancelSubscription,
  ensureUser,
  upsertSubscriptionFromStripe,
} from "../../server/subscriptions.js";
import { getStripe } from "../../server/stripe.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function mapStatus(status: Stripe.Subscription.Status): string {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "inactive";
}

function clerkUserIdFromCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer || typeof customer === "string" || customer.deleted) return null;
  return customer.metadata?.clerkUserId ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId =
    subscription.metadata.clerkUserId ?? clerkUserIdFromCustomer(subscription.customer);

  if (!userId) {
    console.warn("[stripe/webhook] missing clerkUserId on subscription", subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  if (!priceId) return;

  const periodEnd = item?.current_period_end;
  await ensureUser(userId, null);
  await upsertSubscriptionFromStripe({
    userId,
    subscriptionId: subscription.id,
    status: mapStatus(subscription.status),
    priceId,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET is not configured" });
  }

  try {
    await ensureSchema();
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).json({ error: "missing stripe-signature" });
    }

    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(
      new Uint8Array(rawBody),
      signature,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.clerkUserId;
        if (userId && typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.clerkUserId;
        if (userId) await cancelSubscription(userId);
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook]", err);
    const message = err instanceof Error ? err.message : "internal error";
    return res.status(400).json({ error: message });
  }
}
