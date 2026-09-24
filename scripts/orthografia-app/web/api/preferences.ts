import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../server/auth.js";
import { cors } from "../server/cors.js";
import { ensureSchema, getSql } from "../server/db.js";
import { ensureUser } from "../server/subscriptions.js";

function parseBody(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const auth = await requireAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    try {
      await ensureSchema();
      await ensureUser(auth.userId, auth.email);
      const sql = getSql();
      const rows = await sql`
        SELECT weekly_email_opt_in, weekly_email_last_sent_at
        FROM users
        WHERE user_id = ${auth.userId}
      `;
      const row = rows[0] as
        | { weekly_email_opt_in?: boolean; weekly_email_last_sent_at?: string | null }
        | undefined;
      return res.status(200).json({
        weeklyEmailOptIn: Boolean(row?.weekly_email_opt_in),
        weeklyEmailLastSentAt: row?.weekly_email_last_sent_at ?? null,
      });
    } catch (err) {
      console.error("[preferences GET]", err);
      return res.status(500).json({ error: "internal error" });
    }
  }

  if (req.method === "PATCH" || req.method === "POST") {
    const auth = await requireAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const body = parseBody(req.body);
    if (typeof body.weeklyEmailOptIn !== "boolean") {
      return res.status(400).json({ error: "weeklyEmailOptIn required" });
    }

    try {
      await ensureSchema();
      await ensureUser(auth.userId, auth.email);
      const sql = getSql();
      await sql`
        UPDATE users
        SET weekly_email_opt_in = ${body.weeklyEmailOptIn}
        WHERE user_id = ${auth.userId}
      `;
      return res.status(200).json({
        ok: true,
        weeklyEmailOptIn: body.weeklyEmailOptIn,
      });
    } catch (err) {
      console.error("[preferences PATCH]", err);
      return res.status(500).json({ error: "internal error" });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
}
