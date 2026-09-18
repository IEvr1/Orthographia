import { useCallback, useMemo, useState } from "react";
import type { SessionSummary, WordEntry } from "../types";
import { buildChoiceOptions } from "../lib/choiceOptions";
import { loadProgress, recordAttempt, saveProgress } from "../lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";

interface ChoiceExerciseProps {
  words: WordEntry[];
  allWords: WordEntry[];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
}

export function ChoiceExercise({ words, allWords, onComplete, onQuit }: ChoiceExerciseProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [, setSummary] = useState<SessionSummary>({
    total: words.length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });

  const current = words[index];
  const options = useMemo(
    () => buildChoiceOptions(current, allWords),
    [current, allWords],
  );

  const advance = useCallback(
    (nextSummary: SessionSummary) => {
      if (index + 1 >= words.length) {
        onComplete(nextSummary);
      } else {
        setIndex((i) => i + 1);
        setPicked(null);
      }
    },
    [index, onComplete, words.length],
  );

  const handlePick = (option: string) => {
    if (picked) return;
    setPicked(option);
    const isCorrect = option === current.word;
    let store = loadProgress();
    store = recordAttempt(store, current.id, isCorrect, false);
    saveProgress(store);
    setSummary((s) => {
      const next = {
        ...s,
        correct: s.correct + (isCorrect ? 1 : 0),
        wrong: s.wrong + (isCorrect ? 0 : 1),
      };
      window.setTimeout(() => advance(next), isCorrect ? 900 : 1800);
      return next;
    });
  };

  return (
    <main className="screen screen--exercise fade-in">
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onQuit}>
          ← Πίσω
        </button>
        <p className="progress-bar-label">
          Επιλογή {index + 1} από {words.length}
          <DifficultyBadge word={current} />
        </p>
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">Πρόταση βοήθειας</span>
          {current.hintSentence.replace("___", "_____")}
        </p>

        <div className="choice-grid">
          {options.map((option) => {
            let cls = "choice-btn";
            if (picked) {
              if (option === current.word) cls += " choice-btn--correct";
              else if (option === picked) cls += " choice-btn--wrong";
            }
            return (
              <button
                key={option}
                type="button"
                className={cls}
                disabled={!!picked}
                onClick={() => handlePick(option)}
              >
                {option}
              </button>
            );
          })}
        </div>

        {picked && picked !== current.word && (
          <p className="feedback-correct">
            Σωστή λέξη: <strong>{current.word}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
