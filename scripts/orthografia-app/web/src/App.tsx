import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppScreen, SessionSummary, WordEntry, WordsPayload } from "./types";
import { buildDailySession, gradesWithWords } from "./lib/session";
import { getWordProgress, loadProgress } from "./lib/storage";
import { DictationExercise } from "./components/DictationExercise";
import { HomeScreen } from "./components/HomeScreen";
import { RuleCard } from "./components/RuleCard";
import { SessionSummary as SummaryScreen } from "./components/SessionSummary";

const TONOS_RULE_KEY = "orthografia-seen-tonos-rule";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [sessionWords, setSessionWords] = useState<WordEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState(3);

  useEffect(() => {
    fetch("/content/words.json")
      .then((r) => {
        if (!r.ok) throw new Error("Δεν βρέθηκε το words.json");
        return r.json() as Promise<WordsPayload>;
      })
      .then((data) => {
        setWords(data.words);
        const grades = gradesWithWords(data.words);
        if (!grades.has(selectedGrade)) {
          const defaultGrade = grades.has(3) ? 3 : [...grades].sort()[0];
          if (defaultGrade != null) setSelectedGrade(defaultGrade);
        }
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const availableGrades = useMemo(() => gradesWithWords(words), [words]);

  const gradeWords = useMemo(
    () => words.filter((w) => w.grade === selectedGrade),
    [words, selectedGrade]
  );

  const masteredCount = useMemo(() => {
    const store = loadProgress();
    return gradeWords.filter((w) => getWordProgress(store, w.id).mastered).length;
  }, [gradeWords, screen]);

  const launchSession = useCallback(() => {
    const store = loadProgress();
    const daily = buildDailySession(words, store, selectedGrade);
    setSessionWords(daily);
    setSummary(null);
    setScreen("exercise");
  }, [words, selectedGrade]);

  const startSession = useCallback(() => {
    const seenRule = localStorage.getItem(TONOS_RULE_KEY);
    if (!seenRule) {
      setScreen("rule");
      return;
    }
    launchSession();
  }, [launchSession]);

  const handleRuleContinue = () => {
    localStorage.setItem(TONOS_RULE_KEY, "1");
    launchSession();
  };

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
        <HomeScreen
          onStart={startSession}
          masteredCount={masteredCount}
          totalWords={gradeWords.length}
          selectedGrade={selectedGrade}
          availableGrades={availableGrades}
          onGradeChange={setSelectedGrade}
        />
      )}
      {screen === "rule" && <RuleCard onContinue={handleRuleContinue} />}
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
