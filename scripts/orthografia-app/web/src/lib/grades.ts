/** School grades offered by the app (Β΄–Στ΄). Grade 1 / Α΄ is not supported. */
export const MIN_GRADE = 2;
export const MAX_GRADE = 6;

export const OFFERED_GRADES = [2, 3, 4, 5, 6] as const;

export type OfferedGrade = (typeof OFFERED_GRADES)[number];

export const GRADE_LABELS: Record<number, string> = {
  2: "Β΄",
  3: "Γ΄",
  4: "Δ΄",
  5: "Ε΄",
  6: "Στ΄",
};

export function isOfferedGrade(grade: number): boolean {
  return Number.isInteger(grade) && grade >= MIN_GRADE && grade <= MAX_GRADE;
}

export function gradeLabel(grade: number): string {
  return GRADE_LABELS[grade] ?? "—";
}
