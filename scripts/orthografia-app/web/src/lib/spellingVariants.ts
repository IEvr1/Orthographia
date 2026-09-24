import { stripStress } from "./normalize";

const VOWEL_SWAP: Record<string, string[]> = {
  η: ["ι", "υ", "ει", "οι"],
  ι: ["η", "υ", "ει", "οι"],
  υ: ["η", "ι", "ει", "οι"],
  ει: ["ι", "η", "οι"],
  οι: ["ι", "η", "ει"],
  αι: ["ε"],
  ε: ["αι"],
  ο: ["ω"],
  ω: ["ο"],
};

const CONSONANT_SWAP: Record<string, string[]> = {
  μπ: ["β", "μπ"],
  ντ: ["δ", "ντ"],
  γκ: ["γ", "γκ"],
  β: ["μπ"],
  δ: ["ντ"],
  γ: ["γκ"],
};

const STRESS_MAP: Record<string, string> = {
  α: "ά",
  ε: "έ",
  η: "ή",
  ι: "ί",
  ο: "ό",
  υ: "ύ",
  ω: "ώ",
  Α: "Ά",
  Ε: "Έ",
  Η: "Ή",
  Ι: "Ί",
  Ο: "Ό",
  Υ: "Ύ",
  Ω: "Ώ",
};

function uniquePush(out: string[], value: string, exclude: string) {
  if (value && value !== exclude && !out.includes(value)) out.push(value);
}

/** Wrong-stress variants of a word. */
export function stressVariants(word: string): string[] {
  const base = stripStress(word);
  const variants: string[] = [];
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (!STRESS_MAP[ch]) continue;
    uniquePush(variants, base.slice(0, i) + STRESS_MAP[ch] + base.slice(i + 1), word);
  }
  if (word.endsWith("ς")) {
    uniquePush(variants, word.slice(0, -1) + "σ", word);
  }
  return variants;
}

/** Common Greek orthography distractors (η/ι/υ, ο/ω, final sigma, doubles). */
export function orthographyVariants(word: string, limit = 8): string[] {
  const out: string[] = [];
  const nfc = word.normalize("NFC");

  for (const v of stressVariants(nfc)) {
    uniquePush(out, v, word);
    if (out.length >= limit) return out;
  }

  // Final sigma ↔ σ
  if (nfc.endsWith("ς")) uniquePush(out, nfc.slice(0, -1) + "σ", word);
  if (nfc.endsWith("σ") && nfc.length > 1) uniquePush(out, nfc.slice(0, -1) + "ς", word);

  // Double consonant drop/add
  const doubled = nfc.replace(/(.)\1/u, "$1");
  if (doubled !== nfc) uniquePush(out, doubled, word);
  for (let i = 0; i < nfc.length; i++) {
    const ch = nfc[i];
    if ("βγδζθκλμνξπρσςτφχψ".includes(ch.toLowerCase())) {
      uniquePush(out, nfc.slice(0, i) + ch + nfc.slice(i), word);
      if (out.length >= limit) return out;
    }
  }

  // Vowel / digraph swaps (scan digraphs first)
  let i = 0;
  while (i < nfc.length && out.length < limit) {
    let matched = false;
    for (const digraph of ["ει", "οι", "αι", "ου", "υι", "μπ", "ντ", "γκ", "τσ", "τζ"]) {
      if (nfc.slice(i, i + digraph.length).toLowerCase() === digraph) {
        const swaps = VOWEL_SWAP[digraph] ?? CONSONANT_SWAP[digraph] ?? [];
        for (const swap of swaps) {
          uniquePush(out, nfc.slice(0, i) + swap + nfc.slice(i + digraph.length), word);
        }
        i += digraph.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const ch = nfc[i].toLowerCase();
      const swaps = VOWEL_SWAP[ch] ?? CONSONANT_SWAP[ch] ?? [];
      for (const swap of swaps) {
        if (swap.length === 1) {
          uniquePush(out, nfc.slice(0, i) + swap + nfc.slice(i + 1), word);
        }
      }
      i += 1;
    }
  }

  // Unstressed version
  uniquePush(out, stripStress(nfc), word);

  return out.slice(0, limit);
}

/** One plausible misspelling for error-correction mode. */
export function pickMisspelling(word: string): string {
  const variants = orthographyVariants(word, 12);
  if (variants.length === 0) return stripStress(word) || word + "ς";
  return variants[Math.floor(Math.random() * variants.length)]!;
}

/** Shuffle string graphemes (simple char shuffle; keeps NFC). */
export function scrambleWord(word: string): string {
  const chars = [...word.normalize("NFC")];
  if (chars.length <= 1) return word;
  for (let attempt = 0; attempt < 12; attempt++) {
    const arr = [...chars];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    const scrambled = arr.join("");
    if (scrambled !== word) return scrambled;
  }
  return chars.reverse().join("");
}
