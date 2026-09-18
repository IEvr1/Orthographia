import type { WordEntry } from "../types";
import { countDifficultyMix, resolveWordDifficulty } from "./difficulty";
import { getWordProgress, isWordDue, type ProgressStore } from "./storage";

const NEW_WORDS_COUNT = 8;
const REVIEW_WORDS_COUNT = 2;

/** Target mix for new words in a daily session (within grade). */
const NEW_WORD_TARGETS = { easy: 4, medium: 3, hard: 1 } as const;

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

function pickNewWords(
  candidates: WordEntry[],
  store: ProgressStore,
  count: number,
  exclude: Set<string>,
): WordEntry[] {
  const unmastered = candidates.filter((w) => {
    if (exclude.has(w.id)) return false;
    return !getWordProgress(store, w.id).mastered;
  });

  const byDifficulty: Record<1 | 2 | 3, WordEntry[]> = { 1: [], 2: [], 3: [] };
  for (const word of unmastered) {
    byDifficulty[resolveWordDifficulty(word)].push(word);
  }

  const selected: WordEntry[] = [];
  const targets = { ...NEW_WORD_TARGETS };

  for (const level of [1, 2, 3] as const) {
    const take = Math.min(targets[level === 1 ? "easy" : level === 2 ? "medium" : "hard"], byDifficulty[level].length);
    selected.push(...pickFromBucket(byDifficulty[level], take, exclude));
  }

  if (selected.length < count) {
    const remaining = unmastered.filter((w) => !exclude.has(w.id));
    selected.push(...pickFromBucket(remaining, count - selected.length, exclude));
  }

  if (selected.length < count) {
    const fallback = candidates.filter((w) => !exclude.has(w.id));
    selected.push(...pickFromBucket(fallback, count - selected.length, exclude));
  }

  return selected;
}

function pickReviewWords(
  candidates: WordEntry[],
  store: ProgressStore,
  count: number,
  exclude: Set<string>,
  now: Date,
): WordEntry[] {
  const reviewCandidates = candidates
    .filter((w) => {
      if (exclude.has(w.id)) return false;
      const p = getWordProgress(store, w.id);
      if (p.needsReview) return true;
      if (p.lastSeen && isWordDue(store, w.id, now)) return true;
      return false;
    })
    .sort((a, b) => struggleScore(store, b.id) - struggleScore(store, a.id));

  return pickFromBucket(reviewCandidates, count, exclude);
}

export function buildDailySession(
  allWords: WordEntry[],
  store: ProgressStore,
  grade?: number,
): WordEntry[] {
  const pool = grade != null ? allWords.filter((w) => w.grade === grade) : allWords;
  if (pool.length === 0) return [];

  const now = new Date();
  const exclude = new Set<string>();

  const newWords = pickNewWords(pool, store, NEW_WORDS_COUNT, exclude);
  const reviewWords = pickReviewWords(pool, store, REVIEW_WORDS_COUNT, exclude, now);

  const session = [...newWords, ...reviewWords];
  return shuffle(session).slice(0, NEW_WORDS_COUNT + REVIEW_WORDS_COUNT);
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
