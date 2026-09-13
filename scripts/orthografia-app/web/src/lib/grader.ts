import type { ErrorCategory, GradeResult, GraphemeAlignment, WordEntry } from "../types";
import { normalizeGreek, stripStress, stressIndex } from "./normalize";

const DIGRAPHS = [
  "τσ",
  "τζ",
  "μπ",
  "ντ",
  "γκ",
  "αι",
  "ει",
  "οι",
  "ου",
  "υι",
] as const;

/** Tokenize Greek word into grapheme units (digraphs count as one). */
export function tokenizeGraphemes(text: string): string[] {
  const normalized = text.normalize("NFC").toLowerCase();
  const tokens: string[] = [];
  let i = 0;

  while (i < normalized.length) {
    let matched = false;
    for (const digraph of DIGRAPHS) {
      if (normalized.slice(i, i + digraph.length) === digraph) {
        tokens.push(digraph);
        i += digraph.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push(normalized[i]);
      i += 1;
    }
  }
  return tokens;
}

function alignGraphemes(expected: string, actual: string): GraphemeAlignment[] {
  const expTokens = tokenizeGraphemes(expected);
  const actTokens = tokenizeGraphemes(actual);
  const maxLen = Math.max(expTokens.length, actTokens.length);
  const alignments: GraphemeAlignment[] = [];

  for (let i = 0; i < maxLen; i++) {
    const e = expTokens[i] ?? "";
    const a = actTokens[i] ?? "";
    const eNorm = normalizeGreek(stripStress(e));
    const aNorm = normalizeGreek(stripStress(a));
    alignments.push({
      expected: e || "—",
      actual: a || "—",
      match: eNorm === aNorm && e !== "" && a !== "",
    });
  }
  return alignments;
}

function hasFinalSigmaIssue(expected: string, actual: string): boolean {
  const expEndsSigma = /ς$/u.test(expected.normalize("NFC"));
  const actEndsSigma = /ς$/u.test(actual.normalize("NFC"));
  const actEndsPlain = /σ$/u.test(normalizeGreek(actual));
  return (
    normalizeGreek(stripStress(expected)) === normalizeGreek(stripStress(actual)) &&
    ((expEndsSigma && !actEndsSigma && actEndsPlain) || (!expEndsSigma && actEndsSigma))
  );
}

function categorizeError(
  entry: WordEntry,
  alignments: GraphemeAlignment[],
  stressWrong: boolean,
  finalSigmaWrong: boolean,
): ErrorCategory {
  if (finalSigmaWrong) return "final-sigma";
  if (stressWrong && alignments.every((a) => a.match || a.expected === "—" || a.actual === "—")) {
    return "stress";
  }

  const mismatchIdx = alignments.findIndex((a) => !a.match);
  if (mismatchIdx === -1) return stressWrong ? "stress" : "other";

  const suffixLen = tokenizeGraphemes(entry.morphemes.suffix).length;
  const rootLen = tokenizeGraphemes(entry.morphemes.root).length;
  const total = alignments.length;

  if (mismatchIdx >= total - suffixLen) return "ending";
  if (mismatchIdx >= rootLen) return "derivation";
  if (mismatchIdx < rootLen) return "root";
  return "other";
}

export function gradeAnswer(entry: WordEntry, userInput: string): GradeResult {
  const expected = entry.word.normalize("NFC");
  const actual = userInput.normalize("NFC");

  const alignments = alignGraphemes(expected, actual);
  const lettersMatch =
    alignments.length > 0 &&
    alignments.every((a) => a.match) &&
    tokenizeGraphemes(expected).length === tokenizeGraphemes(actual).length;

  const expStress = stressIndex(expected);
  const actStress = stressIndex(actual);
  const stressCorrect =
    expStress === -1 ? actStress === -1 : expStress === actStress;

  const finalSigmaWrong = hasFinalSigmaIssue(expected, actual);
  const stressWrong = !stressCorrect;

  const isCorrect = lettersMatch && stressCorrect && !finalSigmaWrong;

  let errorCategory: ErrorCategory | null = null;
  if (!isCorrect) {
    errorCategory = categorizeError(entry, alignments, stressWrong, finalSigmaWrong);
  }

  return {
    isCorrect,
    stressCorrect,
    lettersCorrect: lettersMatch && !finalSigmaWrong,
    alignments,
    errorCategory,
    feedbackRule: entry.feedbackRule,
  };
}
