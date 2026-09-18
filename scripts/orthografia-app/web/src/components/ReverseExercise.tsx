import { useCallback, useEffect, useState } from "react";
import type { GradeResult, SessionSummary, WordEntry } from "../types";
import { gradeAnswer } from "../lib/grader";
import { loadProgress, recordAttempt, saveProgress } from "../lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";
import { FeedbackPanel } from "./FeedbackPanel";
import { GreekKeyboard } from "./GreekKeyboard";

interface ReverseExerciseProps {
  words: WordEntry[];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
}

type Phase = "writing" | "feedback" | "rewrite";

export function ReverseExercise({ words, onComplete, onQuit }: ReverseExerciseProps) {
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

  const current = words[index];
  const prompt =
    current.definition ||
    current.feedbackRule ||
    `Γράψε τη λέξη που ταιριάζει στην περιγραφή.`;

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

  const handleCheck = () => {
    const graded = gradeAnswer(current, input);
    setResult(graded);
    let store = loadProgress();
    if (graded.isCorrect) {
      store = recordAttempt(store, current.id, true, phase === "rewrite");
      saveProgress(store);
      setSummary((s) => {
        const next = {
          ...s,
          correct: s.correct + 1,
          rewrites: phase === "rewrite" ? s.rewrites + 1 : s.rewrites,
        };
        setPhase("feedback");
        window.setTimeout(() => advance(next), 1200);
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
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onQuit}>
          ← Πίσω
        </button>
        <p className="progress-bar-label">
          Αναζήτηση {index + 1} από {words.length}
          <DifficultyBadge word={current} />
        </p>
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">Ορισμός</span>
          {prompt}
        </p>

        <GreekKeyboard
          value={input}
          onChange={setInput}
          onCheck={handleCheck}
          disabled={phase === "feedback" && result?.isCorrect === true}
          checkLabel="Έλεγξε"
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
