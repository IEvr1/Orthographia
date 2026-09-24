import { useEffect, useMemo, useRef, useState } from "react";
import type { FamiliesPayload, SessionSummary, WordEntry } from "../types";
import { useExerciseFlow } from "../lib/useExerciseFlow";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { SessionProgress } from "./SessionProgress";

interface MatchingExerciseProps {
  words: WordEntry[];
  families?: FamiliesPayload | null;
  onComplete: (summary: SessionSummary) => void;
  onQuit: () => void;
  sessionBanner?: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function MatchingExercise({
  words,
  onComplete,
  onQuit,
  sessionBanner = null,
}: MatchingExerciseProps) {
  const rounds = useMemo(() => {
    const withDef = words.filter((w) => w.definition?.trim());
    const chunks: WordEntry[][] = [];
    for (let i = 0; i < withDef.length; i += 4) {
      const chunk = withDef.slice(i, i + 4);
      if (chunk.length >= 2) chunks.push(chunk);
    }
    return chunks;
  }, [words]);

  const flatForFlow = useMemo(
    () => rounds.map((r) => r[0]!).filter(Boolean),
    [rounds],
  );

  const {
    index,
    celebrationGoal,
    finishCelebration,
    onCorrect,
    onSkip,
  } = useExerciseFlow({
    words: flatForFlow.length > 0 ? flatForFlow : words.slice(0, 1),
    onComplete,
  });

  const round = rounds[index] ?? [];
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [hadMistake, setHadMistake] = useState(false);
  const completedRef = useRef(false);
  const defOrders = useRef<Map<number, WordEntry[]>>(new Map());

  const wordOrder = useMemo(() => shuffle(round), [index, round]);
  const defOrder = useMemo(() => {
    if (!defOrders.current.has(index)) {
      defOrders.current.set(index, shuffle(round));
    }
    return defOrders.current.get(index) ?? round;
  }, [index, round]);

  useEffect(() => {
    setSelectedWord(null);
    setMatched(new Set());
    setWrongId(null);
    setHadMistake(false);
    completedRef.current = false;
  }, [index]);

  const allMatched = round.length >= 2 && matched.size >= round.length;

  useEffect(() => {
    if (!allMatched || completedRef.current) return;
    completedRef.current = true;
    if (hadMistake) {
      // Count as correct round completion even with earlier mistakes — progress still advances
      onCorrect({ delayMs: 1200, hadRewrite: true });
    } else {
      onCorrect({ delayMs: 1200 });
    }
  }, [allMatched, hadMistake, onCorrect]);

  const handleWord = (word: string) => {
    if (matched.has(word) || allMatched) return;
    setSelectedWord(word);
    setWrongId(null);
  };

  const handleDef = (entry: WordEntry) => {
    if (!selectedWord || matched.has(entry.word) || allMatched) return;
    if (selectedWord === entry.word) {
      setMatched((prev) => new Set(prev).add(entry.word));
      setSelectedWord(null);
      setWrongId(null);
    } else {
      setHadMistake(true);
      setWrongId(entry.id);
      window.setTimeout(() => setWrongId(null), 700);
      setSelectedWord(null);
    }
  };

  if (rounds.length === 0) {
    return (
      <main className="screen screen--exercise fade-in">
        <header className="exercise-header">
          <button type="button" className="btn-text" onClick={onQuit}>
            ← Πίσω
          </button>
        </header>
        <p className="hint-text">Δεν υπάρχουν αρκετοί ορισμοί για ταίριασμα σε αυτή την τάξη.</p>
        <button type="button" className="btn btn-primary" onClick={onQuit}>
          Αρχική
        </button>
      </main>
    );
  }

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
          total={flatForFlow.length}
          label={`Ταίριασμα ${index + 1} από ${flatForFlow.length}`}
        />
        {sessionBanner && index === 0 && (
          <p className="session-banner" role="status">
            {sessionBanner}
          </p>
        )}
      </header>

      <section className="exercise-body">
        <p className="hint-sentence">
          <span className="hint-label">Ταίριασε λέξη με ορισμό</span>
        </p>

        <div className="match-board">
          <div className="match-col">
            {wordOrder.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`match-chip${selectedWord === w.word ? " match-chip--selected" : ""}${matched.has(w.word) ? " match-chip--done" : ""}`}
                disabled={matched.has(w.word) || allMatched}
                onClick={() => handleWord(w.word)}
              >
                {w.word}
              </button>
            ))}
          </div>
          <div className="match-col">
            {defOrder.map((w) => (
              <button
                key={`def-${w.id}`}
                type="button"
                className={`match-chip match-chip--def${wrongId === w.id ? " match-chip--wrong" : ""}${matched.has(w.word) ? " match-chip--done" : ""}`}
                disabled={matched.has(w.word) || allMatched || !selectedWord}
                onClick={() => handleDef(w)}
              >
                {w.definition}
              </button>
            ))}
          </div>
        </div>

        {celebrationGoal === null && !allMatched && (
          <button
            type="button"
            className="btn btn-secondary exercise-skip"
            onClick={() => onSkip(false)}
          >
            Παράλειψη γύρου
          </button>
        )}
      </section>
    </main>
  );
}
