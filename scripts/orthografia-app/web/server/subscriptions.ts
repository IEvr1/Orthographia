import { getSql } from "./db.js";
import { maxProfilesForPlan, planTypeForPrice } from "./stripe.js";
import { buildTrialInfo, parseTrialStartedAt, type TrialInfo } from "./trial.js";

export type PlanType = "free" | "child" | "family";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

export interface SubscriptionRow {
  user_id: string;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  plan_type: PlanType;
  price_id: string | null;
  max_profiles: number;
  current_period_end: string | null;
}

export interface ChildProfileRow {
  id: string;
  user_id: string;
  name: string;
  grade: number;
  sort_order: number;
}

export async function ensureUser(userId: string, email: string | null): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO users (user_id, email)
    VALUES (${userId}, ${email})
    ON CONFLICT (user_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email)
  `;
  await sql`
    INSERT INTO subscriptions (user_id, status, plan_type, max_profiles)
    VALUES (${userId}, 'inactive', 'free', 1)
    ON CONFLICT (user_id) DO NOTHING
  `;
}

/**
 * Start the free trial on first authenticated status hit (idempotent).
 * Stored on users.trial_started_at so clearing localStorage cannot reset it.
 */
export async function ensureTrialStarted(userId: string): Promise<TrialInfo> {
  const sql = getSql();
  await sql`
    UPDATE users
    SET trial_started_at = COALESCE(trial_started_at, NOW())
    WHERE user_id = ${userId}
  `;
  const rows = await sql`
    SELECT trial_started_at FROM users WHERE user_id = ${userId}
  `;
  const started = parseTrialStartedAt(rows[0]?.trial_started_at);
  if (!started) {
    // Extremely unlikely if ensureUser ran; fall back to now so the client still gets a clock.
    const nowIso = new Date().toISOString();
    await sql`
      UPDATE users SET trial_started_at = ${nowIso} WHERE user_id = ${userId}
    `;
    return buildTrialInfo(nowIso);
  }
  return buildTrialInfo(started);
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, stripe_subscription_id, status, plan_type, price_id,
           max_profiles, current_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
  `;
  return (rows[0] as SubscriptionRow | undefined) ?? null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE users SET stripe_customer_id = ${customerId}
    WHERE user_id = ${userId}
  `;
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT stripe_customer_id FROM users WHERE user_id = ${userId}
  `;
  return (rows[0]?.stripe_customer_id as string | undefined) ?? null;
}

export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  subscriptionId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  const planType = planTypeForPrice(params.priceId);
  const maxProfiles = maxProfilesForPlan(planType);
  const sql = getSql();

  await sql`
    INSERT INTO subscriptions (
      user_id, stripe_subscription_id, status, plan_type, price_id,
      max_profiles, current_period_end, updated_at
    )
    VALUES (
      ${params.userId},
      ${params.subscriptionId},
      ${params.status},
      ${planType},
      ${params.priceId},
      ${maxProfiles},
      ${params.currentPeriodEnd?.toISOString() ?? null},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      plan_type = EXCLUDED.plan_type,
      price_id = EXCLUDED.price_id,
      max_profiles = EXCLUDED.max_profiles,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
  `;
}

export async function cancelSubscription(userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE subscriptions SET
      status = 'canceled',
      plan_type = 'free',
      max_profiles = 1,
      updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

export async function listChildProfiles(userId: string): Promise<ChildProfileRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, user_id, name, grade, sort_order
    FROM child_profiles
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, created_at ASC
  `;
  return rows as ChildProfileRow[];
}

export async function upsertChildProfile(params: {
  userId: string;
  id?: string;
  name: string;
  grade: number;
  sortOrder: number;
}): Promise<ChildProfileRow> {
  const sql = getSql();
  const id = params.id ?? crypto.randomUUID();
  await sql`
    INSERT INTO child_profiles (id, user_id, name, grade, sort_order)
    VALUES (${id}, ${params.userId}, ${params.name}, ${params.grade}, ${params.sortOrder})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      grade = EXCLUDED.grade,
      sort_order = EXCLUDED.sort_order
  `;
  const rows = await sql`
    SELECT id, user_id, name, grade, sort_order
    FROM child_profiles
    WHERE id = ${id}
  `;
  return rows[0] as ChildProfileRow;
}

export async function deleteChildProfile(userId: string, profileId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM child_profiles
    WHERE id = ${profileId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export function isActiveSubscription(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  return row.status === "active" || row.status === "past_due";
}

export function effectiveTier(row: SubscriptionRow | null): PlanType {
  if (!isActiveSubscription(row)) return "free";
  return row!.plan_type === "family" ? "family" : "child";
}
