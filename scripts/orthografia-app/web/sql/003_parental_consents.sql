-- Parental GDPR consent records (Clerk user_id)
CREATE TABLE IF NOT EXISTS parental_consents (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  UNIQUE (user_id, policy_version)
);
