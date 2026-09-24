import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DrillItem, SessionSummary } from "../types";
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
import { CelebrationOverlay } from "./CelebrationOverlay";
import { SessionProgress } from "./SessionProgress";

interface DrillExerciseProps {
  title: string;
  drills: DrillItem[];
  /** When set, show workbook-style pages of 6–8 items with Έλεγχος. */
  batches?: DrillItem[][] | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
  profileId?: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function renderPromptWithGap(prompt: string, filled: string | null): ReactNode {
  if (!prompt.includes("____")) {
    return prompt;
  }
  const parts = prompt.split("____");
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (i < parts.length - 1) {
      nodes.push(
        <span key={`g-${i}`} className={`drill-gap${filled ? " drill-gap--answered" : ""}`}>
          {filled ?? "____"}
        </span>,
      );
    }
  });
  return nodes;
}

function RowPrompt({ item, filled }: { item: DrillItem; filled: string | null }) {
  if (item.kind === "article") {
    return (
      <span className="batch-row__prompt">
        <span className={`drill-gap${filled ? " drill-gap--answered" : ""}`}>
          {filled ?? "____"}
        </span>{" "}
        {item.prompt}
      </span>
    );
  }
  if (item.kind === "binary") {
    return <span className="batch-row__prompt batch-row__prompt--muted">Διάλεξε τη σωστή μορφή</span>;
  }
  if (item.kind === "choice") {
    return <span className="batch-row__prompt batch-row__prompt--muted">Σωστή ορθογραφία</span>;
  }
  if (item.kind === "homophone") {
    return <span className="batch-row__prompt">{item.prompt}</span>;
  }
  return (
    <span className="batch-row__prompt">
      {item.prefix ? <span className="drill-prefix">{item.prefix} </span> : null}
      {renderPromptWithGap(item.prompt, filled)}
    </span>
  );
}

