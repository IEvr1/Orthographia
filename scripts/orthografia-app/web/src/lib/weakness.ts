import type { ErrorCategory, GameMode, WordEntry } from "../types";
import type { ProgressStore } from "./storage";
import { getWordProgress } from "./storage";

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  ending: "Καταλήξεις",
  derivation: "Παράγωγα / καταλήξεις",
  root: "Ρίζα λέξης",
  stress: "Τονισμός",
  "final-sigma": "Τελικό σίγμα (ς)",
  other: "Άλλα γράμματα",
};

export function categoryLabel(category: ErrorCategory): string {
  return CATEGORY_LABELS[category];
}

export function recordErrorCategory(
  store: ProgressStore,
  category: ErrorCategory,
): ProgressStore {
  const stats = { ...(store.errorStats ?? {}) };
  stats[category] = (stats[category] ?? 0) + 1;
  return { ...store, errorStats: stats };
}

export interface WeaknessRow {
  category: ErrorCategory;
  label: string;
  count: number;
  pct: number;
}

export function buildWeaknessReport(store: ProgressStore): WeaknessRow[] {
  const stats = store.errorStats ?? {};
  const total = Object.values(stats).reduce((s, n) => s + n, 0);
  if (total === 0) return [];

  return (Object.keys(CATEGORY_LABELS) as ErrorCategory[])
    .map((category) => {
      const count = stats[category] ?? 0;
      return {
        category,
        label: CATEGORY_LABELS[category],
        count,
        pct: Math.round((count / total) * 100),
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function masteryStats(store: ProgressStore): {
  attempted: number;
  mastered: number;
  needsReview: number;
} {
  const words = Object.values(store.words);
  return {
    attempted: words.filter((w) => w.attempts > 0).length,
    mastered: words.filter((w) => w.mastered).length,
    needsReview: words.filter((w) => w.needsReview).length,
  };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function mistakeScore(store: ProgressStore, wordId: string): number {
  const p = getWordProgress(store, wordId);
  const wrongs = Math.max(0, p.attempts - p.correct);
  let score = wrongs * 10;
  if (p.needsReview) score += 50;
  score += p.rewrites * 3;
  score += Math.max(0, 20 - (p.fsrs?.stability ?? 0));
  return score;
}

export const MISTAKE_SESSION_SIZE = 8;

export interface MistakeSessionPlan {
  words: WordEntry[];
  /** Suggested practice mode for this weakness focus. */
  suggestedMode: GameMode;
  banner: string;
  category: ErrorCategory | null;
}

/**
 * Build a short session from words the learner got wrong.
 * Prefers needsReview + lastErrorCategory match; falls back to any struggling words.
 */
export function buildMistakeSession(
  allWords: WordEntry[],
  store: ProgressStore,
  grade: number,
  category: ErrorCategory | null = null,
  count = MISTAKE_SESSION_SIZE,
): MistakeSessionPlan {
  const gradePool = allWords.filter((w) => w.grade === grade);
  const struggling = gradePool.filter((w) => {
    const p = getWordProgress(store, w.id);
    if (p.attempts === 0) return false;
    return p.needsReview || p.correct < p.attempts || p.rewrites > 0;
  });

  const byCategory = category
    ? struggling.filter((w) => getWordProgress(store, w.id).lastErrorCategory === category)
    : [];

  let pool = byCategory.length > 0 ? byCategory : struggling;
  if (pool.length === 0) {
    pool = gradePool.filter((w) => getWordProgress(store, w.id).needsReview);
  }

  pool = [...pool].sort(
    (a, b) => mistakeScore(store, b.id) - mistakeScore(store, a.id),
  );

  const top = pool.slice(0, Math.max(count * 2, count));
  const picked = shuffle(top).slice(0, Math.min(count, top.length));

  const focus = category ?? buildWeaknessReport(store)[0]?.category ?? null;
  const suggestedMode: GameMode = focus === "stress" ? "tonos" : "sentence";
  const label = focus ? categoryLabel(focus) : "τα λάθη σου";
  const banner =
    picked.length === 0
      ? "Δεν βρέθηκαν λέξεις για επανάληψη ακόμη."
      : focus
        ? `Επανάληψη: ${label} (${picked.length} λέξεις)`
        : `Επανάληψη λαθών (${picked.length} λέξεις)`;

  return {
    words: picked,
    suggestedMode,
    banner,
    category: focus,
  };
}

export function countMistakeWords(
  allWords: WordEntry[],
  store: ProgressStore,
  grade: number,
  category: ErrorCategory | null = null,
): number {
  return buildMistakeSession(allWords, store, grade, category, 100).words.length;
}
