import type { WordEntry } from "../types";
import { stripStress } from "./normalize";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stressVariants(word: string): string[] {
  const base = stripStress(word);
  const vowels = "αεηιουωΑΕΗΙΟΥΩ";
  const variants: string[] = [];
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (!vowels.includes(ch)) continue;
    const tonosMap: Record<string, string> = {
      α: "ά", ε: "έ", η: "ή", ι: "ί", ο: "ό", υ: "ύ", ω: "ώ",
      Α: "Ά", Ε: "Έ", Η: "Ή", Ι: "Ί", Ο: "Ό", Υ: "Ύ", Ω: "Ώ",
    };
    if (tonosMap[ch]) {
      variants.push(base.slice(0, i) + tonosMap[ch] + base.slice(i + 1));
    }
  }
  if (word.endsWith("ς")) {
    variants.push(word.slice(0, -1) + "σ");
  }
  return variants.filter((v) => v !== word);
}

export function buildChoiceOptions(word: WordEntry, pool: WordEntry[]): string[] {
  const options = new Set<string>([word.word]);
  for (const variant of stressVariants(word.word)) {
    if (options.size >= 4) break;
    options.add(variant);
  }
  const similar = shuffle(pool.filter((w) => w.id !== word.id && stripStress(w.word) === stripStress(word.word)));
  for (const entry of similar) {
    if (options.size >= 4) break;
    options.add(entry.word);
  }
  for (const entry of shuffle(pool)) {
    if (options.size >= 4) break;
    if (entry.word.length >= word.word.length - 1 && entry.word.length <= word.word.length + 2) {
      options.add(entry.word);
    }
  }
  while (options.size < 4) {
    options.add(stripStress(word.word));
    break;
  }
  return shuffle([...options]).slice(0, 4);
}
