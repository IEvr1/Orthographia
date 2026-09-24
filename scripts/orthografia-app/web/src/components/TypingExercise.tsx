import { Fragment, useEffect, useMemo, useState } from "react";
import type { FamiliesPayload, GradeResult, SessionSummary, WordEntry } from "../types";
import { resolveFamily } from "../lib/families";
import { gradeAnswer } from "../lib/grader";
import { resolveClozeHint } from "../lib/hintMask";
import { pickMisspelling, scrambleWord } from "../lib/spellingVariants";
import { useExerciseFlow } from "../lib/useExerciseFlow";
import { AudioPlayer } from "./AudioPlayer";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { DifficultyBadge } from "./DifficultyBadge";
import { FeedbackPanel } from "./FeedbackPanel";
import { GreekKeyboard } from "./GreekKeyboard";

export type TypingMode = "sentence" | "dictation" | "error-fix" | "scramble" | "morphemes";

interface TypingExerciseProps {
  mode: TypingMode;
  words: WordEntry[];
  families?: FamiliesPayload | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
}

type Phase = "writing" | "feedback" | "rewrite";

const TITLES: Record<TypingMode, string> = {
  sentence: "Πρόταση",
  dictation: "Υπαγόρευση",
  "error-fix": "Διόρθωση",
  scramble: "Ανακάτεμα",
  morphemes: "Μορφήματα",
};

export function TypingExercise({
  mode,
  words,
  families = null,
  onComplete,
  onQuit,
  sessionBanner = null,
}: TypingExerciseProps) {
  const {
    index,
    current,
    celebrationGoal,
    finishCelebration,
    onCorrect,
    onWrong,
    onSkip,
  } = useExerciseFlow({ words, onComplete });

  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("writing");
  const [result, setResult] = useState<GradeResult | null>(null);

  const misspelling = useMemo(
    () => (mode === "error-fix" ? pickMisspelling(current.word) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh per word
    [mode, current.id],
  );
  const scrambled = useMemo(
    () => (mode === "scramble" ? scrambleWord(current.word) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, current.id],
  );

  const sentence = resolveClozeHint(
    current.hintSentence,
    current.word,
    current.morphemes.root,
  );
  const family = resolveFamily(current, families);
  const audioSrc = `/content/${current.audioFile}`;
  const targetWord =
    mode === "morphemes" ? current.morphemes.suffix.replace(/^-/, "") : current.word;

  useEffect(() => {
    setInput("");
    setPhase("writing");
    setResult(null);
  }, [index, current.id]);

  const handleCheck = () => {
    const entryForGrade =
      mode === "morphemes"
        ? { ...current, word: targetWord, morphemes: { root: "", suffix: targetWord } }
        : current;
    const graded = gradeAnswer(entryForGrade, input.trim());
    setResult(graded);
    if (graded.isCorrect) {
      setPhase("feedback");
      onCorrect({
        hadRewrite: phase === "rewrite",
        delayMs: current.definition || family ? 2300 : 1200,
      });
    } else {
      if (phase === "writing") {
        onWrong(graded.errorCategory);
      }
      setPhase("feedback");
    }
  };

  const needsRewrite = phase === "feedback" && result && !result.isCorrect;
  const showingCorrectFeedback = phase === "feedback" && result?.isCorrect === true;
  const canSkip = !showingCorrectFeedback && celebrationGoal === null;

  return (
    <main className="screen screen--exercise fade-in">
      {celebrationGoal !== null && (
        <CelebrationOverlay goal={celebrationGoal} onContinue={finishCelebration} />
      )}
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onQuit}>
          ← Πίσω
        </button>
        <p className="progress-bar-label">
          {TITLES[mode]} {index + 1} από {words.length}
          <DifficultyBadge word={current} />
        </p>
        {sessionBanner && index === 0 && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        {(mode === "sentence" || mode === "dictation") && (
          <AudioPlayer src={audioSrc} autoPlay autoPlayDelayMs={mode === "dictation" ? 800 : 3000} key={current.id} />
        )}

        {mode === "sentence" && (
          <p className="hint-sentence">
            <span className="hint-label">Συμπλήρωσε τη λέξη στην πρόταση</span>
            {sentence.split("___").map((part, i, parts) => (
              <Fragment key={i}>
                {part}
                {i < parts.length - 1 && <span className="hint-blank">___</span>}
              </Fragment>
            ))}
          </p>
        )}

        {mode === "dictation" && (
          <p className="hint-sentence">
            <span className="hint-label">Άκου και γράψε τη λέξη</span>
            <span className="hint-blank">___</span>
          </p>
        )}

        {mode === "error-fix" && (
          <p className="hint-sentence">
            <span className="hint-label">Διόρθωσε τη λέξη</span>
            <span className="misspelled-word">{misspelling}</span>
            {current.hintSentence.includes("___") && (
              <span className="hint-context">{sentence.replace("___", "…")}</span>
            )}
          </p>
        )}

        {mode === "scramble" && (
          <p className="hint-sentence">
            <span className="hint-label">Βάλε τα γράμματα στη σωστή σειρά</span>
            <span className="scramble-letters" aria-label="Ανακατεμένα γράμματα">
              {[...scrambled].map((ch, i) => (
                <span key={`${ch}-${i}`} className="scramble-tile">
                  {ch}
                </span>
              ))}
            </span>
          </p>
        )}

        {mode === "morphemes" && (
          <p className="hint-sentence">
            <span className="hint-label">Συμπλήρωσε την κατάληξη</span>
            <span className="morpheme-prompt">
              <strong>{current.morphemes.root || "…"}</strong>
              <span className="hint-blank">___</span>
            </span>
            <span className="hint-context">λέξη: {current.word}</span>
          </p>
        )}

        <GreekKeyboard
          value={input}
          onChange={setInput}
          onCheck={handleCheck}
          disabled={showingCorrectFeedback}
          checkLabel={phase === "rewrite" ? "Έλεγξε ξανά" : "Έλεγξε"}
        />

        {result && phase === "feedback" && (
          <>
            <FeedbackPanel
              result={result}
              correctWord={targetWord}
              mode={needsRewrite ? "rewrite" : "check"}
              definition={current.definition}
              family={family}
            />
            {needsRewrite && (
              <button
                type="button"
                className="btn btn-primary btn-xl"
                onClick={() => {
                  setInput("");
                  setPhase("rewrite");
                  setResult(null);
                }}
              >
                Γράψε τη σωστή
              </button>
            )}
          </>
        )}

        {canSkip && (
          <button
            type="button"
            className="btn btn-secondary exercise-skip"
            onClick={() =>
              onSkip(phase === "rewrite" || (phase === "feedback" && result !== null && !result.isCorrect))
            }
          >
            Παράλειψη
          </button>
        )}
      </section>
    </main>
  );
}
