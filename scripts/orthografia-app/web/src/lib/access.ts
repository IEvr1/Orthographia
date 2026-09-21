import type { GameMode } from "../types";
import { isSuperAdmin } from "./superAdmin";

export type PlanTier = "free" | "child" | "family";

export const SUPER_ADMIN_TIER: PlanTier = "family";

/** Full premium access for the configured super admin email. */
export function resolveTier(tier: PlanTier, email: string | null | undefined): PlanTier {
  return isSuperAdmin(email) ? SUPER_ADMIN_TIER : tier;
}

export function hasPremiumAccess(tier: PlanTier, email: string | null | undefined): boolean {
  return isSuperAdmin(email) || isPaidTier(tier);
}

export const FREE_GRADES = new Set([1, 2]);
export const FREE_DAILY_SESSIONS = 1;

export function isPaidTier(tier: PlanTier): boolean {
  return tier === "child" || tier === "family";
}

export function canAccessGrade(tier: PlanTier, grade: number): boolean {
  if (isPaidTier(tier)) return true;
  return FREE_GRADES.has(grade);
}

export function canAccessMode(tier: PlanTier, mode: GameMode): boolean {
  if (isPaidTier(tier)) return true;
  return mode === "sentence";
}

export function canUseCloudSync(tier: PlanTier): boolean {
  return isPaidTier(tier);
}

export function canAccessWeeklyRule(tier: PlanTier): boolean {
  return isPaidTier(tier);
}

export function tierLabel(tier: PlanTier): string {
  switch (tier) {
    case "child":
      return "Premium";
    case "family":
      return "Οικογενειακό";
    default:
      return "Δωρεάν";
  }
}
