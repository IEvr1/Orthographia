import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const hasDb = Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
  res.status(200).json({ ok: true, db: hasDb });
}
