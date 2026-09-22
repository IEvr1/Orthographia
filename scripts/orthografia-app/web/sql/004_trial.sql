-- Free trial start timestamp per Clerk user (run via ensureSchema / db:init)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
