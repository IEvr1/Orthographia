import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import type { PlanTier } from "./access";
import { SUPER_ADMIN_TIER } from "./access";
import {
  cacheTrialStartedAt,
  computeTrialActive,
  computeTrialDaysLeft,
  ensureLocalTrialStarted,
  getCachedTrialStartedAt,
} from "./trial";

const API_BASE = import.meta.env.VITE_PROGRESS_API_URL ?? "/api";

export interface ChildProfile {
  id: string;
  name: string;
  grade: number;
  sortOrder: number;
}

export interface SubscriptionState {
  tier: PlanTier;
  active: boolean;
  planType: PlanTier | "free";
  maxProfiles: number;
  profiles: ChildProfile[];
  currentPeriodEnd: string | null;
  isSuperAdmin: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  error: string | null;
}

const FREE_STATE: SubscriptionState = {
  tier: "free",
  active: false,
  planType: "free",
  maxProfiles: 1,
  profiles: [],
  currentPeriodEnd: null,
  isSuperAdmin: false,
  trialStartedAt: null,
  trialEndsAt: null,
  trialActive: false,
  trialDaysLeft: 0,
  loading: false,
  error: null,
};

function mapProfiles(raw: unknown[]): ChildProfile[] {
  return raw.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      id: String(p.id),
      name: String(p.name),
      grade: Number(p.grade),
      sortOrder: Number(p.sort_order ?? p.sortOrder ?? 0),
    };
  });
}

/** Map raw API auth errors to Greek; keep other server messages as-is. */
function friendlyApiError(error: unknown, status: number): string {
  const raw = typeof error === "string" ? error.trim() : "";
  const normalized = raw.toLowerCase();
  if (
    status === 401 ||
    normalized === "unauthorized" ||
    normalized === "unauthenticated" ||
    normalized === "unauthorized."
  ) {
    return "Απαιτείται σύνδεση";
  }
  return raw || "Αποτυχία";
}

function resolveTrialFromServer(
  userId: string | null | undefined,
  data: Record<string, unknown>,
): Pick<SubscriptionState, "trialStartedAt" | "trialEndsAt" | "trialActive" | "trialDaysLeft"> {
  const started =
    typeof data.trialStartedAt === "string" && data.trialStartedAt
      ? data.trialStartedAt
      : null;

  if (started && userId) {
    cacheTrialStartedAt(userId, started);
    return {
      trialStartedAt: started,
      trialEndsAt:
        typeof data.trialEndsAt === "string" ? data.trialEndsAt : null,
      trialActive: Boolean(data.trialActive),
      trialDaysLeft: Number(data.trialDaysLeft ?? 0),
    };
  }

  // Signed-in but server omitted trial — use per-user local fallback only.
  if (userId) {
    const local = getCachedTrialStartedAt(userId) ?? ensureLocalTrialStarted(userId);
    return {
      trialStartedAt: local,
      trialEndsAt: null,
      trialActive: computeTrialActive(local),
      trialDaysLeft: computeTrialDaysLeft(local),
    };
  }

  return {
    trialStartedAt: null,
    trialEndsAt: null,
    trialActive: false,
    trialDaysLeft: 0,
  };
}

export function useSubscription(): SubscriptionState & {
  refresh: () => Promise<void>;
  startCheckout: (plan: "monthly" | "yearly" | "family") => Promise<string | null>;
  openPortal: () => Promise<string | null>;
} {
  const { getToken, isSignedIn, userId } = useAuth();
  const [state, setState] = useState<SubscriptionState>({ ...FREE_STATE, loading: true });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (!isSignedIn) {
        setState({ ...FREE_STATE, loading: false });
        return;
      }

      const headers: Record<string, string> = {};
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE.replace(/\/$/, "")}/subscription/status`, { headers });
      if (!res.ok) throw new Error("Αποτυχία φόρτωσης συνδρομής");
      const data = await res.json();
      const isSuperAdmin = Boolean(data.isSuperAdmin);
      const trial = resolveTrialFromServer(userId, data);
      setState({
        tier: isSuperAdmin ? SUPER_ADMIN_TIER : (data.tier ?? "free"),
        active: isSuperAdmin ? true : Boolean(data.active),
        planType: isSuperAdmin ? SUPER_ADMIN_TIER : (data.planType ?? "free"),
        maxProfiles: isSuperAdmin ? Math.max(data.maxProfiles ?? 1, 3) : (data.maxProfiles ?? 1),
        profiles: mapProfiles(data.profiles ?? []),
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        isSuperAdmin,
        ...trial,
        loading: false,
        error: null,
      });
    } catch (err) {
      // Keep last good state; if signed in with no trial yet, seed per-user local clock.
      setState((s) => {
        const fallbackTrial =
          isSignedIn && userId
            ? (() => {
                const local = getCachedTrialStartedAt(userId) ?? ensureLocalTrialStarted(userId);
                return {
                  trialStartedAt: local,
                  trialEndsAt: s.trialEndsAt,
                  trialActive: computeTrialActive(local),
                  trialDaysLeft: computeTrialDaysLeft(local),
                };
              })()
            : {
                trialStartedAt: null,
                trialEndsAt: null,
                trialActive: false,
                trialDaysLeft: 0,
              };
        return {
          ...s,
          ...fallbackTrial,
          loading: false,
          error: err instanceof Error ? err.message : "Σφάλμα",
        };
      });
    }
  }, [getToken, isSignedIn, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authedPost = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getToken();
      if (!token) throw new Error("Απαιτείται σύνδεση");
      const res = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyApiError(data.error, res.status));
      return data;
    },
    [getToken],
  );

  const startCheckout = useCallback(
    async (plan: "monthly" | "yearly" | "family") => {
      const data = await authedPost("/stripe/checkout", { plan });
      return (data.url as string | undefined) ?? null;
    },
    [authedPost],
  );

  const openPortal = useCallback(async () => {
    const data = await authedPost("/stripe/portal");
    return (data.url as string | undefined) ?? null;
  }, [authedPost]);

  return { ...state, refresh, startCheckout, openPortal };
}

export const ACTIVE_PROFILE_KEY = "orthografia-active-profile-id";

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  else localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

async function authedRequest(
  getToken: () => Promise<string | null>,
  method: "POST" | "DELETE",
  body: unknown,
): Promise<unknown> {
  const token = await getToken();
  if (!token) throw new Error("Απαιτείται σύνδεση");
  const res = await fetch(`${API_BASE.replace(/\/$/, "")}/subscription/status`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(friendlyApiError(data.error, res.status));
  return data;
}

export async function upsertChildProfile(
  getToken: () => Promise<string | null>,
  params: { id?: string; name: string; grade: number; sortOrder?: number },
): Promise<ChildProfile> {
  const data = await authedRequest(getToken, "POST", {
    action: "upsertProfile",
    ...params,
  }) as { profile: Record<string, unknown> };
  const p = data.profile;
  return {
    id: String(p.id),
    name: String(p.name),
    grade: Number(p.grade),
    sortOrder: Number(p.sort_order ?? p.sortOrder ?? 0),
  };
}

export async function deleteChildProfile(
  getToken: () => Promise<string | null>,
  id: string,
): Promise<void> {
  await authedRequest(getToken, "DELETE", { id });
}

export function isClerkEnabled(): boolean {
  return Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
}
