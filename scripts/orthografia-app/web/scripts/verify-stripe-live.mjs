import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY || "";
const report = {
  secretPresent: Boolean(key),
  secretMode: key.startsWith("sk_live_")
    ? "live"
    : key.startsWith("sk_test_")
      ? "test"
      : key
        ? "unknown"
        : "empty",
  webhookPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  webhookLooksValid: (process.env.STRIPE_WEBHOOK_SECRET || "").startsWith(
    "whsec_"
  ),
  prices: {},
  checkoutSessions: {},
};

if (!key) {
  console.log(JSON.stringify({ ...report, verdict: "NO_SECRET" }, null, 2));
  process.exit(2);
}

const stripe = new Stripe(key);

try {
  const acct = await stripe.accounts.retrieve();
  report.account = {
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    details_submitted: acct.details_submitted,
    country: acct.country,
    default_currency: acct.default_currency,
  };
} catch (e) {
  report.account = { error: e.message };
}

const plans = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
  family: process.env.STRIPE_PRICE_FAMILY_YEARLY,
};

for (const [plan, id] of Object.entries(plans)) {
  if (!id) {
    report.prices[plan] = { ok: false, error: "missing env" };
    continue;
  }
  try {
    const price = await stripe.prices.retrieve(id);
    report.prices[plan] = {
      ok: true,
      active: price.active,
      currency: price.currency,
      unitAmountEur:
        price.unit_amount != null ? (price.unit_amount / 100).toFixed(2) : null,
      type: price.type,
      interval: price.recurring?.interval ?? null,
    };
  } catch (e) {
    report.prices[plan] = { ok: false, error: e.message };
  }
}

for (const [plan, id] of Object.entries(plans)) {
  if (!id || !report.prices[plan]?.ok) {
    report.checkoutSessions[plan] = { ok: false, skipped: true };
    continue;
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: id, quantity: 1 }],
      success_url: "https://orthographia.vercel.app/?checkout=success",
      cancel_url: "https://orthographia.vercel.app/?checkout=cancel",
      metadata: { verify: "agent-smoke-test", plan },
    });
    await stripe.checkout.sessions.expire(session.id);
    report.checkoutSessions[plan] = {
      ok: true,
      status: "created_and_expired",
      host: session.url ? new URL(session.url).host : null,
    };
  } catch (e) {
    report.checkoutSessions[plan] = { ok: false, error: e.message };
  }
}

const allPricesOk = Object.values(report.prices).every((p) => p.ok);
const allCheckoutOk = Object.values(report.checkoutSessions).every((p) => p.ok);
report.verdict =
  report.secretMode === "live" &&
  report.account?.charges_enabled &&
  allPricesOk &&
  allCheckoutOk
    ? "PASS_LIVE"
    : report.secretMode === "test" && allPricesOk && allCheckoutOk
      ? "PASS_TEST_ONLY"
      : "FAIL";

console.log(JSON.stringify(report, null, 2));
process.exit(report.verdict.startsWith("PASS") ? 0 : 1);
