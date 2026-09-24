import type { VercelRequest, VercelResponse } from "@vercel/node";
import { canAccessOwner, isValidOwnerId } from "../../server/auth.js";
import { cors } from "../../server/cors.js";
import { ensureSchema, getSql } from "../../server/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const raw = req.query.deviceId;
  const ownerId = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  if (!isValidOwnerId(ownerId)) {
    return res.status(400).json({ error: "invalid owner id" });
  }

  if (!(await canAccessOwner(req, ownerId))) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT data FROM device_progress WHERE device_id = ${ownerId}
      `;
      if (rows.length === 0) {
        return res.status(404).json({ error: "no progress" });
      }
      return res.status(200).json(rows[0].data);
    }

    if (req.method === "PUT") {
      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "invalid json" });
      }
      await sql`
        INSERT INTO device_progress (device_id, data, updated_at)
        VALUES (${ownerId}, ${payload}, NOW())
        ON CONFLICT (device_id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("[progress]", err);
    const message = err instanceof Error ? err.message : "internal error";
    const code = message.includes("DATABASE_URL") ? 503 : 500;
    return res.status(code).json({ error: message });
  }
}

