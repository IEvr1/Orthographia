import { useAuth, useUser } from "@clerk/clerk-react";
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

  migrateAllProfilesOnSignIn,

  syncProgressToServer,

} from "./lib/progressSync";

import { buildDailySession, gradesWithWords, previewDailySessionMix } from "./lib/session";

import { computeGradeStats } from "./lib/progressStats";

import { loadProgress } from "./lib/storage";

import { buildWeeklyWordSession, getWeeklyRule } from "./lib/weeklyRule";

import { hasLocalConsent, syncConsentToServer } from "./lib/consent";

import {

  canAccessGrade,

  canAccessMode,

  canAccessWeeklyRule,

  canUseCloudSync,

  FREE_DAILY_SESSIONS,

  isPaidTier,
  SUPER_ADMIN_TIER,

} from "./lib/access";
import { isSuperAdmin } from "./lib/superAdmin";

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

  isSuperAdmin: false,

  loading: false,

  error: null,

};



function AppShell({
  subscription,
  getToken,
  userId,
}: {
  subscription: SubscriptionState & { refresh?: () => Promise<void> };
  getToken?: () => Promise<string | null>;
  userId?: string | null;
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

  const [progressVersion, setProgressVersion] = useState(0);

  const importRef = useRef<HTMLInputElement>(null);



  const tier = subscription.tier;

  const showFamilyProfiles = tier === "family" && subscription.active;

  const isPaid = isPaidTier(tier);

  const activeProfile = useMemo(
    () => subscription.profiles.find((p) => p.id === activeProfileId) ?? null,
    [subscription.profiles, activeProfileId],
  );

  const dailyLimitReached = !canStartDailySession(isPaid, FREE_DAILY_SESSIONS);



  useEffect(() => {

    const params = new URLSearchParams(window.location.search);

    if (params.get("checkout") === "success") {

      void subscription.refresh?.();

      window.history.replaceState({}, "", window.location.pathname);

    }

  }, [subscription]);



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
    if (subscription.loading) return;

    if (!canAccessGrade(tier, selectedGrade)) {
      const fallback = [1, 2].find((g) => availableGrades.has(g)) ?? 1;
      setSelectedGrade(fallback);
    }

    if (!canAccessMode(tier, gameMode)) {
      setGameMode("dictation");
    }
  }, [subscription.loading, tier, selectedGrade, gameMode, availableGrades]);



  useEffect(() => {
    if (!showFamilyProfiles) {
      if (activeProfileId) {
        setActiveProfileId(null);
        setActiveProfileIdState(null);
      }
      return;
    }

    const profiles = subscription.profiles;
    if (profiles.length === 0) {
      setActiveProfileId(null);
      setActiveProfileIdState(null);
      return;
    }

    const stored = getActiveProfileId();
    const validStored = stored && profiles.some((p) => p.id === stored);
    const next = validStored ? profiles.find((p) => p.id === stored)! : profiles[0];
    if (next.id !== activeProfileId) {
      setActiveProfileId(next.id);
      setActiveProfileIdState(next.id);
    }
    setSelectedGrade(next.grade);
  }, [showFamilyProfiles, subscription.profiles, activeProfileId]);



  const handleSelectProfile = useCallback(
    (id: string) => {
      if (!id) {
        setActiveProfileId(null);
        setActiveProfileIdState(null);
        setProgressVersion((v) => v + 1);
        return;
      }

      const profile = subscription.profiles.find((p) => p.id === id);
      if (!profile) return;

      setActiveProfileId(id);
      setActiveProfileIdState(id);
      setSelectedGrade(profile.grade);
      setProgressVersion((v) => v + 1);
    },
    [subscription.profiles],
  );



  const gradeWords = useMemo(

    () => words.filter((w) => w.grade === selectedGrade),

    [words, selectedGrade],

  );



  const weeklyRule = useMemo(

    () => getWeeklyRule(rules, selectedGrade),

    [rules, selectedGrade],

  );



  const progressStore = useMemo(
    () => loadProgress(activeProfileId),
    [activeProfileId, progressVersion, screen],
  );

  const progressStats = useMemo(
    () => computeGradeStats(progressStore, words, selectedGrade),
    [progressStore, words, selectedGrade],
  );

  const masteredCount = progressStats.mastered;

  const sessionMix = useMemo(
    () => (gradeWords.length > 0 ? previewDailySessionMix(words, progressStore, selectedGrade) : null),
    [words, progressStore, selectedGrade, gradeWords.length, progressVersion],
  );



  const launchSession = useCallback(

    (kind: SessionKind) => {

      const store = loadProgress(activeProfileId);

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

    [words, selectedGrade, gameMode, weeklyRule, activeProfileId],

  );



  const startSession = useCallback(() => {

    setPaywallMessage(null);

    if (showFamilyProfiles && !activeProfileId) return;

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

  }, [launchSession, rules, selectedGrade, weeklyRule, tier, gameMode, isPaid, showFamilyProfiles, activeProfileId]);



  const startWeeklySession = useCallback(() => {

    if (!weeklyRule) return;

    if (showFamilyProfiles && !activeProfileId) return;

    if (!canAccessWeeklyRule(tier)) {

      setPaywallMessage("Ο κανόνας της εβδομάδας είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    setActiveRule(weeklyRule);

    setSessionKind("weekly");

    setScreen("rule");

  }, [weeklyRule, tier, showFamilyProfiles, activeProfileId]);



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

    setProgressVersion((v) => v + 1);

    setScreen("summary");

  };



  const handleImportProgress = () => {

    importRef.current?.click();

  };



  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    const text = await file.text();

    importProgressFromJson(text, activeProfileId);

    setProgressVersion((v) => v + 1);

    setScreen("home");

    e.target.value = "";

  };



  const handleSync = async () => {

    if (!canUseCloudSync(tier)) {

      setPaywallMessage("Ο συγχρονισμός cloud είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    const auth = { userId, getToken, profileId: activeProfileId };

    const ok = await syncProgressToServer(auth);

    if (!ok) {

      await fetchProgressFromServer(auth);

    }

    setProgressVersion((v) => v + 1);

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

          onExportProgress={() => downloadProgressBackup(activeProfileId)}

          onImportProgress={handleImportProgress}

          onSyncProgress={handleSync}

          onOpenPricing={() => setScreen("pricing")}

          syncEnabled={SYNC_ENABLED}

          masteredCount={masteredCount}

          totalWords={gradeWords.length}

          progressStats={progressStats}

          activeChildName={activeProfile?.name ?? null}

          sessionMix={sessionMix}

          selectedGrade={selectedGrade}

          availableGrades={availableGrades}

          onGradeChange={setSelectedGrade}

          gameMode={gameMode}

          onModeChange={setGameMode}

          weeklyRule={weeklyRule}

          tier={tier}

          subscriptionLoading={subscription.loading}

          isSuperAdmin={subscription.isSuperAdmin}

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
  const { isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const subscription = useSubscription();
  const migratedKeyRef = useRef<string | null>(null);

  const effectiveSubscription = useMemo(() => {
    const admin = subscription.isSuperAdmin || isSuperAdmin(email);
    if (!admin) return subscription;
    return {
      ...subscription,
      tier: SUPER_ADMIN_TIER,
      active: true,
      planType: SUPER_ADMIN_TIER,
      maxProfiles: Math.max(subscription.maxProfiles, 3),
      isSuperAdmin: true,
    };
  }, [subscription, email]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    void syncConsentToServer(getToken);
  }, [isSignedIn, getToken, userId]);

  useEffect(() => {
    if (!isSignedIn || !userId || subscription.loading) return;

    const profileIds =
      effectiveSubscription.tier === "family" && effectiveSubscription.active
        ? effectiveSubscription.profiles.map((p) => p.id)
        : [];
    const migrationKey = `${userId}:${profileIds.join(",")}`;
    if (migratedKeyRef.current === migrationKey) return;
    migratedKeyRef.current = migrationKey;

    void migrateAllProfilesOnSignIn({ userId, getToken }, profileIds);
  }, [
    isSignedIn,
    userId,
    getToken,
    effectiveSubscription.loading,
    effectiveSubscription.tier,
    effectiveSubscription.active,
    effectiveSubscription.profiles,
  ]);

  return <AppShell subscription={effectiveSubscription} getToken={getToken} userId={userId} />;
}



export default function App() {

  if (isClerkEnabled()) {

    return <AuthedApp />;

  }

  return <AppShell subscription={FREE_SUBSCRIPTION} />;

}


