import type { ErrorCategory, WordEntry } from "../types";
import type { ProgressStore } from "../lib/storage";
import {
  badgeDefsForIds,
  getStreak,
  getUnlockedBadges,
  BADGE_CATALOG,
} from "../lib/streakBadges";
import {
  buildWeaknessReport,
  countMistakeWords,
  masteryStats,
} from "../lib/weakness";
import { GRADE_LABELS } from "../lib/grades";

interface ParentReportScreenProps {
  store: ProgressStore;
  childName?: string | null;
  grade: number;
  words: WordEntry[];
  onBack: () => void;
  onPracticeMistakes: (category?: ErrorCategory | null) => void;
}

export function ParentReportScreen({
  store,
  childName,
  grade,
  words,
  onBack,
  onPracticeMistakes,
}: ParentReportScreenProps) {
  const streak = getStreak(store);
  const unlocked = getUnlockedBadges(store);
  const badges = badgeDefsForIds(unlocked);
  const weakness = buildWeaknessReport(store);
  const mastery = masteryStats(store);
  const mistakeWordCount = countMistakeWords(words, store, grade);
  const canPractice = mistakeWordCount > 0;
  const gradeLabel = GRADE_LABELS[grade] ?? String(grade);

  return (
    <main className="screen screen--report fade-in">
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        <h1 className="lexicon-title">Αναφορά προόδου</h1>
        {childName && <p className="hint-text">για {childName}</p>}
      </header>

      <section className="report-card report-card--cta">
        <h2 className="section-label section-label--strong">Επανάληψη λαθών</h2>
        {canPractice ? (
          <>
            <p className="hint-text">
              {mistakeWordCount} λέξεις ({gradeLabel}) χρειάζονται επανάληψη.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-start"
              onClick={() => onPracticeMistakes(null)}
            >
              Εξάσκησε τα λάθη μου
            </button>
          </>
        ) : (
          <p className="hint-text">
            Δεν υπάρχουν ακόμη λάθη προς επανάληψη. Κάνε μια εξάσκηση πρώτα!
          </p>
        )}
      </section>

      <section className="report-card">
        <h2 className="section-label section-label--strong">Σερί</h2>
        <p className="report-stat">
          Τώρα: <strong>{streak.current}</strong> ημέρες · Ρεκόρ: <strong>{streak.best}</strong>
        </p>
      </section>

      <section className="report-card">
        <h2 className="section-label section-label--strong">Λέξεις</h2>
        <ul className="report-list">
          <li>Δοκιμασμένες: {mastery.attempted}</li>
          <li>Κατακτημένες: {mastery.mastered}</li>
          <li>Χρειάζονται επανάληψη: {mastery.needsReview}</li>
        </ul>
      </section>

      <section className="report-card">
        <h2 className="section-label section-label--strong">Αδυναμίες</h2>
        {weakness.length === 0 ? (
          <p className="hint-text">Δεν υπάρχουν ακόμη καταγεγραμμένα λάθη. Κάνε μερικές ασκήσεις!</p>
        ) : (
          <ul className="weakness-bars">
            {weakness.map((row) => {
              const catWords = countMistakeWords(words, store, grade, row.category);
              return (
                <li key={row.category}>
                  <div className="weakness-row">
                    <span>{row.label}</span>
                    <span>
                      {row.pct}% ({row.count})
                    </span>
                  </div>
                  <div className="reward-bar" aria-hidden="true">
                    <div className="reward-bar__fill" style={{ width: `${row.pct}%` }} />
                  </div>
                  {catWords > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary weakness-practice-btn"
                      onClick={() => onPracticeMistakes(row.category)}
                    >
                      Εξάσκησε: {row.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="report-card">
        <h2 className="section-label section-label--strong">Διακρίσεις</h2>
        <ul className="badge-grid">
          {BADGE_CATALOG.map((b) => {
            const on = unlocked.includes(b.id);
            return (
              <li key={b.id} className={`badge-chip${on ? " badge-chip--on" : ""}`}>
                <strong>{b.title}</strong>
                <span>{b.description}</span>
              </li>
            );
          })}
        </ul>
        {badges.length === 0 && (
          <p className="hint-text">Ολοκλήρωσε μια εξάσκηση για την πρώτη διάκριση.</p>
        )}
      </section>
    </main>
  );
}
