import type { WordEntry } from "../types";
import { countDifficultyMix, resolveWordDifficulty } from "./difficulty";
import { getWordProgress, isWordDue, type ProgressStore } from "./storage";

/** Max words per daily practice session. */
export const SESSION_SIZE = 10;
/** Shorter mixed refresh when nothing is due and no new words remain. */
export const REFRESH_SIZE = 6;

/** Target mix for brand-new words within the remaining session slots. */
const NEW_WORD_TARGETS = { easy: 4, medium: 3, hard: 1 } as const;

export type DailySessionMode = "practice" | "refresh";

export interface DailySessionPlan {
  words: WordEntry[];
  mode: DailySessionMode;
  /** Previously seen words that are due / flagged for review in this session. */
  dueCount: number;
  /** Never-attempted words introduced in this session. */
  newCount: number;
  /** Greek hint for Home when the learner is caught up. */
  homeHint: string | null;
  /** Greek banner at session start (refresh sessions). */
  sessionBanner: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prioritizeRuleWords(candidates: WordEntry[]): WordEntry[] {
  const withRule = candidates.filter((w) => w.ruleId);
  const withoutRule = candidates.filter((w) => !w.ruleId);
  return [...shuffle(withRule), ...shuffle(withoutRule)];
}

/** True when the learner has never attempted this word. */
export function isUnseenWord(store: ProgressStore, wordId: string): boolean {
  const p = getWordProgress(store, wordId);
  return !p.lastSeen && p.attempts === 0;
}

/**
 * Previously seen (or wrong) words that should appear today:
 * needsReview flag, or FSRS due date reached.
 * Unseen words are never "due reviews" — they fill new slots instead.
 */
export function isDueReviewWord(
  store: ProgressStore,
  wordId: string,
  now = new Date(),
): boolean {
  if (isUnseenWord(store, wordId)) return false;
  const p = getWordProgress(store, wordId);
  if (p.needsReview) return true;
  return isWordDue(store, wordId, now);
}

function struggleScore(store: ProgressStore, wordId: string): number {
  const p = getWordProgress(store, wordId);
  let score = 0;
  if (p.needsReview) score += 100;
  const stability = p.fsrs?.stability ?? 0;
  score += Math.max(0, 30 - stability);
  if (p.lastSeen && isWordDue(store, wordId)) score += 10;
  return score;
}

function pickFromBucket(
  bucket: WordEntry[],
  count: number,
  exclude: Set<string>,
): WordEntry[] {
  const picked: WordEntry[] = [];
  for (const word of prioritizeRuleWords(bucket)) {
    if (exclude.has(word.id)) continue;
    picked.push(word);
    exclude.add(word.id);
    if (picked.length >= count) break;
  }
  return picked;
}

/**
 * Brand-new words only (never attempted).
 * Does not re-queue recently correct / not-yet-due words, and never falls
 * back to mastered words to pad the session.
 */
function pickNewWords(
  candidates: WordEntry[],
  store: ProgressStore,
  count: number,
  exclude: Set<string>,
): WordEntry[] {
  if (count <= 0) return [];

  const unseen = candidates.filter((w) => {
    if (exclude.has(w.id)) return false;
    return isUnseenWord(store, w.id);
  });

  const byDifficulty: Record<1 | 2 | 3, WordEntry[]> = { 1: [], 2: [], 3: [] };
  for (const word of unseen) {
    byDifficulty[resolveWordDifficulty(word)].push(word);
  }

  const selected: WordEntry[] = [];
  // Scale the 4/3/1 mix when fewer slots remain than a full new-word block.
  const scale = count / (NEW_WORD_TARGETS.easy + NEW_WORD_TARGETS.medium + NEW_WORD_TARGETS.hard);
  const targets = {
    easy: Math.max(0, Math.round(NEW_WORD_TARGETS.easy * scale)),
    medium: Math.max(0, Math.round(NEW_WORD_TARGETS.medium * scale)),
    hard: Math.max(0, Math.round(NEW_WORD_TARGETS.hard * scale)),
  };
  // Ensure we still try to fill `count` after rounding.
  let allocated = targets.easy + targets.medium + targets.hard;
  if (allocated < count) targets.easy += count - allocated;
  if (allocated > count) {
    let overflow = allocated - count;
    for (const key of ["hard", "medium", "easy"] as const) {
      const cut = Math.min(targets[key], overflow);
      targets[key] -= cut;
      overflow -= cut;
      if (overflow <= 0) break;
    }
  }

  for (const level of [1, 2, 3] as const) {
    const key = level === 1 ? "easy" : level === 2 ? "medium" : "hard";
    const take = Math.min(targets[key], byDifficulty[level].length);
    selected.push(...pickFromBucket(byDifficulty[level], take, exclude));
  }

  if (selected.length < count) {
    const remaining = unseen.filter((w) => !exclude.has(w.id));
    selected.push(...pickFromBucket(remaining, count - selected.length, exclude));
  }

  return selected;
}

function pickDueReviewWords(
  candidates: WordEntry[],
  store: ProgressStore,
  count: number,
  exclude: Set<string>,
  now: Date,
): WordEntry[] {
  if (count <= 0) return [];

  const reviewCandidates = candidates
    .filter((w) => {
      if (exclude.has(w.id)) return false;
      return isDueReviewWord(store, w.id, now);
    })
    .sort((a, b) => struggleScore(store, b.id) - struggleScore(store, a.id));

  // Keep struggle order for the top of the list; shuffle only within equal priority via rule bias.
  const picked: WordEntry[] = [];
  for (const word of reviewCandidates) {
    if (exclude.has(word.id)) continue;
    picked.push(word);
    exclude.add(word.id);
    if (picked.length >= count) break;
  }
  return picked;
}

/**
 * Mixed refresh when the grade has no due reviews and no unseen words left.
 * Samples known words (prefer weaker FSRS stability) — not a full re-drill of all correct ones.
 */
function pickRefreshWords(
  candidates: WordEntry[],
  store: ProgressStore,
  count: number,
  exclude: Set<string>,
): WordEntry[] {
  const known = candidates
    .filter((w) => {
      if (exclude.has(w.id)) return false;
      return !isUnseenWord(store, w.id);
    })
    .sort((a, b) => struggleScore(store, b.id) - struggleScore(store, a.id));

  if (known.length === 0) return [];

  // Take a wider candidate pool then shuffle so refresh feels mixed, not always the same weak set.
  const poolSize = Math.min(known.length, Math.max(count * 3, count));
  const pool = shuffle(known.slice(0, poolSize));
  return pickFromBucket(pool, count, exclude);
}

function emptyPlan(): DailySessionPlan {
  return {
    words: [],
    mode: "practice",
    dueCount: 0,
    newCount: 0,
    homeHint: null,
    sessionBanner: null,
  };
}

/**
 * Daily session planner (spaced-repetition mix):
 * 1. Due reviews first (FSRS due / needsReview) — up to SESSION_SIZE.
 * 2. Fill remaining slots with brand-new (unseen) words.
 * 3. Recently correct words appear only when due again — never every day by default.
 * 4. If nothing is due and no new words remain → short refresh sample of known words.
 */
export function planDailySession(
  allWords: WordEntry[],
  store: ProgressStore,
  grade?: number,
): DailySessionPlan {
  const pool = grade != null ? allWords.filter((w) => w.grade === grade) : allWords;
  if (pool.length === 0) return emptyPlan();

  const now = new Date();
  const exclude = new Set<string>();

  const reviewWords = pickDueReviewWords(pool, store, SESSION_SIZE, exclude, now);
  const slotsLeft = SESSION_SIZE - reviewWords.length;
  const newWords = pickNewWords(pool, store, slotsLeft, exclude);

  if (reviewWords.length > 0 || newWords.length > 0) {
    const words = shuffle([...reviewWords, ...newWords]);
    return {
      words,
      mode: "practice",
      dueCount: reviewWords.length,
      newCount: newWords.length,
      homeHint: null,
      sessionBanner: null,
    };
  }

  // Caught up: no due reviews, no unseen words in this grade.
  const refreshWords = pickRefreshWords(pool, store, REFRESH_SIZE, exclude);
  if (refreshWords.length === 0) return emptyPlan();

  return {
    words: shuffle(refreshWords),
    mode: "refresh",
    dueCount: 0,
    newCount: 0,
    homeHint: "Τελείωσες τη σημερινή επανάληψη — εξάσκηση ανανέωσης.",
    sessionBanner: "Τελείωσες τη σημερινή επανάληψη — εξάσκηση ανανέωσης",
  };
}

/** Word list only (same planner as planDailySession). */
export function buildDailySession(
  allWords: WordEntry[],
  store: ProgressStore,
  grade?: number,
): WordEntry[] {
  return planDailySession(allWords, store, grade).words;
}

export function previewDailySessionMix(
  allWords: WordEntry[],
  store: ProgressStore,
  grade?: number,
): ReturnType<typeof countDifficultyMix> {
  return countDifficultyMix(buildDailySession(allWords, store, grade));
}

export function gradesWithWords(words: WordEntry[]): Set<number> {
  const grades = new Set<number>();
  for (const w of words) grades.add(w.grade);
  return grades;
}
