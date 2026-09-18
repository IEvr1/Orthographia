import type { WordEntry } from "../types";

export type WordDifficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<WordDifficulty, string> = {
  1: "Εύκολη",
  2: "Μέτρια",
  3: "Δύσκολη",
};

/** Resolve word difficulty with sensible fallbacks when the field is missing. */
export function resolveWordDifficulty(word: WordEntry): WordDifficulty {
  if (word.difficulty === 1 || word.difficulty === 2 || word.difficulty === 3) {
    return word.difficulty;
  }
  if (word.homophone) return 3;
  if (word.ruleId) return 2;
  return 1;
}

export interface DifficultyMix {
  easy: number;
  medium: number;
  hard: number;
}

export function countDifficultyMix(words: WordEntry[]): DifficultyMix {
  const mix: DifficultyMix = { easy: 0, medium: 0, hard: 0 };
  for (const word of words) {
    const d = resolveWordDifficulty(word);
    if (d === 1) mix.easy += 1;
    else if (d === 2) mix.medium += 1;
    else mix.hard += 1;
  }
  return mix;
}

export function formatDifficultyMix(mix: DifficultyMix): string {
  const parts: string[] = [];
  if (mix.easy > 0) parts.push(`${mix.easy} εύκολ${mix.easy === 1 ? "η" : "ες"}`);
  if (mix.medium > 0) parts.push(`${mix.medium} μέτρ${mix.medium === 1 ? "ια" : "ιες"}`);
  if (mix.hard > 0) parts.push(`${mix.hard} δύσκολ${mix.hard === 1 ? "η" : "ες"}`);
  return parts.join(", ");
}
