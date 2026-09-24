import type { ErrorCategory, SessionSummary } from "../types";
import type { ProgressStore } from "./storage";

export interface StreakState {
  current: number;
  best: number;
  lastDate: string | null;
}

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
}

export const BADGE_CATALOG: BadgeDef[] = [
  { id: "first-session", title: "Πρώτο βήμα", description: "Ολοκλήρωσες την πρώτη εξάσκηση" },
  { id: "streak-3", title: "Σερί 3", description: "Εξάσκηση 3 μέρες στη σειρά" },
  { id: "streak-7", title: "Σερί 7", description: "Εβδομάδα χωρίς διακοπή" },
  { id: "perfect-session", title: "Άψογος", description: "Όλες σωστές σε μία συνεδρία" },
  { id: "master-10", title: "10 λέξεις", description: "Κατάκτησες 10 λέξεις" },
  { id: "master-50", title: "50 λέξεις", description: "Κατάκτησες 50 λέξεις" },
  { id: "points-25", title: "25 πόντοι", description: "Έφτασες 25 σωστές στον στόχο" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86_400_000);
}

export function getStreak(store: ProgressStore): StreakState {
  return store.streak ?? { current: 0, best: 0, lastDate: null };
}

/** Call once when a session completes successfully (any attempt). */
export function recordSessionDay(store: ProgressStore, date = todayIso()): ProgressStore {
  const prev = getStreak(store);
  let current = prev.current;
  if (prev.lastDate === date) {
    return store;
  }
  if (prev.lastDate && daysBetween(prev.lastDate, date) === 1) {
    current = prev.current + 1;
  } else {
    current = 1;
  }
  const best = Math.max(prev.best, current);
  return {
    ...store,
    streak: { current, best, lastDate: date },
  };
}

export function getUnlockedBadges(store: ProgressStore): string[] {
  return store.badges ?? [];
}

function unlock(store: ProgressStore, id: string): ProgressStore {
  const badges = new Set(getUnlockedBadges(store));
  if (badges.has(id)) return store;
  badges.add(id);
  return { ...store, badges: [...badges] };
}

export function unlockBadgesAfterSession(
  store: ProgressStore,
  summary: SessionSummary,
): ProgressStore {
  let next = store;
  next = unlock(next, "first-session");
  if (summary.wrong === 0 && summary.correct > 0 && summary.correct === summary.total) {
    next = unlock(next, "perfect-session");
  }
  const streak = getStreak(next);
  if (streak.current >= 3) next = unlock(next, "streak-3");
  if (streak.current >= 7) next = unlock(next, "streak-7");

  const mastered = Object.values(next.words).filter((w) => w.mastered).length;
  if (mastered >= 10) next = unlock(next, "master-10");
  if (mastered >= 50) next = unlock(next, "master-50");

  const points = next.rewardPoints ?? 0;
  if (points >= 25 || Object.values(next.words).reduce((s, w) => s + w.correct, 0) >= 25) {
    next = unlock(next, "points-25");
  }
  return next;
}

export function badgeDefsForIds(ids: string[]): BadgeDef[] {
  return BADGE_CATALOG.filter((b) => ids.includes(b.id));
}

export type { ErrorCategory };
