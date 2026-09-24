const SESSIONS_KEY = "orthografia-daily-sessions";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailySessionCount(): number {
  try {
    const data = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}") as Record<string, number>;
    return data[todayKey()] ?? 0;
  } catch {
    return 0;
  }
}

export function incrementDailySessionCount(): void {
  const data = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}") as Record<string, number>;
  const key = todayKey();
  data[key] = (data[key] ?? 0) + 1;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(data));
}

export function canStartDailySession(isPaid: boolean, limit = 1): boolean {
  if (import.meta.env.DEV) return true;
  if (isPaid) return true;
  return getDailySessionCount() < limit;
}
