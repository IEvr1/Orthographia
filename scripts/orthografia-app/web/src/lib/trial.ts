/** Free trial: full grade/mode access for a fixed number of days, gated on signed-in account. */

export const TRIAL_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function storageKey(userId: string): string {
  return `orthografia-trial-started:${userId}`;
}

export function trialEndsAt(startedIso: string): Date {
  const end = new Date(startedIso);
  end.setTime(end.getTime() + TRIAL_DAYS * DAY_MS);
  return end;
}

export function computeTrialActive(startedIso: string | null | undefined, now = new Date()): boolean {
  if (!startedIso) return false;
  return now.getTime() < trialEndsAt(startedIso).getTime();
}

/** Whole days remaining, including the current day (ceil). 0 when expired/not started. */
export function computeTrialDaysLeft(startedIso: string | null | undefined, now = new Date()): number {
  if (!startedIso) return 0;
  const ms = trialEndsAt(startedIso).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

/** Cache server trial start locally (per Clerk user). Does not start a trial without userId. */
export function cacheTrialStartedAt(userId: string, startedIso: string): void {
  try {
    localStorage.setItem(storageKey(userId), startedIso);
  } catch {
    // ignore quota / private mode
  }
}

export function getCachedTrialStartedAt(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/**
 * Offline / API-error fallback for a signed-in user only.
 * Different accounts do not share the same trial clock.
 */
export function ensureLocalTrialStarted(userId: string, now = new Date()): string {
  const existing = getCachedTrialStartedAt(userId);
  if (existing) return existing;
  const started = now.toISOString();
  cacheTrialStartedAt(userId, started);
  return started;
}
