import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { GradeResult, SessionSummary, WordEntry } from "../types";
import { gradeAnswer } from "../lib/grader";
import { resolveClozeHint } from "../lib/hintMask";
import { getRewardGoal } from "../lib/settings";
import {
  clearRewardPointsAfterCelebration,
  getRewardPoints,
  loadProgress,
  recordAttempt,
  saveProgress,
} from "../lib/storage";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { DifficultyBadge } from "./DifficultyBadge";
import { AudioPlayer } from "./AudioPlayer";
import { FeedbackPanel } from "./FeedbackPanel";
import { GreekKeyboard } from "./GreekKeyboard";

interface SentenceExerciseProps {
  words: WordEntry[];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
}

type Phase = "writing" | "feedback" | "rewrite";

export function SentenceExercise({ words, onComplete, onQuit }: SentenceExerciseProps) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("writing");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [, setSummary] = useState<SessionSummary>({
    total: words.length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });
  const [celebrationGoal, setCelebrationGoal] = useState<number | null>(null);
  const pendingAdvanceRef = useRef<SessionSummary | null>(null);

  const current = words[index];
  // Same cloze resolution as former dictation: mask the target in-place when needed.
  const sentence = resolveClozeHint(
    current.hintSentence,
    current.word,
    current.morphemes.root,
  );
  const audioSrc = `/content/${current.audioFile}`;

  useEffect(() => {
    setInput("");
    setPhase("writing");
    setResult(null);
  }, [index, current.id]);

  const advance = useCallback(
    (nextSummary: SessionSummary) => {
      if (index + 1 >= words.length) {
        onComplete(nextSummary);
      } else {
        setIndex((i) => i + 1);
      }
    },
    [index, onComplete, words.length],
  );

  const finishCelebration = () => {
    clearRewardPointsAfterCelebration();
    setCelebrationGoal(null);
    const pending = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    if (pending) {
      advance(pending);
    }
  };

  const handleCheck = () => {
    const graded = gradeAnswer(current, input);
    setResult(graded);
    let store = loadProgress();
    if (graded.isCorrect) {
      store = recordAttempt(store, current.id, true, phase === "rewrite");
      saveProgress(store);
      const goal = getRewardGoal();
      const reachedGoal = getRewardPoints(store) >= goal;
      setSummary((s) => {
        const next = {
          ...s,
          correct: s.correct + 1,
          rewrites: phase === "rewrite" ? s.rewrites + 1 : s.rewrites,
        };
        setPhase("feedback");
        if (reachedGoal) {
          pendingAdvanceRef.current = next;
          setCelebrationGoal(goal);
        } else {
          window.setTimeout(() => advance(next), 1200);
        }
        return next;
      });
    } else {
      if (phase === "writing") {
        store = recordAttempt(store, current.id, false, false);
        saveProgress(store);
        setSummary((s) => ({ ...s, wrong: s.wrong + 1 }));
      }
      setPhase("feedback");
    }
  };

  const needsRewrite = phase === "feedback" && result && !result.isCorrect;

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
          Πρόταση {index + 1} από {words.length}
          <DifficultyBadge word={current} />
        </p>
      </header>

      <section className="exercise-body">
        <AudioPlayer src={audioSrc} autoPlay key={current.id} />
        <p className="hint-sentence">
          <span className="hint-label">Συμπλήρωσε τη λέξη στην πρόταση</span>
          {sentence.split("___").map((part, i, parts) => (
            <Fragment key={i}>
              {part}
              {i < parts.length - 1 && <span className="hint-blank">___</span>}
            </Fragment>
          ))}
        </p>

        <GreekKeyboard
          value={input}
          onChange={setInput}
          onCheck={handleCheck}
          disabled={phase === "feedback" && result?.isCorrect === true}
          checkLabel={phase === "rewrite" ? "Έλεγξε ξανά" : "Έλεγξε"}
        />

        {result && phase === "feedback" && (
          <>
            <FeedbackPanel
              result={result}
              correctWord={current.word}
              mode={needsRewrite ? "rewrite" : "check"}
              definition={current.definition}
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
      </section>
    </main>
  );
}
