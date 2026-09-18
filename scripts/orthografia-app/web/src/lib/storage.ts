import type { WordProgress } from "../types";
import {
  daysUntilDue,
  emptyFsrsSnapshot,
  isDue,
  scheduleReview,
} from "./fsrsProgress";
import { getActiveProfileId } from "./subscription";

const STORAGE_KEY = "orthografia-progress-v2";
const LEGACY_KEY = "orthografia-progress-v1";
const MASTER_THRESHOLD = 3;

export interface ProgressStore {
  words: Record<string, WordProgress>;
  lastSessionDate: string | null;
  deviceId?: string;
  /** Child profile this store belongs to (family plan). */
  profileId?: string | null;
}

export function progressStorageKey(profileId?: string | null): string {
  const id = profileId ?? getActiveProfileId();
  return id ? `${STORAGE_KEY}-${id}` : STORAGE_KEY;
}

function defaultProgress(): WordProgress {
  const fsrs = emptyFsrsSnapshot();
  return {
    attempts: 0,
    correct: 0,
    consecutiveCorrect: 0,
    needsReview: false,
    mastered: false,
    lastSeen: null,
    intervalDays: 1,
    rewrites: 0,
    fsrs,
  };
}

function migrateLegacy(raw: ProgressStore): ProgressStore {
  const words: Record<string, WordProgress> = {};
  for (const [id, prev] of Object.entries(raw.words ?? {})) {
    const fsrs = prev.fsrs ?? emptyFsrsSnapshot(prev.lastSeen ? new Date(prev.lastSeen) : new Date());
    words[id] = { ...prev, fsrs };
  }
  return { ...raw, words };
}

function ensureDeviceId(store: ProgressStore): ProgressStore {
  if (store.deviceId) return store;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}`;
  return { ...store, deviceId: id };
}

function attachProfileId(store: ProgressStore, profileId?: string | null): ProgressStore {
  const active = profileId ?? getActiveProfileId();
  if (!active) return store;
  return { ...store, profileId: active };
}

export function loadProgress(profileId?: string | null): ProgressStore {
  try {
    const key = progressStorageKey(profileId);
    const raw = localStorage.getItem(key);
    if (raw) {
      return ensureDeviceId(attachProfileId(migrateLegacy(JSON.parse(raw) as ProgressStore), profileId));
    }

    if (!profileId && !getActiveProfileId()) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = ensureDeviceId(migrateLegacy(JSON.parse(legacy) as ProgressStore));
        saveProgress(migrated);
        return migrated;
      }
    }

    return ensureDeviceId(attachProfileId({ words: {}, lastSessionDate: null }, profileId));
  } catch {
    return ensureDeviceId(attachProfileId({ words: {}, lastSessionDate: null }, profileId));
  }
}

export function saveProgress(store: ProgressStore, profileId?: string | null): void {
  const key = progressStorageKey(profileId ?? store.profileId);
  const payload = attachProfileId(store, profileId ?? store.profileId);
  localStorage.setItem(key, JSON.stringify(payload));
}

export function getWordProgress(store: ProgressStore, wordId: string): WordProgress {
  return store.words[wordId] ?? defaultProgress();
}

export function isWordDue(store: ProgressStore, wordId: string, now = new Date()): boolean {
  const p = getWordProgress(store, wordId);
  return isDue(p.fsrs, now);
}

export function dueInDays(store: ProgressStore, wordId: string, now = new Date()): number {
  const p = getWordProgress(store, wordId);
  return daysUntilDue(p.fsrs, now);
}

export function recordAttempt(
  store: ProgressStore,
  wordId: string,
  correct: boolean,
  hadRewrite: boolean,
): ProgressStore {
  const next = { ...store, words: { ...store.words } };
  const prev = getWordProgress(next, wordId);
  const now = new Date();
  const fsrs = scheduleReview(prev.fsrs, correct, hadRewrite, now);

  const updated: WordProgress = {
    ...prev,
    attempts: prev.attempts + 1,
    lastSeen: now.toISOString(),
    fsrs,
    intervalDays: Math.max(1, Math.round(daysUntilDue(fsrs, now))),
  };

  if (correct) {
    updated.correct = prev.correct + 1;
    updated.consecutiveCorrect = prev.consecutiveCorrect + 1;
    updated.needsReview = false;
    if (updated.consecutiveCorrect >= MASTER_THRESHOLD && fsrs.stability >= 7) {
      updated.mastered = true;
    }
  } else {
    updated.consecutiveCorrect = 0;
    updated.mastered = false;
    updated.needsReview = true;
    updated.intervalDays = 1;
  }

  if (hadRewrite) {
    updated.rewrites = prev.rewrites + 1;
  }

  next.words[wordId] = updated;
  next.lastSessionDate = now.toISOString().slice(0, 10);
  return next;
}

export function importProgressStore(data: ProgressStore, profileId?: string | null): ProgressStore {
  const targetProfile = profileId ?? data.profileId ?? getActiveProfileId();
  const migrated = ensureDeviceId(attachProfileId(migrateLegacy(data), targetProfile));
  saveProgress(migrated, targetProfile);
  return migrated;
}
