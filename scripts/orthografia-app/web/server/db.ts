import { neon } from "@neondatabase/serverless";

let schemaReady = false;

export function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(url);
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS device_progress (
      device_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS device_progress_updated_at_idx
    ON device_progress (updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      stripe_customer_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'inactive',
      plan_type TEXT NOT NULL DEFAULT 'free',
      price_id TEXT,
      max_profiles INTEGER NOT NULL DEFAULT 1,
      current_period_end TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_status_idx
    ON subscriptions (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS child_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL DEFAULT 3,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS child_profiles_user_idx
    ON child_profiles (user_id, sort_order)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS parental_consents (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      UNIQUE (user_id, policy_version)
    )
  `;

  schemaReady = true;
}
