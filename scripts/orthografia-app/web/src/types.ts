export type ErrorCategory =
  | "ending"
  | "derivation"
  | "root"
  | "stress"
  | "final-sigma"
  | "other";

export interface Morphemes {
  root: string;
  suffix: string;
}

export interface WordEntry {
  id: string;
  word: string;
  grade: number;
  axis: string;
  hintSentence: string;
  feedbackRule: string;
  audioFile: string;
  morphemes: Morphemes;
}

export interface WordsPayload {
  version: number;
  grade: number;
  words: WordEntry[];
}

export interface GraphemeAlignment {
  expected: string;
  actual: string;
  match: boolean;
}

export interface GradeResult {
  isCorrect: boolean;
  stressCorrect: boolean;
  lettersCorrect: boolean;
  alignments: GraphemeAlignment[];
  errorCategory: ErrorCategory | null;
  feedbackRule: string;
}

export interface WordProgress {
  attempts: number;
  correct: number;
  consecutiveCorrect: number;
  needsReview: boolean;
  mastered: boolean;
  lastSeen: string | null;
  intervalDays: number;
  rewrites: number;
}

export interface SessionSummary {
  total: number;
  correct: number;
  wrong: number;
  rewrites: number;
}

export type AppScreen = "home" | "exercise" | "summary";
