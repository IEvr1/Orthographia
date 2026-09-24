const API_BASE = import.meta.env.VITE_PROGRESS_API_URL ?? "/api";

export interface ParentPreferences {
  weeklyEmailOptIn: boolean;
  weeklyEmailLastSentAt: string | null;
}

async function authHeaders(getToken: () => Promise<string | null>): Promise<HeadersInit> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchPreferences(
  getToken: () => Promise<string | null>,
): Promise<ParentPreferences | null> {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, "")}/preferences`, {
      headers: await authHeaders(getToken),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ParentPreferences;
    return {
      weeklyEmailOptIn: Boolean(data.weeklyEmailOptIn),
      weeklyEmailLastSentAt: data.weeklyEmailLastSentAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function setWeeklyEmailOptIn(
  getToken: () => Promise<string | null>,
  weeklyEmailOptIn: boolean,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, "")}/preferences`, {
      method: "PATCH",
      headers: await authHeaders(getToken),
      body: JSON.stringify({ weeklyEmailOptIn }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
