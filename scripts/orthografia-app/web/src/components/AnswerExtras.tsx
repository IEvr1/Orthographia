import type { FamiliesPayload, WordEntry, WordFamily } from "../types";
import { resolveFamily } from "../lib/families";

/** Shared post-answer lexicon + family hints. */
export function AnswerExtras({
  word,
  families,
  showDefinition = true,
}: {
  word: WordEntry;
  families?: FamiliesPayload | null;
  showDefinition?: boolean;
}) {
  const family: WordFamily | null = families ? resolveFamily(word, families) : null;
  if (!showDefinition && !family) return null;
  if (showDefinition && !word.definition && !family) return null;

  return (
    <div className="answer-extras bounce-in" role="status">
      {showDefinition && word.definition && (
        <p className="lexicon-def">
          <span className="lexicon-label">Λεξικό:</span> {word.definition}
        </p>
      )}
      {family && family.members.length > 0 && (
        <p className="family-hint">
          <span className="lexicon-label">Οικογένεια λέξεων:</span>{" "}
          {family.members.join(", ")}
          {family.rule ? ` — ${family.rule}` : ""}
        </p>
      )}
    </div>
  );
}
