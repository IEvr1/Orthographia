import { useCallback, useMemo, useRef, useState } from "react";
import type { SessionSummary, WordEntry } from "../types";
import { buildChoiceOptions } from "../lib/choiceOptions";
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

interface ChoiceExerciseProps {
  words: WordEntry[];
  allWords: WordEntry[];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  /** Optional Greek note (e.g. refresh session when nothing is due). */
  sessionBanner?: string | null;
}

export function ChoiceExercise({
  words,
  allWords,
  onComplete,
  onQuit,
  sessionBanner = null,
}: ChoiceExerciseProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [, setSummary] = useState<SessionSummary>({
    total: words.length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });
  const [celebrationGoal, setCelebrationGoal] = useState<number | null>(null);
  const pendingAdvanceRef = useRef<SessionSummary | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const current = words[index];
  const hintSentence = resolveClozeHint(
    current.hintSentence,
    current.word,
    current.morphemes.root,
  );
  const options = useMemo(
    () => buildChoiceOptions(current, allWords),
    [current, allWords],
  );

  const advance = useCallback(
    (nextSummary: SessionSummary) => {
      clearAdvanceTimer();
      if (index + 1 >= words.length) {
        onComplete(nextSummary);
      } else {
        setIndex((i) => i + 1);
        setPicked(null);
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

  const handlePick = (option: string) => {
    if (picked) return;
    setPicked(option);
    const isCorrect = option === current.word;
    let store = loadProgress();
    store = recordAttempt(store, current.id, isCorrect, false);
    saveProgress(store);
    const goal = getRewardGoal();
    const reachedGoal = isCorrect && getRewardPoints(store) >= goal;
    setSummary((s) => {
      const next = {
        ...s,
        correct: s.correct + (isCorrect ? 1 : 0),
        wrong: s.wrong + (isCorrect ? 0 : 1),
      };
      if (reachedGoal) {
        pendingAdvanceRef.current = next;
        setCelebrationGoal(goal);
      } else {
        const correctDelay = current.definition ? 2300 : 900;
        clearAdvanceTimer();
        advanceTimerRef.current = window.setTimeout(
          () => advance(next),
          isCorrect ? correctDelay : 1800,
        );
      }
      return next;
    });
  };

  /** Skip unanswered (or hurry past wrong feedback); records as wrong if not yet graded. */
  const handleSkip = () => {
    if (celebrationGoal !== null) return;
    if (picked && picked === current.word) return;

    clearAdvanceTimer();

    if (picked) {
      // Already recorded as wrong; just advance now.
      setSummary((s) => {
        advance(s);
        return s;
      });
      return;
    }

    let store = loadProgress();
    store = recordAttempt(store, current.id, false, false);
    saveProgress(store);
    setSummary((s) => {
      const next = { ...s, wrong: s.wrong + 1 };
      advance(next);
      return next;
    });
  };

  const canSkip = celebrationGoal === null && (!picked || picked !== current.word);

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
          Επιλογή {index + 1} από {words.length}
          <DifficultyBadge word={current} />
        </p>
        {sessionBanner && index === 0 && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">Πρόταση βοήθειας</span>
          {hintSentence.replace("___", "_____")}
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

        {picked && picked === current.word && (current.definition || current.feedbackRule) && (
          <div className="feedback feedback--success bounce-in" role="status">
            {current.definition && (
              <p className="lexicon-def">
                <span className="lexicon-label">Λεξικό:</span> {current.definition}
              </p>
            )}
            {current.feedbackRule && (
              <p className="feedback-rule">{current.feedbackRule}</p>
            )}
          </div>
        )}

        {picked && picked !== current.word && (
          <p className="feedback-correct">
            Σωστή λέξη: <strong>{current.word}</strong>
          </p>
        )}

        {canSkip && (
          <button type="button" className="btn btn-secondary exercise-skip" onClick={handleSkip}>
            Παράλειψη
          </button>
        )}
      </section>
    </main>
  );
}
