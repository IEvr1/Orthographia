import type { GameMode } from "../types";
import { OFFERED_GRADES } from "./grades";
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

/** Signed-in free users can access all offered grades (Β΄–Στ΄). */
export const FREE_GRADES = new Set<number>(OFFERED_GRADES);
export const FREE_DAILY_SESSIONS = 1;

export function isPaidTier(tier: PlanTier): boolean {
  return tier === "child" || tier === "family";
}

/** Paid plan or active free trial — unlocks all grades/modes. */
export function hasFullContentAccess(tier: PlanTier, trialActive = false): boolean {
  return isPaidTier(tier) || trialActive;
}

export function canAccessGrade(tier: PlanTier, grade: number, trialActive = false): boolean {
  if (hasFullContentAccess(tier, trialActive)) return true;
  return FREE_GRADES.has(grade);
}

export function canAccessMode(tier: PlanTier, mode: GameMode, trialActive = false): boolean {
  if (hasFullContentAccess(tier, trialActive)) return true;
  return mode === "sentence";
}

/** When auth is enabled, practice requires a signed-in account. */
export function canStartPractice(isSignedIn: boolean, authEnabled: boolean): boolean {
  return !authEnabled || isSignedIn;
}

export function canUseCloudSync(tier: PlanTier): boolean {
  return isPaidTier(tier);
}

export function canAccessWeeklyRule(tier: PlanTier, trialActive = false): boolean {
  return hasFullContentAccess(tier, trialActive);
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