function BatchDrillView({
  title,
  batches,
  onComplete,
  onQuit,
  sessionBanner,
  profileId = null,
}: {
  title: string;
  batches: DrillItem[][];
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
  profileId?: string | null;
}) {
  const [batchIndex, setBatchIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [summary, setSummary] = useState<SessionSummary>({
    total: batches.flat().length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });
  const summaryRef = useRef(summary);
  const [celebrationGoal, setCelebrationGoal] = useState<number | null>(null);
  const pendingFinishRef = useRef(false);
  const optionOrder = useRef<Record<string, string[]>>({});

  const batch = batches[batchIndex]!;
  const instruction = batch[0]?.instruction ?? "Συμπλήρωσε τις καταλήξεις.";
  const ruleHint = batch[0]?.feedback;

  useEffect(() => {
    setAnswers({});
    setChecked(false);
    for (const item of batch) {
      if (!optionOrder.current[item.id]) {
        optionOrder.current[item.id] = shuffle(item.options);
      }
    }
  }, [batchIndex, batch]);

  const allAnswered = batch.every((item) => Boolean(answers[item.id]));

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
    for (const item of batch) {
      const ok = answers[item.id] === item.answer;
      if (ok) correct += 1;
      else wrong += 1;
      store = recordAttempt(store, item.id, ok, false, ok ? null : "ending");
      if (!ok) store = recordErrorCategory(store, "ending");
    }
    saveProgress(store, profileId);

    const nextSummary: SessionSummary = {
      total: summaryRef.current.total,
      correct: summaryRef.current.correct + correct,
      wrong: summaryRef.current.wrong + wrong,
      rewrites: 0,
    };
    summaryRef.current = nextSummary;
    setSummary(nextSummary);
  };

  const handleContinue = () => {
    goNext(summaryRef.current);
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
          label={`${title} · ομάδα ${batchIndex + 1} από ${batches.length}`}
        />
        {sessionBanner && batchIndex === 0 && !checked && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">{instruction}</span>
        </p>

        <div className="batch-grid" role="list">
          {batch.map((item) => {
            const picked = answers[item.id] ?? null;
            const opts = optionOrder.current[item.id] ?? item.options;
            const isCorrect = checked && picked === item.answer;
            const isWrong = checked && picked !== item.answer;
            return (
              <div
                key={item.id}
                className={`batch-row${isCorrect ? " batch-row--ok" : ""}${isWrong ? " batch-row--bad" : ""}`}
                role="listitem"
              >
                <RowPrompt item={item} filled={picked} />
                <div className="batch-row__options">
                  {opts.map((option) => {
                    let cls = "batch-opt";
                    if (picked === option) cls += " batch-opt--picked";
                    if (checked) {
                      if (option === item.answer) cls += " batch-opt--correct";
                      else if (option === picked) cls += " batch-opt--wrong";
                    }
                    return (
                      <button
                        key={option}
                        type="button"
                        className={cls}
                        disabled={checked}
                        onClick={() => pick(item.id, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {checked && isWrong && (
                  <p className="batch-row__fix">Σωστό: {item.answer}</p>
                )}
              </div>
            );
          })}
        </div>

        {checked && ruleHint && (
          <p className="drill-feedback feedback-correct">{ruleHint}</p>
        )}

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
          <button type="button" className="btn btn-primary exercise-skip" onClick={handleContinue}>
            {batchIndex + 1 >= batches.length ? "Τέλος" : "Επόμενη ομάδα"}
          </button>
        )}
      </section>
    </main>
  );
}

function SingleDrillView({
  title,
  drills,
  onComplete,
  onQuit,
  sessionBanner = null,
}: Omit<DrillExerciseProps, "batches" | "profileId">) {
  const {
    index,
    current,
    celebrationGoal,
    finishCelebration,
    onCorrect,
    onWrong,
    onSkip,
    clearAdvanceTimer,
  } = useExerciseFlow({ items: drills, onComplete });

  const [picked, setPicked] = useState<string | null>(null);
  const wrongTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPicked(null);
    if (wrongTimerRef.current != null) {
      window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, [index, current.id]);

  const options = useMemo(() => shuffle(current.options), [current.id, current.options]);

  const handlePick = (option: string) => {
    if (picked) return;
    setPicked(option);
    const isCorrect = option === current.answer;
    if (isCorrect) {
      onCorrect({ delayMs: 1600 });
    } else {
      onWrong("ending");
      wrongTimerRef.current = window.setTimeout(() => {
        onSkip(true);
      }, 2000);
    }
  };

  const canSkip = celebrationGoal === null && (!picked || picked !== current.answer);
  const gapFilled = picked;

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
          total={drills.length}
          label={`${title} ${index + 1} από ${drills.length}`}
        />
        {sessionBanner && index === 0 && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">{current.instruction}</span>
        </p>

        {current.kind === "compound" && (
          <p className="drill-prompt drill-prompt--compound" aria-label="Σύνθεση">
            <span className="drill-compound-part">{current.prefix ?? ""}</span>
            <span className="drill-compound-plus">+</span>
            <span className="drill-compound-part">{current.suffix ?? ""}</span>
            <span className="drill-compound-eq">=</span>
            <span className="drill-gap drill-gap--wide">{gapFilled ?? "____"}</span>
          </p>
        )}

        {current.kind === "classify" && (
          <p className="drill-prompt drill-prompt--word">{current.prompt}</p>
        )}

        {current.kind === "article" && (
          <p className="drill-prompt">
            <span className={`drill-gap${gapFilled ? " drill-gap--answered" : ""}`}>
              {gapFilled ?? "____"}
            </span>{" "}
            <span>{current.prompt}</span>
          </p>
        )}

        {(current.kind === "ending" || current.kind === "infix" || current.kind === "cloze") && (
          <p className="drill-prompt">
            {current.prefix ? <span className="drill-prefix">{current.prefix} </span> : null}
            {renderPromptWithGap(current.prompt, gapFilled)}
          </p>
        )}

        {(current.kind === "binary" || current.kind === "choice") && (
          <p className="drill-prompt drill-prompt--soft">
            <span className="hint-label">
              {current.kind === "binary"
                ? "Ποια μορφή είναι σωστή;"
                : "Ποια λέξη είναι σωστά γραμμένη;"}
            </span>
          </p>
        )}

        {current.kind === "homophone" && (
          <p className="drill-prompt">{current.prompt}</p>
        )}

        <div
          className={`choice-grid${current.options.length > 2 ? " choice-grid--wide" : ""}${
            current.kind === "classify" ? " choice-grid--classify" : ""
          }`}
        >
          {options.map((option) => {
            let cls = "choice-btn";
            if (current.kind === "classify") cls += " choice-btn--bucket";
            if (picked) {
              if (option === current.answer) cls += " choice-btn--correct";
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

        {picked && picked === current.answer && (
          <p className="feedback-correct drill-feedback">{current.feedback}</p>
        )}

        {picked && picked !== current.answer && (
          <p className="feedback-correct">
            Σωστό: <strong>{current.answer}</strong>
            <span className="drill-feedback-detail">{current.feedback}</span>
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

export function DrillExercise({
  title,
  drills,
  batches = null,
  onComplete,
  onQuit,
  sessionBanner = null,
  profileId = null,
}: DrillExerciseProps) {
  if (batches && batches.length > 0) {
    return (
      <BatchDrillView
        title={title}
        batches={batches}
        onComplete={onComplete}
        onQuit={onQuit}
        sessionBanner={sessionBanner}
        profileId={profileId}
      />
    );
  }
  return (
    <SingleDrillView
      title={title}
      drills={drills}
      onComplete={onComplete}
      onQuit={onQuit}
      sessionBanner={sessionBanner}
    />
  );
}
