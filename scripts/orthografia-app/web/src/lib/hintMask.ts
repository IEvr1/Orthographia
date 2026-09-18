import { stripStress } from "./normalize";

const BLANK = "___";

function normalizeForMatch(text: string): string {
  return stripStress(text.toLowerCase().normalize("NFC"));
}

/** Hide the dictation target word inside the hint sentence. */
export function maskWordInHint(hint: string, word: string): string {
  const target = normalizeForMatch(word);
  if (!target) return hint;

  const chars = [...hint.normalize("NFC")];
  const wordChars = [...word.normalize("NFC")];
  const len = wordChars.length;
  if (len === 0) return hint;

  let out = "";
  let i = 0;

  while (i < chars.length) {
    if (i + len <= chars.length) {
      const slice = chars.slice(i, i + len).join("");
      if (normalizeForMatch(slice) === target) {
        out += BLANK;
        i += len;
        continue;
      }
    }
    out += chars[i];
    i += 1;
  }

  return out;
}
