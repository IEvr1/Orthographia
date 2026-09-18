import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./lib/auth";
import { cors } from "./lib/cors";
import { ensureSchema, getSql } from "./lib/db";

const CURRENT_POLICY_VERSION = "privacy-v1";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const auth = await requireAuth(req);
  if (!auth) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT policy_version, consented_at
        FROM parental_consents
        WHERE user_id = ${auth.userId}
        ORDER BY consented_at DESC
        LIMIT 1
      `;
      const row = rows[0];
      const consented = Boolean(row && row.policy_version === CURRENT_POLICY_VERSION);
      return res.status(200).json({
        consented,
        policyVersion: row?.policy_version ?? null,
        consentedAt: row?.consented_at ?? null,
        currentVersion: CURRENT_POLICY_VERSION,
      });
    }

    if (req.method === "POST") {
      const body = req.body as { policyVersion?: string } | undefined;
      const version = body?.policyVersion ?? CURRENT_POLICY_VERSION;
      if (version !== CURRENT_POLICY_VERSION) {
        return res.status(400).json({ error: "unsupported policy version" });
      }

      const ip =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        (req.socket?.remoteAddress ?? null);

      await sql`
        INSERT INTO parental_consents (user_id, policy_version, ip_address)
        VALUES (${auth.userId}, ${version}, ${ip})
        ON CONFLICT (user_id, policy_version) DO NOTHING
      `;

      return res.status(200).json({ ok: true, policyVersion: version });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("[consent-api]", err);
    const message = err instanceof Error ? err.message : "internal error";
    return res.status(500).json({ error: message });
  }
}
