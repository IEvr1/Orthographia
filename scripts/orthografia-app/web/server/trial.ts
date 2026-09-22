/** Server-side free trial: full content access for a fixed number of days per Clerk user. */

export const TRIAL_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialInfo {
  trialStartedAt: string;
  trialEndsAt: string;
  trialActive: boolean;
  daysLeft: number;
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function trialEndsAt(startedIso: string): Date {
  const end = new Date(startedIso);
  end.setTime(end.getTime() + TRIAL_DAYS * DAY_MS);
  return end;
}

export function buildTrialInfo(startedIso: string, now = new Date()): TrialInfo {
  const ends = trialEndsAt(startedIso);
  const ms = ends.getTime() - now.getTime();
  const trialActive = ms > 0;
  const daysLeft = trialActive ? Math.max(1, Math.ceil(ms / DAY_MS)) : 0;
  return {
    trialStartedAt: startedIso,
    trialEndsAt: ends.toISOString(),
    trialActive,
    daysLeft,
  };
}

export function parseTrialStartedAt(value: unknown): string | null {
  return toIso(value);
}
