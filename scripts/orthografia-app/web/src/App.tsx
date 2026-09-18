import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {

  AppScreen,

  FamiliesPayload,

  GameMode,

  RuleDefinition,

  RulesPayload,

  SessionSummary,

  WordEntry,

  WordsPayload,

} from "./types";

import {

  downloadProgressBackup,

  fetchProgressFromServer,

  importProgressFromJson,

  isProgressSyncAvailable,

  syncProgressToServer,

} from "./lib/progressSync";

import { buildDailySession, gradesWithWords } from "./lib/session";

import { getWordProgress, loadProgress } from "./lib/storage";

import { buildWeeklyWordSession, getWeeklyRule } from "./lib/weeklyRule";

import { hasLocalConsent, syncConsentToServer } from "./lib/consent";

import {

  canAccessGrade,

  canAccessMode,

  canAccessWeeklyRule,

  canUseCloudSync,

  FREE_DAILY_SESSIONS,

  isPaidTier,

} from "./lib/access";

import {

  canStartDailySession,

  incrementDailySessionCount,

} from "./lib/dailyLimit";

import {

  getActiveProfileId,

  isClerkEnabled,

  setActiveProfileId,

  useSubscription,

  type SubscriptionState,

} from "./lib/subscription";

import { ChoiceExercise } from "./components/ChoiceExercise";

import { ConsentScreen } from "./components/ConsentScreen";

import { DictationExercise } from "./components/DictationExercise";

import { HomeScreen } from "./components/HomeScreen";

import { PricingScreen } from "./components/PricingScreen";

import { ReverseExercise } from "./components/ReverseExercise";

import { RuleCard } from "./components/RuleCard";

import { SentenceExercise } from "./components/SentenceExercise";

import { SessionSummary as SummaryScreen } from "./components/SessionSummary";



const RULES_SEEN_KEY = "orthografia-seen-rules";

const SYNC_ENABLED = isProgressSyncAvailable();



type SessionKind = "daily" | "weekly";



const FREE_SUBSCRIPTION: SubscriptionState = {

  tier: "free",

  active: false,

  planType: "free",

  maxProfiles: 1,

  profiles: [],

  currentPeriodEnd: null,

  loading: false,

  error: null,

};



