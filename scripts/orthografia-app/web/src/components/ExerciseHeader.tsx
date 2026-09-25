import type { ReactNode } from "react";

interface ExerciseHeaderProps {
  onBack: () => void;
  onNext?: () => void;
  /** Show the top-right next arrow (skip / continue). */
  showNext?: boolean;
  children?: ReactNode;
}

export function ExerciseHeader({
  onBack,
  onNext,
  showNext = false,
  children,
}: ExerciseHeaderProps) {
  return (
    <header className="exercise-header">
      <div className="exercise-nav">
        <button
          type="button"
          className="exercise-nav-btn"
          onClick={onBack}
          aria-label="Πίσω"
        >
          ←
        </button>
        {showNext && onNext ? (
          <button
            type="button"
            className="exercise-nav-btn"
            onClick={onNext}
            aria-label="Επόμενη"
          >
            →
          </button>
        ) : (
          <span className="exercise-nav-btn exercise-nav-btn--ghost" aria-hidden="true" />
        )}
      </div>
      {children}
    </header>
  );
}
