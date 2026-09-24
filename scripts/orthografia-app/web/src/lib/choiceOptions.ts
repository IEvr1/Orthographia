import type { WordEntry } from "../types";
import { stripStress } from "./normalize";
import { orthographyVariants, stressVariants } from "./spellingVariants";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Build 4 choice options with orthography-aware distractors. */
export function buildChoiceOptions(word: WordEntry, pool: WordEntry[]): string[] {
  const options = new Set<string>([word.word]);

  for (const variant of orthographyVariants(word.word, 10)) {
    if (options.size >= 4) break;
    options.add(variant);
  }

  for (const variant of stressVariants(word.word)) {
    if (options.size >= 4) break;
    options.add(variant);
  }

  const sameSound = shuffle(
    pool.filter((w) => w.id !== word.id && stripStress(w.word) === stripStress(word.word)),
  );
  for (const entry of sameSound) {
    if (options.size >= 4) break;
    options.add(entry.word);
  }

  const sameFamilyRoot = shuffle(
    pool.filter(
      (w) =>
        w.id !== word.id &&
        w.morphemes?.root &&
        word.morphemes?.root &&
        w.morphemes.root === word.morphemes.root,
    ),
  );
  for (const entry of sameFamilyRoot) {
    if (options.size >= 4) break;
    options.add(entry.word);
  }

  for (const entry of shuffle(pool)) {
    if (options.size >= 4) break;
    if (
      entry.word.length >= word.word.length - 1 &&
      entry.word.length <= word.word.length + 2
    ) {
      options.add(entry.word);
    }
  }

  while (options.size < 4) {
    options.add(stripStress(word.word));
    break;
  }

  return shuffle([...options]).slice(0, 4);
}

/** Options for tonos-only mode: same letters, different stress. */
export function buildTonosOptions(word: string): string[] {
  const options = new Set<string>([word]);
  for (const v of stressVariants(word)) {
    if (options.size >= 4) break;
    options.add(v);
  }
  const unstressed = stripStress(word);
  if (options.size < 4 && unstressed !== word) options.add(unstressed);
  return shuffle([...options]).slice(0, Math.min(4, options.size));
}
