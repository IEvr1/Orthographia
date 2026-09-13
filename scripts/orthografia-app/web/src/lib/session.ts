import type { WordEntry } from "../types";
import { getWordProgress, type ProgressStore } from "./storage";

const NEW_WORDS_COUNT = 8;
const REVIEW_WORDS_COUNT = 2;

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildDailySession(allWords: WordEntry[], store: ProgressStore): WordEntry[] {
  const reviewCandidates = allWords.filter((w) => {
    const p = getWordProgress(store, w.id);
    if (p.mastered && daysSince(p.lastSeen) < p.intervalDays) return false;
    if (p.needsReview || p.lastSeen) return true;
    return false;
  });

  const reviewWords = shuffle(reviewCandidates).slice(0, REVIEW_WORDS_COUNT);

  const reviewIds = new Set(reviewWords.map((w) => w.id));
  const newCandidates = allWords.filter((w) => {
    if (reviewIds.has(w.id)) return false;
    const p = getWordProgress(store, w.id);
    return !p.mastered;
  });

  const newWords = shuffle(newCandidates).slice(0, NEW_WORDS_COUNT);

  // Fill up to 10 if not enough non-mastered words
  const selected = [...newWords];
  const selectedIds = new Set(selected.map((w) => w.id));

  if (selected.length < NEW_WORDS_COUNT) {
    for (const w of shuffle(allWords)) {
      if (selectedIds.has(w.id)) continue;
      selected.push(w);
      selectedIds.add(w.id);
      if (selected.length >= NEW_WORDS_COUNT) break;
    }
  }

  const session = [...selected, ...reviewWords.filter((w) => !selectedIds.has(w.id))];
  return shuffle(session).slice(0, NEW_WORDS_COUNT + REVIEW_WORDS_COUNT);
}
