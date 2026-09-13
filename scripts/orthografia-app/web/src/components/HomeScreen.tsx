interface HomeScreenProps {
  onStart: () => void;
  masteredCount: number;
  totalWords: number;
}

export function HomeScreen({ onStart, masteredCount, totalWords }: HomeScreenProps) {
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
          <button type="button" className="grade-chip" disabled>
            Α΄
          </button>
          <button type="button" className="grade-chip" disabled>
            Β΄
          </button>
          <button type="button" className="grade-chip grade-chip--active">
            Γ΄
          </button>
          <button type="button" className="grade-chip" disabled>
            Δ΄
          </button>
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
