import type { GradeResult, WordFamily } from "../types";

interface FeedbackPanelProps {
  result: GradeResult;
  correctWord: string;
  mode: "check" | "rewrite";
  definition?: string;
  family?: WordFamily | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  ending: "Λάθος στο τέλος της λέξης",
  derivation: "Λάθος στην κατάληξη / παράγωγο",
  root: "Λάθος στη ρίζα",
  stress: "Πρόσεξε τον τόνο",
  "final-sigma": "Στο τέλος γράφουμε ς, όχι σ",
  other: "Δες προσεκτικά κάθε γράμμα",
};

/** True for stem+suffix hints like «κυρ- + -ία.»; false for prose tips. */
function isMorphemeBreakdown(rule: string): boolean {
  return /\S-\s*\+\s*-/.test(rule);
}

function FamilyBlock({ family }: { family: WordFamily }) {
  return (
    <p className="family-hint">
      <span className="lexicon-label">Οικογένεια λέξεων:</span>{" "}
      {family.members.join(", ")}
      {family.rule ? ` — ${family.rule}` : ""}
    </p>
  );
}

export function FeedbackPanel({
  result,
  correctWord,
  mode,
  definition,
  family,
}: FeedbackPanelProps) {
  if (result.isCorrect) {
    return (
      <div className="feedback feedback--success bounce-in" role="status">
        <span className="feedback-icon" aria-hidden="true">
          ✓
        </span>
        <p className="feedback-title">Μπράβο!</p>
        <p>Η λέξη είναι σωστή.</p>
        {definition && (
          <p className="lexicon-def">
            <span className="lexicon-label">Λεξικό:</span> {definition}
          </p>
        )}
        {family && family.members.length > 0 && <FamilyBlock family={family} />}
        {result.feedbackRule && (
          <p className="feedback-rule">{result.feedbackRule}</p>
        )}
      </div>
    );
  }

  return (
    <div className="feedback feedback--error shake-in" role="alert">
      <span className="feedback-icon" aria-hidden="true">
        !
      </span>
      <p className="feedback-title">
        {mode === "rewrite" ? "Γράψε τη σωστή λέξη" : "Όχι ακριβώς…"}
      </p>

      {!result.stressCorrect && result.lettersCorrect && (
        <p className="feedback-stress">Σωστά γράμματα — λείπει ή είναι λάθος ο τόνος!</p>
      )}

      {result.errorCategory && (
        <p className="feedback-category">{CATEGORY_LABELS[result.errorCategory]}</p>
      )}

      <div className="alignment" aria-label="Σύγκριση γραμμάτων">
        {result.alignments.map((a, i) => (
          <span key={i} className={`grapheme ${a.match ? "grapheme--ok" : "grapheme--bad"}`}>
            <span className="grapheme-actual">{a.actual}</span>
            {!a.match && <span className="grapheme-expected">{a.expected}</span>}
          </span>
        ))}
      </div>

      {definition && (
        <p className="lexicon-def">
          <span className="lexicon-label">Λεξικό:</span> {definition}
        </p>
      )}

      {family && family.members.length > 0 && <FamilyBlock family={family} />}

      {result.feedbackRule && !isMorphemeBreakdown(result.feedbackRule) && (
        <p className="feedback-rule">{result.feedbackRule}</p>
      )}
      <p className="feedback-correct">
        Σωστή λέξη: <strong>{correctWord}</strong>
      </p>
    </div>
  );
}
