const GRADE_LABELS: Record<number, string> = {
  1: "Α΄",
  2: "Β΄",
  3: "Γ΄",
  4: "Δ΄",
};

interface HomeScreenProps {
  onStart: () => void;
  masteredCount: number;
  totalWords: number;
  selectedGrade: number;
  availableGrades: Set<number>;
  onGradeChange: (grade: number) => void;
}

export function HomeScreen({
  onStart,
  masteredCount,
  totalWords,
  selectedGrade,
  availableGrades,
  onGradeChange,
}: HomeScreenProps) {
  return (
    <main className="screen screen--home fade-in">
      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά!</h1>
        <p className="hero-sub">Άκου τη λέξη, δες την πρόταση και γράψε την με τον τόνο της.</p>
      </div>

      <div className="grade-picker">
        <p className="section-label">Διάλεξε τάξη</p>
        <div className="grade-options">
          {[1, 2, 3, 4].map((grade) => {
            const active = availableGrades.has(grade);
            const selected = selectedGrade === grade;
            return (
              <button
                key={grade}
                type="button"
                className={`grade-chip${selected ? " grade-chip--active" : ""}`}
                disabled={!active}
                onClick={() => active && onGradeChange(grade)}
              >
                {GRADE_LABELS[grade]}
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-xl" onClick={onStart}>
        Σημερινή αποστολή
      </button>

      {totalWords > 0 && (
        <p className="progress-hint">
          Ξέρεις ήδη {masteredCount} από {totalWords} λέξεις!
        </p>
      )}
    </main>
  );
}
