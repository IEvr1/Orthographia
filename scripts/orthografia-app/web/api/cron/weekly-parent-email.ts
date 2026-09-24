import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, getSql } from "../../server/db.js";
import { sendResendEmail } from "../../server/email.js";
import { listChildProfiles } from "../../server/subscriptions.js";
import { buildWeeklyEmail, type ProgressBlob } from "../../server/weeklySummary.js";

function authorizeCron(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // In local/dev without secret, allow only when VERCEL_ENV is unset/development
    if (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development") {
      return true;
    }
    return false;
  }
  const auth = req.headers.authorization ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const header = String(req.headers["x-cron-secret"] ?? "");
  const query = String(Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret ?? "");
  return bearer === secret || header === secret || query === secret;
}

/**
 * Weekly parent progress emails — only for users with weekly_email_opt_in = true.
 * Vercel Cron: GET /api/cron/weekly-parent-email
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    // Only explicit opt-ins with an email address
    const users = await sql`
      SELECT user_id, email
      FROM users
      WHERE weekly_email_opt_in = TRUE
        AND email IS NOT NULL
        AND email <> ''
    `;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of users) {
      const userId = String((row as { user_id: string }).user_id);
      const email = String((row as { email: string }).email).trim();
      if (!email) {
        skipped += 1;
        continue;
      }

      const profiles = await listChildProfiles(userId);
      const progressRows = await sql`
        SELECT device_id, data
        FROM device_progress
        WHERE device_id = ${userId}
           OR device_id LIKE ${`${userId}--%`}
      `;

      const byOwner = new Map<string, ProgressBlob>();
      for (const pr of progressRows) {
        const id = String((pr as { device_id: string }).device_id);
        byOwner.set(id, ((pr as { data: ProgressBlob }).data ?? {}) as ProgressBlob);
      }

      const children: { name: string; progress: ProgressBlob }[] = [];
      if (profiles.length > 0) {
        for (const p of profiles) {
          const key = `${userId}--${p.id}`;
          const progress = byOwner.get(key) ?? byOwner.get(userId) ?? {};
          children.push({ name: p.name, progress });
        }
      } else {
        const progress = byOwner.get(userId) ?? {};
        children.push({ name: "Το παιδί", progress });
      }

      const { subject, text, html } = buildWeeklyEmail({
        parentEmail: email,
        userId,
        children,
      });

      const result = await sendResendEmail({ to: email, subject, text, html });
      if (result.ok) {
        sent += 1;
        await sql`
          UPDATE users
          SET weekly_email_last_sent_at = NOW()
          WHERE user_id = ${userId}
        `;
      } else {
        failed += 1;
        console.error("[weekly-email] failed for", userId, result.error);
      }
    }

    return res.status(200).json({
      ok: true,
      optedIn: users.length,
      sent,
      skipped,
      failed,
    });
  } catch (err) {
    console.error("[weekly-email cron]", err);
    return res.status(500).json({ error: "internal error" });
  }
}
