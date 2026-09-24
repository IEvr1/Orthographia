import { useEffect, useMemo, useRef, useState } from "react";
import type { FamiliesPayload, SessionSummary, WordEntry } from "../types";
import { buildChoiceOptions, buildTonosOptions } from "../lib/choiceOptions";
import { resolveFamily } from "../lib/families";
import { resolveClozeHint } from "../lib/hintMask";
import { stripStress } from "../lib/normalize";
import { useExerciseFlow } from "../lib/useExerciseFlow";
import { AnswerExtras } from "./AnswerExtras";
import { AudioPlayer } from "./AudioPlayer";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { DifficultyBadge } from "./DifficultyBadge";

export type PickMode = "choice" | "tonos" | "family";

interface PickExerciseProps {
  mode: PickMode;
  words: WordEntry[];
  allWords: WordEntry[];
  families?: FamiliesPayload | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
  withAudio?: boolean;
}

const TITLES: Record<PickMode, string> = {
  choice: "Επιλογή",
  tonos: "Τονισμός",
  family: "Οικογένεια",
};

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function familyOptions(
  word: WordEntry,
  allWords: WordEntry[],
  families: FamiliesPayload | null,
): { options: string[]; promptMember: string } {
  const fam = families ? resolveFamily(word, families) : null;
  const siblings = (fam?.members ?? []).filter((m) => m !== word.word);
  const promptMember = siblings[0] ?? fam?.root ?? "την ίδια ρίζα";
  const options = new Set<string>([word.word]);
  for (const w of shuffle(allWords)) {
    if (options.size >= 4) break;
    if (w.id === word.id) continue;
    if (w.familyId && w.familyId === word.familyId) continue;
    options.add(w.word);
  }
  while (options.size < 4) {
    options.add(stripStress(word.word) + (options.size > 2 ? "ς" : ""));
    break;
  }
  return { options: shuffle([...options]).slice(0, 4), promptMember };
}

export function PickExercise({
  mode,
  words,
  allWords,
  families = null,
  onComplete,
  onQuit,
  sessionBanner = null,
  withAudio = true,
}: PickExerciseProps) {
  const {
    index,
    current,
    celebrationGoal,
    finishCelebration,
    onCorrect,
    onWrong,
    onSkip,
    clearAdvanceTimer,
  } = useExerciseFlow({ words, onComplete });

  const [picked, setPicked] = useState<string | null>(null);
  const wrongTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPicked(null);
    if (wrongTimerRef.current != null) {
      window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, [index, current.id]);

  const hintSentence = resolveClozeHint(
    current.hintSentence,
    current.word,
    current.morphemes.root,
  );

  const familyPack = useMemo(
    () => (mode === "family" ? familyOptions(current, allWords, families) : null),
    [mode, current, allWords, families],
  );

  const options = useMemo(() => {
    if (mode === "tonos") return buildTonosOptions(current.word);
    if (mode === "family" && familyPack) return familyPack.options;
    return buildChoiceOptions(current, allWords);
  }, [mode, current, allWords, familyPack]);

  const handlePick = (option: string) => {
    if (picked) return;
    setPicked(option);
    const isCorrect = option === current.word;
    if (isCorrect) {
      onCorrect({
        delayMs: current.definition || current.familyId ? 2300 : 900,
      });
    } else {
      onWrong(mode === "tonos" ? "stress" : "other");
      wrongTimerRef.current = window.setTimeout(() => {
        onSkip(true);
      }, 1800);
    }
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
        {withAudio && (mode === "choice" || mode === "tonos") && (
          <AudioPlayer
            src={`/content/${current.audioFile}`}
            autoPlay
            autoPlayDelayMs={1200}
            key={current.id}
          />
        )}

        {mode === "choice" && (
          <p className="hint-sentence">
            <span className="hint-label">Πρόταση βοήθειας</span>
            {hintSentence.replace("___", "_____")}
          </p>
        )}

        {mode === "tonos" && (
          <p className="hint-sentence">
            <span className="hint-label">Ποια λέξη τονίζεται σωστά;</span>
          </p>
        )}

        {mode === "family" && familyPack && (
          <p className="hint-sentence">
            <span className="hint-label">Ίδια οικογένεια λέξεων με:</span>
            <strong className="family-root">{familyPack.promptMember}</strong>
          </p>
        )}

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

        {picked && picked === current.word && (
          <AnswerExtras word={current} families={families} />
        )}

        {picked && picked !== current.word && (
          <p className="feedback-correct">
            Σωστή λέξη: <strong>{current.word}</strong>
          </p>
        )}

        {canSkip && (
          <button
            type="button"
            className="btn btn-secondary exercise-skip"
            onClick={() => {
              clearAdvanceTimer();
              if (wrongTimerRef.current != null) {
                window.clearTimeout(wrongTimerRef.current);
                wrongTimerRef.current = null;
              }
              onSkip(Boolean(picked));
            }}
          >
            Παράλειψη
          </button>
        )}
      </section>
    </main>
  );
}
