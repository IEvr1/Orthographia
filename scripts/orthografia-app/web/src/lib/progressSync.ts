import type { ProgressStore } from "./storage";
import { importProgressStore, loadProgress, saveProgress } from "./storage";
import { mergeProgressStores } from "./progressMerge";
import { resolveProgressOwnerId } from "./progressOwner";
import { getActiveProfileId } from "./subscription";

/** Same-origin Vercel API by default; override for custom host. */
const API_BASE = import.meta.env.VITE_PROGRESS_API_URL ?? "/api";

export type ProgressAuth = {
  userId?: string | null;
  getToken?: () => Promise<string | null>;
  profileId?: string | null;
};

export function isProgressSyncAvailable(): boolean {
  return Boolean(API_BASE);
}

function progressUrl(ownerId: string): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/progress/${ownerId}`;
}

function resolveOwnerId(auth?: ProgressAuth): string | null {
  const profileId = auth?.profileId ?? getActiveProfileId();
  const store = loadProgress(profileId);
  return resolveProgressOwnerId(auth?.userId, store.deviceId, profileId);
}

async function authHeaders(auth?: ProgressAuth): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth?.getToken) {
    const token = await auth.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchRemoteProgress(auth?: ProgressAuth): Promise<ProgressStore | null> {
  if (!isProgressSyncAvailable()) return null;
  const ownerId = resolveOwnerId(auth);
  if (!ownerId) return null;
  try {
    const res = await fetch(progressUrl(ownerId), {
      headers: await authHeaders(auth),
    });
    if (!res.ok) return null;
    return (await res.json()) as ProgressStore;
  } catch {
    return null;
  }
}

export function exportProgressJson(profileId?: string | null): string {
  const id = profileId ?? getActiveProfileId();
  return JSON.stringify(loadProgress(id), null, 2);
}

export function downloadProgressBackup(profileId?: string | null): void {
  const id = profileId ?? getActiveProfileId();
  const store = loadProgress(id);
  const suffix = id ? `-${id.slice(0, 8)}` : "";
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `orthografia-progress${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importProgressFromJson(text: string, profileId?: string | null): ProgressStore {
  const data = JSON.parse(text) as ProgressStore;
  const targetProfile = profileId ?? data.profileId ?? getActiveProfileId();
  return importProgressStore(data, targetProfile);
}

export async function syncProgressToServer(auth?: ProgressAuth): Promise<boolean> {
  if (!isProgressSyncAvailable()) return false;
  const profileId = auth?.profileId ?? getActiveProfileId();
  const ownerId = resolveOwnerId(auth);
  if (!ownerId) return false;
  const store = loadProgress(profileId);
  try {
    const res = await fetch(progressUrl(ownerId), {
      method: "PUT",
      headers: await authHeaders(auth),
      body: JSON.stringify(store),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchProgressFromServer(auth?: ProgressAuth): Promise<ProgressStore | null> {
  const profileId = auth?.profileId ?? getActiveProfileId();
  const data = await fetchRemoteProgress(auth);
  if (!data) return null;
  saveProgress(importProgressStore(data, profileId), profileId);
  return data;
}

/** Merge local progress with the signed-in user's cloud copy after login. */
export async function migrateProgressOnSignIn(auth: ProgressAuth & { userId: string }): Promise<void> {
  if (!isProgressSyncAvailable()) return;

  const profileId = auth.profileId ?? getActiveProfileId();
  const local = loadProgress(profileId);
  const remote = await fetchRemoteProgress({ ...auth, profileId });
  const merged = remote ? mergeProgressStores(local, remote) : local;
  saveProgress(importProgressStore(merged, profileId), profileId);
  await syncProgressToServer({ ...auth, profileId });
}

/** Migrate default progress and each family child profile after sign-in. */
export async function migrateAllProfilesOnSignIn(
  auth: ProgressAuth & { userId: string },
  profileIds: string[],
): Promise<void> {
  if (!isProgressSyncAvailable()) return;

  const targets = profileIds.length > 0 ? profileIds : [null];
  for (const profileId of targets) {
    await migrateProgressOnSignIn({ ...auth, profileId });
  }
}
