import type { RuleDefinition, WordEntry } from "../types";

/** ISO week number (1–53) for stable weekly rotation. */
export function isoWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeeklyRule(rules: RuleDefinition[], grade: number, date = new Date()): RuleDefinition | null {
  const candidates = rules.filter((r) => r.grades.includes(grade));
  if (candidates.length === 0) return null;
  const week = isoWeekNumber(date);
  return candidates[week % candidates.length] ?? null;
}

const ACCENT_RE = /[άέήίόύώΆΈΉΊΌΎΏ]/;

export function wordMatchesRule(word: WordEntry, ruleId: string): boolean {
  if (word.ruleId === ruleId) return true;
  const w = word.word;
  switch (ruleId) {
    case "tonos-basic":
    case "tonos-advanced":
      return ACCENT_RE.test(w);
    case "double-consonant":
      return /(.)\1/u.test(w.normalize("NFD").replace(/\p{M}/gu, ""));
    case "final-sigma":
      return w.includes("σ") || w.endsWith("ς");
    case "homonyms":
      return word.homophone === true;
    case "declension-ending":
    case "theme-suffix":
    case "irregular-declension":
      return word.axis === "R" && (word.morphemes?.suffix?.length ?? 0) > 0;
    case "numerals":
      return /^(ένα|δύο|τρεις|τέσσερα|πέντε|έξι|επτά|οκτώ|εννέα|δέκα)/u.test(w);
    default:
      return false;
  }
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildWeeklyWordSession(
  allWords: WordEntry[],
  rule: RuleDefinition,
  grade: number,
  count = 5,
): WordEntry[] {
  const pool = allWords.filter((w) => w.grade === grade && wordMatchesRule(w, rule.id));
  const picked = shuffle(pool).slice(0, count);
  if (picked.length >= count) return picked;

  const extra = shuffle(
    allWords.filter(
      (w) => w.grade === grade && !picked.some((p) => p.id === w.id) && w.axis === "K",
    ),
  );
  return [...picked, ...extra].slice(0, count);
}
