import type { FamiliesPayload, WordEntry, WordFamily } from "../types";

/** Resolve family for a word entry; returns null if missing or empty. */
export function resolveFamily(
  word: WordEntry,
  families: FamiliesPayload | null | undefined,
): WordFamily | null {
  if (!families || !word.familyId) return null;
  const family = families[word.familyId];
  if (!family) return null;
  const members = [...new Set([word.word, ...(family.members ?? [])])].filter(Boolean);
  if (members.length === 0) return null;
  return { ...family, members };
}

/** Words that have a usable family with at least one other member. */
export function wordsWithFamily(
  words: WordEntry[],
  families: FamiliesPayload,
): WordEntry[] {
  return words.filter((w) => {
    const fam = resolveFamily(w, families);
    return fam != null && fam.members.some((m) => m !== w.word);
  });
}
