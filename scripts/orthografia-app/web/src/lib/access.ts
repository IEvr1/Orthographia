import type { GameMode } from "../types";
import { OFFERED_GRADES } from "./grades";
import { isSuperAdmin } from "./superAdmin";

export type PlanTier = "free" | "child" | "family";

export const SUPER_ADMIN_TIER: PlanTier = "family";

/** Explicit opt-in only — never auto-bypass in Vite DEV mode. */
function accessBypassEnabled(): boolean {
  return import.meta.env.VITE_BYPASS_ACCESS === "1" || import.meta.env.VITE_BYPASS_ACCESS === "true";
}

/** Full premium access for the configured super admin email. */
export function resolveTier(tier: PlanTier, email: string | null | undefined): PlanTier {
  return isSuperAdmin(email) ? SUPER_ADMIN_TIER : tier;
}

export function hasPremiumAccess(tier: PlanTier, email: string | null | undefined): boolean {
  return isSuperAdmin(email) || isPaidTier(tier);
}

/** @deprecated No free practice tier — kept for grade picker fallbacks while trial/paid. */
export const FREE_GRADES = new Set<number>(OFFERED_GRADES);

export function isPaidTier(tier: PlanTier): boolean {
  return tier === "child" || tier === "family";
}

/** Paid plan or active free trial — unlocks practice and all grades/modes. */
export function hasFullContentAccess(tier: PlanTier, trialActive = false): boolean {
  return isPaidTier(tier) || trialActive;
}

/**
 * Access stages (when Clerk is enabled):
 * 1) Signed out → no practice (must sign in)
 * 2) Signed in + trial active → full practice
 * 3) Signed in + trial expired + free → no practice (must purchase)
 * 4) Signed in + paid → full practice
 */
export function evaluateAccess(input: {
  isSignedIn: boolean;
  authEnabled: boolean;
  tier: PlanTier;
  trialActive?: boolean;
  bypass?: boolean;
}): {
  needsSignIn: boolean;
  needsPurchase: boolean;
  canPractice: boolean;
  canAccessContent: boolean;
} {
  const bypass = input.bypass ?? accessBypassEnabled();
  if (bypass) {
    return {
      needsSignIn: false,
      needsPurchase: false,
      canPractice: true,
      canAccessContent: true,
    };
  }

  const trialActive = Boolean(input.trialActive);
  const authOk = !input.authEnabled || input.isSignedIn;
  const contentOk = hasFullContentAccess(input.tier, trialActive);
  const needsSignIn = Boolean(input.authEnabled && !input.isSignedIn);
  const needsPurchase = Boolean(input.isSignedIn && !contentOk);

  return {
    needsSignIn,
    needsPurchase,
    canPractice: authOk && contentOk,
    canAccessContent: contentOk,
  };
}

export function canAccessGrade(tier: PlanTier, grade: number, trialActive = false): boolean {
  void grade;
  if (accessBypassEnabled()) return true;
  return hasFullContentAccess(tier, trialActive);
}

export function canAccessMode(tier: PlanTier, _mode: GameMode, trialActive = false): boolean {
  void _mode;
  if (accessBypassEnabled()) return true;
  return hasFullContentAccess(tier, trialActive);
}

/** When auth is enabled, practice requires a signed-in account. */
export function canStartPractice(isSignedIn: boolean, authEnabled: boolean): boolean {
  return !evaluateAccess({ isSignedIn, authEnabled, tier: "free" }).needsSignIn;
}

/**
 * Practice is allowed only while trial is active or a paid plan is active.
 * After the 5-day trial, free accounts cannot practice until they purchase.
 */
export function canPractice(
  isSignedIn: boolean,
  authEnabled: boolean,
  tier: PlanTier,
  trialActive = false,
): boolean {
  return evaluateAccess({ isSignedIn, authEnabled, tier, trialActive }).canPractice;
}

/** Lexicon follows the same gate as practice (trial or paid). */
export function canAccessLexicon(
  isSignedIn: boolean,
  authEnabled: boolean,
  tier: PlanTier = "free",
  trialActive = false,
): boolean {
  return canPractice(isSignedIn, authEnabled, tier, trialActive);
}

export function canUseCloudSync(tier: PlanTier): boolean {
  return isPaidTier(tier);
}

export function canAccessWeeklyRule(tier: PlanTier, trialActive = false): boolean {
  if (accessBypassEnabled()) return true;
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
