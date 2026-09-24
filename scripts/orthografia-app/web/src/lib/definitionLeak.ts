import { stripStress } from "./normalize";

function normalizeForMatch(text: string): string {
  return stripStress(text.toLowerCase().normalize("NFC")).replace(/ς/g, "σ");
}

/**
 * True when the headword appears as a whole token inside its definition.
 * Matching exercises must exclude these — the answer is given away.
 */
export function definitionLeaksWord(definition: string, word: string): boolean {
  const w = normalizeForMatch(word.trim());
  const t = normalizeForMatch(definition.trim());
  if (w.length < 2 || !t) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-zα-ω])${escaped}(?![a-zα-ω])`, "u");
  return pattern.test(t);
}

/** Non-empty definition that does not contain the headword. */
export function isUsableMatchingDefinition(
  definition: string | undefined,
  word: string,
): boolean {
  const d = definition?.trim() ?? "";
  if (!d) return false;
  return !definitionLeaksWord(d, word);
}
