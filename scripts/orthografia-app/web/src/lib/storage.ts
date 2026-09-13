import type { WordProgress } from "../types";

const STORAGE_KEY = "orthografia-progress-v1";
const MASTER_THRESHOLD = 3;

export interface ProgressStore {
  words: Record<string, WordProgress>;
  lastSessionDate: string | null;
}

function defaultProgress(): WordProgress {
  return {
    attempts: 0,
    correct: 0,
    consecutiveCorrect: 0,
    needsReview: false,
    mastered: false,
    lastSeen: null,
    intervalDays: 1,
    rewrites: 0,
  };
}

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { words: {}, lastSessionDate: null };
    return JSON.parse(raw) as ProgressStore;
  } catch {
    return { words: {}, lastSessionDate: null };
  }
}

export function saveProgress(store: ProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getWordProgress(store: ProgressStore, wordId: string): WordProgress {
  return store.words[wordId] ?? defaultProgress();
}

export function recordAttempt(
  store: ProgressStore,
  wordId: string,
  correct: boolean,
  hadRewrite: boolean,
): ProgressStore {
  const next = { ...store, words: { ...store.words } };
  const prev = getWordProgress(next, wordId);
  const updated: WordProgress = {
    ...prev,
    attempts: prev.attempts + 1,
    lastSeen: new Date().toISOString(),
  };

  if (correct) {
    updated.correct = prev.correct + 1;
    updated.consecutiveCorrect = prev.consecutiveCorrect + 1;
    updated.needsReview = false;
    if (updated.consecutiveCorrect >= MASTER_THRESHOLD) {
      updated.mastered = true;
      updated.intervalDays = Math.min(prev.intervalDays * 2, 30);
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
  return next;
}
