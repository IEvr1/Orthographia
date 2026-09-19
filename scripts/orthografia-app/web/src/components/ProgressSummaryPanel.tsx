import type { DifficultyMix } from "../lib/difficulty";
import { formatDifficultyMix } from "../lib/difficulty";
import { buildProgressInsights, progressPercent } from "../lib/progressAnalysis";
import type { GradeProgressStats } from "../lib/progressStats";

interface ProgressSummaryPanelProps {
  stats: GradeProgressStats;
  gradeLabel: string;
  activeChildName?: string | null;
  lastSessionDate: string | null;
  sessionMix?: DifficultyMix | null;
  onBackup?: () => void;
  showBackup?: boolean;
}

export function ProgressSummaryPanel({
  stats,
  gradeLabel,
  activeChildName,
  lastSessionDate,
  sessionMix,
  onBackup,
  showBackup = false,
}: ProgressSummaryPanelProps) {
  if (stats.total <= 0) return null;

  const pct = progressPercent(stats);
  const insights = buildProgressInsights(stats, lastSessionDate);
  const mixLabel = sessionMix ? formatDifficultyMix(sessionMix) : null;
  const headline = activeChildName
    ? `${activeChildName} · ${gradeLabel} τάξη`
    : `${gradeLabel} τάξη`;

  return (
    <section className="progress-summary" aria-label="Σύνοψη προόδου">
      <p className="progress-summary__headline">{headline}</p>
      <p className="progress-summary__score">
        {stats.mastered}/{stats.total} λέξεις · {pct}%
      </p>

      <div className="progress-bar progress-bar--home" aria-hidden="true">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <ul className="progress-summary__insights">
        {insights.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {stats.mastered > 0 && (
          <li>
            Δυσκολία: εύκολες {stats.easyMastered} · μέτριες {stats.mediumMastered} · δύσκολες{" "}
            {stats.hardMastered}
          </li>
        )}
        {mixLabel && <li>Σημερινή αποστολή: {mixLabel}</li>}
      </ul>

      {showBackup && onBackup && (
        <button type="button" className="btn-text btn-text--subtle progress-summary__backup" onClick={onBackup}>
          Αντίγραφο ασφαλείας (JSON)
        </button>
      )}
    </section>
  );
}
