import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../server/auth.js";
import { ensureSchema } from "../../server/db.js";
import { isSuperAdmin } from "../../server/superAdmin.js";
import { maxProfilesForPlan } from "../../server/stripe.js";
import { sanitizeChildName, validateChildName } from "../../server/childName.js";
import {
  deleteChildProfile,
  effectiveTier,
  ensureUser,
  getSubscription,
  isActiveSubscription,
  listChildProfiles,
  upsertChildProfile,
} from "../../server/subscriptions.js";

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("foreign key constraint")) {
    return "Δεν ήταν δυνατή η αποθήκευση. Δοκίμασε ξανά.";
  }
  return "Σφάλμα αποθήκευσης. Δοκίμασε ξανά.";
}

function cors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const auth = await requireAuth(req);
    if (!auth) {
      return res.status(200).json({
        tier: "free",
        active: false,
        planType: "free",
        maxProfiles: 1,
        profiles: [],
        currentPeriodEnd: null,
        isSuperAdmin: false,
      });
    }

    try {
      await ensureSchema();
      await ensureUser(auth.userId, auth.email);

      if (isSuperAdmin(auth.email)) {
        const profiles = await listChildProfiles(auth.userId);
        return res.status(200).json({
          tier: "family",
          active: true,
          planType: "family",
          maxProfiles: maxProfilesForPlan("family"),
          profiles,
          currentPeriodEnd: null,
          isSuperAdmin: true,
        });
      }

      const sub = await getSubscription(auth.userId);
      const tier = effectiveTier(sub);
      const profiles = isActiveSubscription(sub) ? await listChildProfiles(auth.userId) : [];

      return res.status(200).json({
        tier,
        active: isActiveSubscription(sub),
        planType: sub?.plan_type ?? "free",
        maxProfiles: sub?.max_profiles ?? 1,
        profiles,
        currentPeriodEnd: sub?.current_period_end ?? null,
        isSuperAdmin: false,
      });
    } catch (err) {
      console.error("[subscription/status]", err);
      const message = err instanceof Error ? err.message : "internal error";
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === "POST") {
    const auth = await requireAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const action = req.body?.action as string | undefined;
    if (action !== "upsertProfile") {
      return res.status(400).json({ error: "invalid action" });
    }

    try {
      await ensureSchema();
      await ensureUser(auth.userId, auth.email);

      const sub = await getSubscription(auth.userId);
      const superAdmin = isSuperAdmin(auth.email);
      if (!superAdmin && !isActiveSubscription(sub)) {
        return res.status(403).json({ error: "Απαιτείται ενεργή συνδρομή." });
      }

      const profiles = await listChildProfiles(auth.userId);
      const maxProfiles = superAdmin ? maxProfilesForPlan("family") : (sub?.max_profiles ?? 1);
      const id = typeof req.body?.id === "string" ? req.body.id : undefined;
      const name = sanitizeChildName(String(req.body?.name ?? ""));
      const grade = Number(req.body?.grade ?? 3);
      const sortOrder = Number(req.body?.sortOrder ?? profiles.length);

      const nameError = validateChildName(name);
      if (nameError === "name required") {
        return res.status(400).json({ error: "Το όνομα είναι υποχρεωτικό." });
      }
      if (nameError === "name too long") {
        return res.status(400).json({ error: "Το όνομα είναι πολύ μακρύ." });
      }
      if (nameError === "invalid name") {
        return res.status(400).json({ error: "Χρησιμοποίησε μόνο γράμματα (ελληνικά ή αγγλικά)." });
      }
      if (!Number.isInteger(grade) || grade < 2 || grade > 6) {
        return res.status(400).json({ error: "Επίλεξε τάξη από Β΄ έως Στ΄." });
      }

      const isNew = !id;
      if (isNew && profiles.length >= maxProfiles) {
        return res.status(403).json({ error: "Έφτασες το όριο προφίλ." });
      }

      const profile = await upsertChildProfile({
        userId: auth.userId,
        id,
        name,
        grade,
        sortOrder,
      });
      return res.status(200).json({ profile });
    } catch (err) {
      console.error("[subscription/status POST]", err);
      return res.status(500).json({ error: friendlyError(err) });
    }
  }

  if (req.method === "DELETE") {
    const auth = await requireAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const profileId = typeof req.body?.id === "string" ? req.body.id : "";
    if (!profileId) return res.status(400).json({ error: "id required" });

    try {
      await ensureSchema();
      await ensureUser(auth.userId, auth.email);
      const ok = await deleteChildProfile(auth.userId, profileId);
      return res.status(ok ? 200 : 404).json({ ok });
    } catch (err) {
      console.error("[subscription/status DELETE]", err);
      const message = err instanceof Error ? err.message : "internal error";
      return res.status(500).json({ error: message });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
}
