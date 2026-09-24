import type { ReactNode } from "react";

interface SessionProgressProps {
  /** 1-based current step */
  current: number;
  total: number;
  /** Mode title + “3 από 10” text (without badge) */
  label: string;
  children?: ReactNode;
}

export function SessionProgress({ current, total, label, children }: SessionProgressProps) {
  const safeTotal = Math.max(total, 1);
  const clamped = Math.min(Math.max(current, 0), safeTotal);
  const pct = Math.round((clamped / safeTotal) * 100);
  const showStars = safeTotal <= 12;

  return (
    <div className="session-progress">
      <p className="progress-bar-label">
        <span>{label}</span>
        {children}
      </p>
      <div
        className="progress-bar progress-bar--session"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={clamped}
        aria-label={`Πρόοδος: ${clamped} από ${safeTotal}`}
      >
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {showStars && (
        <div className="progress-stars" aria-hidden="true">
          {Array.from({ length: safeTotal }, (_, i) => (
            <span
              key={i}
              className={`progress-star${i < clamped ? " progress-star--filled" : ""}`}
            >
              ★
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
