import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppScreen, SessionSummary, WordEntry, WordsPayload } from "./types";
import { buildDailySession } from "./lib/session";
import { getWordProgress, loadProgress } from "./lib/storage";
import { DictationExercise } from "./components/DictationExercise";
import { HomeScreen } from "./components/HomeScreen";
import { SessionSummary as SummaryScreen } from "./components/SessionSummary";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [sessionWords, setSessionWords] = useState<WordEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/content/words.json")
      .then((r) => {
        if (!r.ok) throw new Error("Δεν βρέθηκε το words.json");
        return r.json() as Promise<WordsPayload>;
      })
      .then((data) => setWords(data.words))
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const masteredCount = useMemo(() => {
    const store = loadProgress();
    return words.filter((w) => getWordProgress(store, w.id).mastered).length;
  }, [words, screen]);

  const startSession = useCallback(() => {
    const store = loadProgress();
    const daily = buildDailySession(words, store);
    setSessionWords(daily);
    setSummary(null);
    setScreen("exercise");
  }, [words]);

  const handleComplete = (s: SessionSummary) => {
    setSummary(s);
    setScreen("summary");
  };

  if (loadError) {
    return (
      <main className="screen screen--home">
        <p className="error-msg">Σφάλμα: {loadError}</p>
      </main>
    );
  }

  if (words.length === 0 && !loadError) {
    return (
      <main className="screen screen--home">
        <p className="loading">Φόρτωση…</p>
      </main>
    );
  }

  return (
    <div className="app">
      {screen === "home" && (
        <HomeScreen onStart={startSession} masteredCount={masteredCount} totalWords={words.length} />
      )}
      {screen === "exercise" && sessionWords.length > 0 && (
        <DictationExercise
          words={sessionWords}
          onComplete={handleComplete}
          onQuit={() => setScreen("home")}
        />
      )}
      {screen === "summary" && summary && (
        <SummaryScreen summary={summary} onHome={() => setScreen("home")} />
      )}
    </div>
  );
}
