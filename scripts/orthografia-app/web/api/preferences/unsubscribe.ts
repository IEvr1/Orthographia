import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, getSql } from "../../server/db.js";
import { verifyUnsubscribeToken } from "../../server/weeklySummary.js";

/**
 * One-click unsubscribe from weekly parent emails.
 * Signed with CRON_SECRET / CLERK_SECRET — no login required.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const u = String(Array.isArray(req.query.u) ? req.query.u[0] : req.query.u ?? "");
  const t = String(Array.isArray(req.query.t) ? req.query.t[0] : req.query.t ?? "");

  const htmlPage = (title: string, body: string) => `<!doctype html>
<html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1a}
a{color:#2a9d8f}</style></head>
<body><h1>${title}</h1><p>${body}</p>
<p><a href="/">Επιστροφή στην Ορθογραφία</a></p></body></html>`;

  if (!u || !verifyUnsubscribeToken(u, t)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(
      htmlPage("Μη έγκυρος σύνδεσμος", "Ο σύνδεσμος διακοπής δεν είναι έγκυρος ή έχει λήξει."),
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`
      UPDATE users
      SET weekly_email_opt_in = FALSE
      WHERE user_id = ${u}
    `;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(
      htmlPage(
        "Διακόπηκε",
        "Δεν θα λαμβάνεις πλέον εβδομαδιαίες συνόψεις στο email. Μπορείς να το ενεργοποιήσεις ξανά από τις Ρυθμίσεις οποιαδήποτε στιγμή.",
      ),
    );
  } catch (err) {
    console.error("[unsubscribe]", err);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(htmlPage("Σφάλμα", "Κάτι πήγε στραβά. Δοκίμασε ξανά αργότερα."));
  }
}
