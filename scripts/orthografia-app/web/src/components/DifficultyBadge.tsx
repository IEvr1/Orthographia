import type { WordEntry } from "../types";
import { DIFFICULTY_LABELS, resolveWordDifficulty } from "../lib/difficulty";

interface DifficultyBadgeProps {
  word: WordEntry;
}

export function DifficultyBadge({ word }: DifficultyBadgeProps) {
  const level = resolveWordDifficulty(word);
  return (
    <span className={`difficulty-badge difficulty-badge--${level}`} title={DIFFICULTY_LABELS[level]}>
      {DIFFICULTY_LABELS[level]}
    </span>
  );
}
