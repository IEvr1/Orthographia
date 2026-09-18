-- Run once in Neon (Vercel Storage → Postgres) or via `npm run db:init`
CREATE TABLE IF NOT EXISTS device_progress (
  device_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_progress_updated_at_idx
  ON device_progress (updated_at DESC);
