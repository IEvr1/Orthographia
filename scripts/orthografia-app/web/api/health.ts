import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe, priceIdForPlan, type CheckoutPlan } from "../server/stripe.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasDb = Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
  const secretRaw = process.env.STRIPE_SECRET_KEY ?? "";
  const secret = secretRaw.trim();
  const priceMonthlyRaw = (process.env.STRIPE_PRICE_MONTHLY ?? "").trim();
  const priceYearlyRaw = (process.env.STRIPE_PRICE_YEARLY ?? "").trim();
  const priceFamilyRaw = (process.env.STRIPE_PRICE_FAMILY_YEARLY ?? "").trim();
  const webhookRaw = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const stripe = {
    secret: Boolean(secret),
    secretLive: secret.startsWith("sk_live_"),
    secretTest: secret.startsWith("sk_test_"),
    secretLen: secret.length,
    secretHasWhitespace: /\s/.test(secretRaw),
    webhook: Boolean(webhookRaw),
    webhookFormat: webhookRaw.startsWith("whsec_"),
    priceMonthly: Boolean(priceMonthlyRaw),
    priceYearly: Boolean(priceYearlyRaw),
    priceFamily: Boolean(priceFamilyRaw),
    priceMonthlyFormat: priceMonthlyRaw.startsWith("price_"),
    priceYearlyFormat: priceYearlyRaw.startsWith("price_"),
    priceFamilyFormat: priceFamilyRaw.startsWith("price_"),
  };
  const stripeReady =
    stripe.secret &&
    stripe.webhook &&
    stripe.priceMonthly &&
    stripe.priceYearly &&
    stripe.priceFamily;

  const body: Record<string, unknown> = { ok: true, db: hasDb, stripe, stripeReady };

  if (req.query.verify === "stripe" && stripe.secret) {
    const plans: CheckoutPlan[] = ["monthly", "yearly", "family"];
    const prices: Record<string, unknown> = {};
    try {
      // Raw probe (bypasses SDK) — checks network + auth
      const probeRes = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const probeText = await probeRes.text();
      let probeHint = "";
      try {
        const j = JSON.parse(probeText) as { error?: { message?: string; type?: string } };
        probeHint = j.error?.message ?? j.error?.type ?? (probeRes.ok ? "authorized" : "unknown");
      } catch {
        probeHint = probeText.slice(0, 80);
      }
      body.stripeProbe = {
        httpStatus: probeRes.status,
        ok: probeRes.ok,
        hint: probeHint,
      };

      const client = getStripe();
      for (const plan of plans) {
        try {
          const id = priceIdForPlan(plan);
          const price = await client.prices.retrieve(id);
          prices[plan] = {
            ok: true,
            active: price.active,
            currency: price.currency,
            unitAmountEur:
              price.unit_amount != null ? (price.unit_amount / 100).toFixed(2) : null,
            interval: price.recurring?.interval ?? null,
          };
        } catch (e) {
          prices[plan] = {
            ok: false,
            error: e instanceof Error ? e.message : "error",
          };
        }
      }
      body.priceVerify = prices;
      body.priceVerifyOk = plans.every((p) => (prices[p] as { ok?: boolean })?.ok);
    } catch (e) {
      body.priceVerifyOk = false;
      body.priceVerifyError = e instanceof Error ? e.message : "error";
    }
  }

  res.status(200).json(body);
}
