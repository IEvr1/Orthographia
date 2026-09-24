import { useEffect, useMemo, useRef, useState } from "react";
import type { FamiliesPayload, SessionSummary, WordEntry } from "../types";
import { buildChoiceOptions, buildTonosOptions } from "../lib/choiceOptions";
import { resolveFamily } from "../lib/families";
import { resolveClozeHint, CLOZE_MARKER, letterBlank } from "../lib/hintMask";
import { stripStress } from "../lib/normalize";
import { getRewardGoal } from "../lib/settings";
import {
  clearRewardPointsAfterCelebration,
  getRewardPoints,
  loadProgress,
  recordAttempt,
  saveProgress,
} from "../lib/storage";
import { recordSessionDay, unlockBadgesAfterSession } from "../lib/streakBadges";
import { recordErrorCategory } from "../lib/weakness";
import { useExerciseFlow } from "../lib/useExerciseFlow";
import { AnswerExtras } from "./AnswerExtras";
import { AudioPlayer } from "./AudioPlayer";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { DifficultyBadge } from "./DifficultyBadge";
import { SessionProgress } from "./SessionProgress";

export type PickMode = "choice" | "tonos" | "family";

interface PickExerciseProps {
  mode: PickMode;
  words: WordEntry[];
  allWords: WordEntry[];
  families?: FamiliesPayload | null;
  /** Workbook pages for tonos (6–8 words). */
  batches?: WordEntry[][] | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
  withAudio?: boolean;
  profileId?: string | null;
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

function BatchTonosView({
  batches,
  onComplete,
  onQuit,
  sessionBanner,
  profileId = null,
}: {
  batches: WordEntry[][];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
  profileId?: string | null;
}) {
  const [batchIndex, setBatchIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const summaryRef = useRef<SessionSummary>({
    total: batches.flat().length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });
  const [celebrationGoal, setCelebrationGoal] = useState<number | null>(null);
  const pendingFinishRef = useRef(false);
  const optionOrder = useRef<Record<string, string[]>>({});

  const batch = batches[batchIndex]!;

  useEffect(() => {
    setAnswers({});
    setChecked(false);
    for (const word of batch) {
      if (!optionOrder.current[word.id]) {
        optionOrder.current[word.id] = buildTonosOptions(word.word);
      }
    }
  }, [batchIndex, batch]);

  const allAnswered = batch.every((w) => Boolean(answers[w.id]));

  const pick = (id: string, option: string) => {
    if (checked) return;
    setAnswers((prev) => ({ ...prev, [id]: option }));
  };

  const finishCelebration = () => {
    clearRewardPointsAfterCelebration(profileId);
    setCelebrationGoal(null);
    if (pendingFinishRef.current) {
      pendingFinishRef.current = false;
      onComplete(summaryRef.current);
    }
  };

  const goNext = (nextSummary: SessionSummary) => {
    if (batchIndex + 1 >= batches.length) {
      let store = loadProgress(profileId);
      store = recordSessionDay(store);
      store = unlockBadgesAfterSession(store, nextSummary);
      saveProgress(store, profileId);
      const goal = getRewardGoal();
      if (getRewardPoints(store) >= goal) {
        pendingFinishRef.current = true;
        setCelebrationGoal(goal);
        return;
      }
      onComplete(nextSummary);
    } else {
      setBatchIndex((i) => i + 1);
    }
  };

  const handleCheck = () => {
    if (!allAnswered || checked) return;
    setChecked(true);

    let store = loadProgress(profileId);
    let correct = 0;
    let wrong = 0;
    for (const word of batch) {
      const ok = answers[word.id] === word.word;
      if (ok) correct += 1;
      else wrong += 1;
      store = recordAttempt(store, word.id, ok, false, ok ? null : "stress");
      if (!ok) store = recordErrorCategory(store, "stress");
    }
    saveProgress(store, profileId);

    summaryRef.current = {
      total: summaryRef.current.total,
      correct: summaryRef.current.correct + correct,
      wrong: summaryRef.current.wrong + wrong,
      rewrites: 0,
    };
  };

  return (
    <main className="screen screen--exercise screen--batch fade-in">
      {celebrationGoal !== null && (
        <CelebrationOverlay goal={celebrationGoal} onContinue={finishCelebration} />
      )}
      <header className="exercise-header">
        <button type="button" className="btn-text" onClick={onQuit}>
          ← Πίσω
        </button>
        <SessionProgress
          current={batchIndex + 1}
          total={batches.length}
          label={`Τονισμός · ομάδα ${batchIndex + 1} από ${batches.length}`}
        />
        {sessionBanner && batchIndex === 0 && !checked && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">Ποια λέξη τονίζεται σωστά;</span>
        </p>

        <div className="batch-grid" role="list">
          {batch.map((word) => {
            const picked = answers[word.id] ?? null;
            const opts = optionOrder.current[word.id] ?? buildTonosOptions(word.word);
            const isCorrect = checked && picked === word.word;
            const isWrong = checked && picked !== word.word;
            return (
              <div
                key={word.id}
                className={`batch-row${isCorrect ? " batch-row--ok" : ""}${isWrong ? " batch-row--bad" : ""}`}
                role="listitem"
              >
                <span className="batch-row__prompt batch-row__prompt--muted">
                  {stripStress(word.word)}
                </span>
                <div className="batch-row__options">
                  {opts.map((option) => {
                    let cls = "batch-opt";
                    if (picked === option) cls += " batch-opt--picked";
                    if (checked) {
                      if (option === word.word) cls += " batch-opt--correct";
                      else if (option === picked) cls += " batch-opt--wrong";
                    }
                    return (
                      <button
                        key={option}
                        type="button"
                        className={cls}
                        disabled={checked}
                        onClick={() => pick(word.id, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {checked && isWrong && (
                  <p className="batch-row__fix">Σωστό: {word.word}</p>
                )}
              </div>
            );
          })}
        </div>

        {!checked ? (
          <button
            type="button"
            className="btn btn-primary exercise-skip"
            disabled={!allAnswered}
            onClick={handleCheck}
          >
            Έλεγχος
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary exercise-skip"
            onClick={() => goNext(summaryRef.current)}
          >
            {batchIndex + 1 >= batches.length ? "Τέλος" : "Επόμενη ομάδα"}
          </button>
        )}
      </section>
    </main>
  );
}

function SinglePickView({
  mode,
  words,
  allWords,
  families = null,
  onComplete,
  onQuit,
  sessionBanner = null,
  withAudio = true,
}: Omit<PickExerciseProps, "batches" | "profileId">) {
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
        <SessionProgress
          current={index + 1}
          total={words.length}
          label={`${TITLES[mode]} ${index + 1} από ${words.length}`}
        >
          <DifficultyBadge word={current} />
        </SessionProgress>
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
            {hintSentence.split(CLOZE_MARKER).map((part, i, parts) =>
              i < parts.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="hint-blank hint-blank--sized" aria-hidden="true">
                    {letterBlank(current.word)}
                  </span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
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
            {picked ? "Συνέχεια" : "Επόμενη άσκηση"}
          </button>
        )}
      </section>
    </main>
  );
}

export function PickExercise({
  mode,
  words,
  allWords,
  families = null,
  batches = null,
  onComplete,
  onQuit,
  sessionBanner = null,
  withAudio = true,
  profileId = null,
}: PickExerciseProps) {
  if (mode === "tonos" && batches && batches.length > 0) {
    return (
      <BatchTonosView
        batches={batches}
        onComplete={onComplete}
        onQuit={onQuit}
        sessionBanner={sessionBanner}
        profileId={profileId}
      />
    );
  }
  return (
    <SinglePickView
      mode={mode}
      words={words}
      allWords={allWords}
      families={families}
      onComplete={onComplete}
      onQuit={onQuit}
      sessionBanner={sessionBanner}
      withAudio={withAudio}
    />
  );
}
