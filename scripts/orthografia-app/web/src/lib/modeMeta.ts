import type { FamiliesPayload, GameMode, WordEntry } from "../types";
import { wordsWithFamily } from "./families";
import { stressIndex } from "./normalize";

export const MODE_LABELS: Record<GameMode, string> = {
  sentence: "Πρόταση",
  choice: "Διάλεξε",
  dictation: "Υπαγόρευση",
  "error-fix": "Διόρθωση",
  tonos: "Τονισμός",
  family: "Οικογένεια",
  morphemes: "Μορφήματα",
  scramble: "Ανακάτεμα",
  matching: "Ταίριασμα",
};

export const MODE_ORDER: GameMode[] = [
  "sentence",
  "choice",
  "dictation",
  "error-fix",
  "tonos",
  "family",
  "morphemes",
  "scramble",
  "matching",
];

export const FREE_MODES = new Set<GameMode>(["sentence"]);

/** Filter session pool so the mode has enough usable items. */
export function filterWordsForMode(
  words: WordEntry[],
  mode: GameMode,
  families: FamiliesPayload | null,
): WordEntry[] {
  switch (mode) {
    case "choice":
      return words.filter((w) => w.hintSentence.includes("___"));
    case "family":
      return families ? wordsWithFamily(words, families) : [];
    case "matching":
      return words.filter((w) => Boolean(w.definition?.trim()));
    case "morphemes":
      return words.filter((w) => (w.morphemes?.suffix?.length ?? 0) >= 1);
    case "tonos":
      return words.filter((w) => stressIndex(w.word) >= 0);
    case "dictation":
    case "error-fix":
    case "scramble":
    case "sentence":
    default:
      return words;
  }
}

export function modeAvailableForGrade(
  mode: GameMode,
  gradeWords: WordEntry[],
  families: FamiliesPayload | null,
): boolean {
  const pool = filterWordsForMode(gradeWords, mode, families);
  if (mode === "matching" || mode === "family") return pool.length >= 2;
  return pool.length >= 1;
}
