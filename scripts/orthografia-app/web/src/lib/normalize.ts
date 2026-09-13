/** Normalize Greek text for comparison: NFC, lowercase, final sigma → σ. */
export function normalizeGreek(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/ς/g, "σ");
}

const STRESSED = "άέήίόύώΐΰ";
const UNSTRESSED_MAP: Record<string, string> = {
  ά: "α",
  έ: "ε",
  ή: "η",
  ί: "ι",
  ό: "ο",
  ύ: "υ",
  ώ: "ω",
  ΐ: "ι",
  ΰ: "υ",
};

export function stripStress(text: string): string {
  const lower = text.toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += UNSTRESSED_MAP[ch] ?? ch;
  }
  return out.normalize("NFC");
}

/** Index of stressed vowel in the string (0-based char index), or -1 if none. */
export function stressIndex(text: string): number {
  const nfc = text.normalize("NFC");
  for (let i = 0; i < nfc.length; i++) {
    if (STRESSED.includes(nfc[i]) || nfc[i] === "ΐ" || nfc[i] === "ΰ") {
      return i;
    }
    const lower = nfc[i].toLowerCase();
    if (STRESSED.includes(lower) || lower === "ΐ" || lower === "ΰ") {
      return i;
    }
  }
  return -1;
}
