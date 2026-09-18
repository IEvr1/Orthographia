import { Fragment, useCallback, useEffect, useState } from "react";
import type { GradeResult, SessionSummary, WordEntry } from "../types";
import { gradeAnswer } from "../lib/grader";
import { maskWordInHint } from "../lib/hintMask";
import { loadProgress, recordAttempt, saveProgress } from "../lib/storage";
import { AudioPlayer } from "./AudioPlayer";
import { FeedbackPanel } from "./FeedbackPanel";
import { GreekKeyboard } from "./GreekKeyboard";

interface DictationExerciseProps {
  words: WordEntry[];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
}

type Phase = "writing" | "feedback" | "rewrite";

export function DictationExercise({ words, onComplete, onQuit }: DictationExerciseProps) {
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

  const handleRewriteCheck = () => {
    const graded = gradeAnswer(current, input);
    setResult(graded);
    if (graded.isCorrect) {
      let store = loadProgress();
      store = recordAttempt(store, current.id, true, true);
      saveProgress(store);
      setSummary((s) => {
        const next = { ...s, rewrites: s.rewrites + 1 };
        setPhase("feedback");
        window.setTimeout(() => advance(next), 1200);
        return next;
      });
    }
  };

  const startRewrite = () => {
    setInput("");
    setPhase("rewrite");
    setResult(null);
  };

  const needsRewrite = phase === "feedback" && result && !result.isCorrect;

  return (
    <main className="screen screen--exercise fade-in">
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onQuit}>
          ← Πίσω
        </button>
        <p className="progress-bar-label">
          Λέξη {index + 1} από {words.length}
        </p>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${((index + (result?.isCorrect ? 1 : 0)) / words.length) * 100}%` }}
          />
        </div>
      </header>

      <section className="exercise-body">
        <AudioPlayer src={audioSrc} autoPlay key={current.id} />
        <p className="hint-sentence">
          <span className="hint-label">Πρόταση βοήθειας</span>
          {maskWordInHint(current.hintSentence, current.word)
            .split("___")
            .map((part, i, parts) => (
              <Fragment key={i}>
                {part}
                {i < parts.length - 1 && <span className="hint-blank">___</span>}
              </Fragment>
            ))}
        </p>

        <GreekKeyboard
          value={input}
          onChange={setInput}
          onCheck={phase === "rewrite" ? handleRewriteCheck : handleCheck}
          disabled={phase === "feedback" && result?.isCorrect === true}
          checkLabel={phase === "rewrite" ? "Έλεγξε ξανά" : "Έλεγξε"}
        />

        {result && phase === "feedback" && (
          <>
            <FeedbackPanel
              result={result}
              correctWord={current.word}
              mode={needsRewrite ? "rewrite" : "check"}
            />
            {needsRewrite && (
              <button type="button" className="btn btn-primary btn-xl" onClick={startRewrite}>
                Γράψε τη σωστή
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
