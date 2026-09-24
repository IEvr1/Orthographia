-- Weekly parent email opt-in (default OFF — never send without consent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_email_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_email_last_sent_at TIMESTAMPTZ;
