import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../lib/auth";
import { ensureSchema } from "../lib/db";
import { isSuperAdmin } from "../lib/superAdmin";
import { maxProfilesForPlan } from "../lib/stripe";
import {
  deleteChildProfile,
  effectiveTier,
  ensureUser,
  getSubscription,
  isActiveSubscription,
  listChildProfiles,
  upsertChildProfile,
} from "../lib/subscriptions";

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
      const sub = await getSubscription(auth.userId);
      const superAdmin = isSuperAdmin(auth.email);
      if (!superAdmin && !isActiveSubscription(sub)) {
        return res.status(403).json({ error: "subscription required" });
      }

      const profiles = await listChildProfiles(auth.userId);
      const maxProfiles = superAdmin ? maxProfilesForPlan("family") : (sub?.max_profiles ?? 1);
      const id = typeof req.body?.id === "string" ? req.body.id : undefined;
      const name = String(req.body?.name ?? "").trim();
      const grade = Number(req.body?.grade ?? 3);
      const sortOrder = Number(req.body?.sortOrder ?? profiles.length);

      if (!name) return res.status(400).json({ error: "name required" });
      if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
        return res.status(400).json({ error: "invalid grade" });
      }

      const isNew = !id;
      if (isNew && profiles.length >= maxProfiles) {
        return res.status(403).json({ error: "profile limit reached" });
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
      const message = err instanceof Error ? err.message : "internal error";
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === "DELETE") {
    const auth = await requireAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const profileId = typeof req.body?.id === "string" ? req.body.id : "";
    if (!profileId) return res.status(400).json({ error: "id required" });

    try {
      await ensureSchema();
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
