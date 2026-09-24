import { useCallback, useRef, useState } from "react";
import type { ErrorCategory, SessionSummary, WordEntry } from "../types";
import { getRewardGoal } from "./settings";
import {
  clearRewardPointsAfterCelebration,
  getRewardPoints,
  loadProgress,
  recordAttempt,
  saveProgress,
  type ProgressStore,
} from "./storage";
import { recordSessionDay, unlockBadgesAfterSession } from "./streakBadges";
import { recordErrorCategory } from "./weakness";

interface UseExerciseFlowOptions<T extends { id: string } = WordEntry> {
  /** @deprecated Prefer `items` — kept for existing word exercises. */
  words?: T[];
  items?: T[];
  onComplete: (summary: SessionSummary) => void;
  profileId?: string | null;
}

export function useExerciseFlow<T extends { id: string } = WordEntry>({
  words,
  items,
  onComplete,
  profileId,
}: UseExerciseFlowOptions<T>) {
  const list = items ?? words ?? [];
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<SessionSummary>({
    total: list.length,
    correct: 0,
    wrong: 0,
    rewrites: 0,
  });
  const [celebrationGoal, setCelebrationGoal] = useState<number | null>(null);
  const pendingAdvanceRef = useRef<SessionSummary | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const current = list[index]!;

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const advance = useCallback(
    (nextSummary: SessionSummary) => {
      clearAdvanceTimer();
      if (index + 1 >= list.length) {
        let store = loadProgress(profileId);
        store = recordSessionDay(store);
        store = unlockBadgesAfterSession(store, nextSummary);
        saveProgress(store, profileId);
        onComplete(nextSummary);
      } else {
        setIndex((i) => i + 1);
      }
    },
    [clearAdvanceTimer, index, onComplete, profileId, list.length],
  );

  const finishCelebration = useCallback(() => {
    clearRewardPointsAfterCelebration(profileId);
    setCelebrationGoal(null);
    const pending = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    if (pending) advance(pending);
  }, [advance, profileId]);

  const persistAttempt = useCallback(
    (
      correct: boolean,
      hadRewrite: boolean,
      errorCategory?: ErrorCategory | null,
    ): ProgressStore => {
      let store = loadProgress(profileId);
      store = recordAttempt(store, current.id, correct, hadRewrite, errorCategory);
      if (!correct && errorCategory) {
        store = recordErrorCategory(store, errorCategory);
      }
      saveProgress(store, profileId);
      return store;
    },
    [current.id, profileId],
  );

  const scheduleAdvance = useCallback(
    (next: SessionSummary, delayMs: number, celebrate: boolean) => {
      if (celebrate) {
        pendingAdvanceRef.current = next;
        setCelebrationGoal(getRewardGoal());
        return;
      }
      clearAdvanceTimer();
      advanceTimerRef.current = window.setTimeout(() => advance(next), delayMs);
    },
    [advance, clearAdvanceTimer],
  );

  const onCorrect = useCallback(
    (opts?: { hadRewrite?: boolean; delayMs?: number }) => {
      const hadRewrite = opts?.hadRewrite ?? false;
      const store = persistAttempt(true, hadRewrite);
      const goal = getRewardGoal();
      const celebrate = !hadRewrite && getRewardPoints(store) >= goal;
      setSummary((s) => {
        const next = {
          ...s,
          correct: s.correct + 1,
          rewrites: hadRewrite ? s.rewrites + 1 : s.rewrites,
        };
        scheduleAdvance(next, opts?.delayMs ?? 1200, celebrate);
        return next;
      });
    },
    [persistAttempt, scheduleAdvance],
  );

  const onWrong = useCallback(
    (errorCategory?: ErrorCategory | null) => {
      persistAttempt(false, false, errorCategory);
      setSummary((s) => ({ ...s, wrong: s.wrong + 1 }));
    },
    [persistAttempt],
  );

  const onSkip = useCallback(
    (alreadyWrong: boolean) => {
      clearAdvanceTimer();
      setSummary((s) => {
        let next = s;
        if (!alreadyWrong) {
          persistAttempt(false, false);
          next = { ...s, wrong: s.wrong + 1 };
        }
        advance(next);
        return next;
      });
    },
    [advance, clearAdvanceTimer, persistAttempt],
  );

  return {
    index,
    current,
    summary,
    celebrationGoal,
    finishCelebration,
    advance,
    onCorrect,
    onWrong,
    onSkip,
    clearAdvanceTimer,
    setSummary,
    persistAttempt,
    scheduleAdvance,
  };
}
