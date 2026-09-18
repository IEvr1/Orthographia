import type { WordEntry } from "../types";
import { resolveWordDifficulty } from "./difficulty";
import { getWordProgress, isWordDue, type ProgressStore } from "./storage";

export interface GradeProgressStats {
  mastered: number;
  total: number;
  needsReview: number;
  easyMastered: number;
  mediumMastered: number;
  hardMastered: number;
  streakDays: number;
}

export function computeGradeStats(
  store: ProgressStore,
  words: WordEntry[],
  grade: number,
  now = new Date(),
): GradeProgressStats {
  const gradeWords = words.filter((w) => w.grade === grade);
  let mastered = 0;
  let needsReview = 0;
  let easyMastered = 0;
  let mediumMastered = 0;
  let hardMastered = 0;

  for (const word of gradeWords) {
    const p = getWordProgress(store, word.id);
    if (p.mastered) {
      mastered += 1;
      const d = resolveWordDifficulty(word);
      if (d === 1) easyMastered += 1;
      else if (d === 2) mediumMastered += 1;
      else hardMastered += 1;
    }
    if (p.needsReview || isWordDue(store, word.id, now)) {
      needsReview += 1;
    }
  }

  return {
    mastered,
    total: gradeWords.length,
    needsReview,
    easyMastered,
    mediumMastered,
    hardMastered,
    streakDays: computeStreakDays(store.lastSessionDate, now),
  };
}

function computeStreakDays(lastSessionDate: string | null, now: Date): number {
  if (!lastSessionDate) return 0;
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (lastSessionDate === today || lastSessionDate === yesterdayStr) return 1;
  return 0;
}
