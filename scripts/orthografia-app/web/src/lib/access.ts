import type { GameMode } from "../types";

export type PlanTier = "free" | "child" | "family";

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
  return mode === "dictation";
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
