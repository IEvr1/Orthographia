import type { SessionSummary as Summary } from "../types";

interface SessionSummaryProps {
  summary: Summary;
  onHome: () => void;
}

export function SessionSummary({ summary, onHome }: SessionSummaryProps) {
  return (
    <main className="screen screen--summary fade-in">
      <div className="summary-card bounce-in">
        <p className="brand">Ορθογραφία</p>
        <h1 className="summary-title">Τέλος αποστολής!</h1>
        <ul className="summary-stats">
          <li>
            <span className="stat-value stat-value--ok">{summary.correct}</span>
            <span className="stat-label">σωστές</span>
          </li>
          <li>
            <span className="stat-value stat-value--bad">{summary.wrong}</span>
            <span className="stat-label">με λάθος</span>
          </li>
          <li>
            <span className="stat-value">{summary.rewrites}</span>
            <span className="stat-label">ξαναέγραψες</span>
          </li>
        </ul>
        <p className="summary-message">
          {summary.correct >= summary.total - 2
            ? "Πολύ καλά! Συνέχισε έτσι!"
            : "Κάθε προσπάθεια σε κάνει καλύτερο. Ξαναδοκίμασε αύριο!"}
        </p>
        <button type="button" className="btn btn-primary btn-xl" onClick={onHome}>
          Αρχική
        </button>
      </div>
    </main>
  );
}