function AppShell({
  subscription,
  getToken,
}: {
  subscription: SubscriptionState & { refresh?: () => Promise<void> };
  getToken?: () => Promise<string | null>;
}) {

  const [consentGiven, setConsentGiven] = useState(hasLocalConsent());

  const [screen, setScreen] = useState<AppScreen>("home");

  const [words, setWords] = useState<WordEntry[]>([]);

  const [rules, setRules] = useState<RuleDefinition[]>([]);

  const [families, setFamilies] = useState<FamiliesPayload>({});

  const [sessionWords, setSessionWords] = useState<WordEntry[]>([]);

  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedGrade, setSelectedGrade] = useState(3);

  const [gameMode, setGameMode] = useState<GameMode>("dictation");

  const [activeRule, setActiveRule] = useState<RuleDefinition | null>(null);

  const [sessionKind, setSessionKind] = useState<SessionKind>("daily");

  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() => getActiveProfileId());

  const importRef = useRef<HTMLInputElement>(null);



  const tier = subscription.tier;

  const showFamilyProfiles = tier === "family" && subscription.active;

  const isPaid = isPaidTier(tier);

  const dailyLimitReached = !canStartDailySession(isPaid, FREE_DAILY_SESSIONS);



  useEffect(() => {

    const params = new URLSearchParams(window.location.search);

    if (params.get("checkout") === "success") {

      void subscription.refresh?.();

      window.history.replaceState({}, "", window.location.pathname);

    }

  }, [subscription]);



  useEffect(() => {

    if (!showFamilyProfiles) return;

    const profiles = subscription.profiles;

    if (profiles.length === 0) {

      setActiveProfileIdState(null);

      setActiveProfileId(null);

      return;

    }

    const storedId = getActiveProfileId();

    const active = profiles.find((p) => p.id === storedId) ?? profiles[0];

    setActiveProfileIdState(active.id);

    setActiveProfileId(active.id);

    setSelectedGrade(active.grade);

  }, [showFamilyProfiles, subscription.profiles]);



  const handleSelectProfile = useCallback(

    (id: string) => {

      if (!id) {

        setActiveProfileIdState(null);

        setActiveProfileId(null);

        return;

      }

      const profile = subscription.profiles.find((p) => p.id === id);

      if (!profile) return;

      setActiveProfileIdState(id);

      setActiveProfileId(id);

      setSelectedGrade(profile.grade);

    },

    [subscription.profiles],

  );



  useEffect(() => {

    Promise.all([

      fetch("/content/words.json").then((r) => {

        if (!r.ok) throw new Error("Δεν βρέθηκε το words.json");

        return r.json() as Promise<WordsPayload>;

      }),

      fetch("/content/rules.json")

        .then((r) => (r.ok ? (r.json() as Promise<RulesPayload>) : { rules: [] }))

        .catch(() => ({ rules: [] })),

      fetch("/content/families.json")

        .then((r) => (r.ok ? (r.json() as Promise<FamiliesPayload>) : {}))

        .catch(() => ({})),

    ])

      .then(([wordsData, rulesData, familiesData]) => {

        setWords(wordsData.words);

        setRules(rulesData.rules ?? []);

        setFamilies(familiesData);

        const grades = gradesWithWords(wordsData.words);

        if (!grades.has(selectedGrade)) {

          const defaultGrade = grades.has(3) ? 3 : [...grades].sort()[0];

          if (defaultGrade != null) setSelectedGrade(defaultGrade);

        }

      })

      .catch((err: Error) => setLoadError(err.message));

  }, []);



  const availableGrades = useMemo(() => gradesWithWords(words), [words]);



  useEffect(() => {

    if (!canAccessGrade(tier, selectedGrade)) {

      const fallback = [1, 2].find((g) => availableGrades.has(g)) ?? 1;

      setSelectedGrade(fallback);

    }

    if (!canAccessMode(tier, gameMode)) {

      setGameMode("dictation");

    }

  }, [tier, selectedGrade, gameMode, availableGrades]);



  const gradeWords = useMemo(

    () => words.filter((w) => w.grade === selectedGrade),

    [words, selectedGrade],

  );



  const weeklyRule = useMemo(

    () => getWeeklyRule(rules, selectedGrade),

    [rules, selectedGrade],

  );



  const masteredCount = useMemo(() => {

    const store = loadProgress();

    return gradeWords.filter((w) => getWordProgress(store, w.id).mastered).length;

  }, [gradeWords, screen, activeProfileId]);



  const launchSession = useCallback(

    (kind: SessionKind) => {

      const store = loadProgress();

      let daily =

        kind === "weekly" && weeklyRule

          ? buildWeeklyWordSession(words, weeklyRule, selectedGrade, 5)

          : buildDailySession(words, store, selectedGrade);



      if (gameMode === "reverse") {

        daily = daily.filter((w) => w.definition || w.feedbackRule);

      }

      if (gameMode === "choice") {

        daily = daily.filter((w) => w.hintSentence.includes("___"));

      }

      if (daily.length === 0) {

        daily = buildDailySession(words, store, selectedGrade);

      }

      setSessionKind(kind);

      setSessionWords(daily);

      setSummary(null);

      setScreen("exercise");

    },

    [words, selectedGrade, gameMode, weeklyRule],

  );



  const startSession = useCallback(() => {

    setPaywallMessage(null);

    if (!canAccessGrade(tier, selectedGrade)) {

      setPaywallMessage("Αυτή η τάξη είναι διαθέσιμη με Premium.");

      setScreen("pricing");

      return;

    }

    if (!canAccessMode(tier, gameMode)) {

      setPaywallMessage("Αυτός ο τρόπος εξάσκησης είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    if (!canStartDailySession(isPaid, FREE_DAILY_SESSIONS)) {

      setPaywallMessage(`Έφτασες το όριο ${FREE_DAILY_SESSIONS} ημερήσια session στο δωρεάν πλάνο.`);

      setScreen("pricing");

      return;

    }



    setSessionKind("daily");

    const rule = weeklyRule ?? rules.find((r) => r.grades.includes(selectedGrade)) ?? null;

    const seen = JSON.parse(localStorage.getItem(RULES_SEEN_KEY) || "{}") as Record<string, boolean>;

    if (rule && !seen[rule.id] && canAccessWeeklyRule(tier)) {

      setActiveRule(rule);

      setScreen("rule");

      return;

    }

    incrementDailySessionCount();

    launchSession("daily");

  }, [launchSession, rules, selectedGrade, weeklyRule, tier, gameMode, isPaid]);



  const startWeeklySession = useCallback(() => {

    if (!weeklyRule) return;

    if (!canAccessWeeklyRule(tier)) {

      setPaywallMessage("Ο κανόνας της εβδομάδας είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    setActiveRule(weeklyRule);

    setSessionKind("weekly");

    setScreen("rule");

  }, [weeklyRule, tier]);



  const handleRuleContinue = () => {

    if (activeRule) {

      const seen = JSON.parse(localStorage.getItem(RULES_SEEN_KEY) || "{}") as Record<string, boolean>;

      seen[activeRule.id] = true;

      localStorage.setItem(RULES_SEEN_KEY, JSON.stringify(seen));

    }

    if (sessionKind === "daily") {

      incrementDailySessionCount();

    }

    launchSession(sessionKind);

  };



  const handleComplete = (s: SessionSummary) => {

    setSummary(s);

    setScreen("summary");

  };



  const handleImportProgress = () => {

    importRef.current?.click();

  };



  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    const text = await file.text();

    importProgressFromJson(text);

    setScreen("home");

    e.target.value = "";

  };



  const handleSync = async () => {

    if (!canUseCloudSync(tier)) {

      setPaywallMessage("Ο συγχρονισμός cloud είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    const ok = await syncProgressToServer();

    if (!ok) {

      await fetchProgressFromServer();

    }

    setScreen("home");

  };



  if (!consentGiven) {

    return <ConsentScreen onAccepted={() => setConsentGiven(true)} />;

  }



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

      <input

        ref={importRef}

        type="file"

        accept="application/json,.json"

        hidden

        onChange={onImportFile}

      />

      {screen === "home" && (

        <HomeScreen

          onStart={startSession}

          onWeeklyStart={startWeeklySession}

          onExportProgress={downloadProgressBackup}

          onImportProgress={handleImportProgress}

          onSyncProgress={handleSync}

          onOpenPricing={() => setScreen("pricing")}

          syncEnabled={SYNC_ENABLED}

          masteredCount={masteredCount}

          totalWords={gradeWords.length}

          selectedGrade={selectedGrade}

          availableGrades={availableGrades}

          onGradeChange={setSelectedGrade}

          gameMode={gameMode}

          onModeChange={setGameMode}

          weeklyRule={weeklyRule}

          tier={tier}

          dailyLimitReached={dailyLimitReached}

          familyProfiles={

            showFamilyProfiles && getToken

              ? {

                  profiles: subscription.profiles,

                  maxProfiles: subscription.maxProfiles,

                  activeProfileId,

                  getToken,

                  onSelectProfile: handleSelectProfile,

                  onRefreshProfiles: subscription.refresh ?? (async () => {}),

                }

              : undefined

          }

        />

      )}

      {screen === "pricing" && (

        <>

          {paywallMessage && <p className="pricing-banner">{paywallMessage}</p>}

          <PricingScreen onBack={() => setScreen("home")} />

        </>

      )}

      {screen === "rule" && activeRule && (

        <RuleCard rule={activeRule} onContinue={handleRuleContinue} />

      )}

      {screen === "exercise" && sessionWords.length > 0 && gameMode === "dictation" && (

        <DictationExercise

          words={sessionWords}

          families={families}

          onComplete={handleComplete}

          onQuit={() => setScreen("home")}

        />

      )}

      {screen === "exercise" && sessionWords.length > 0 && gameMode === "reverse" && (

        <ReverseExercise

          words={sessionWords}

          onComplete={handleComplete}

          onQuit={() => setScreen("home")}

        />

      )}

      {screen === "exercise" && sessionWords.length > 0 && gameMode === "choice" && (

        <ChoiceExercise

          words={sessionWords}

          allWords={gradeWords}

          onComplete={handleComplete}

          onQuit={() => setScreen("home")}

        />

      )}

      {screen === "exercise" && sessionWords.length > 0 && gameMode === "sentence" && (

        <SentenceExercise

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



function AuthedApp() {
  const { isSignedIn, getToken } = useAuth();
  const subscription = useSubscription();

  useEffect(() => {
    if (!isSignedIn) return;
    void syncConsentToServer(getToken);
  }, [isSignedIn, getToken]);

  return <AppShell subscription={subscription} getToken={getToken} />;
}



export default function App() {

  if (isClerkEnabled()) {

    return <AuthedApp />;

  }

  return <AppShell subscription={FREE_SUBSCRIPTION} />;

}


