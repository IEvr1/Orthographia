import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {

  AppScreen,

  GameMode,

  RuleDefinition,

  RulesPayload,

  SessionSummary,

  WordEntry,

  WordsPayload,

} from "./types";

import {

  fetchProgressFromServer,

  isProgressSyncAvailable,

  migrateAllProfilesOnSignIn,

  syncProgressToServer,

} from "./lib/progressSync";

import { buildDailySession, gradesWithWords } from "./lib/session";

import { getRewardGoal, setRewardGoal } from "./lib/settings";
import { getRewardPoints, loadProgress } from "./lib/storage";

import { buildWeeklyWordSession, getWeeklyRule } from "./lib/weeklyRule";

import { hasLocalConsent, syncConsentToServer } from "./lib/consent";

import {

  canAccessGrade,

  canAccessMode,

  canAccessWeeklyRule,

  canStartPractice,

  canUseCloudSync,

  FREE_DAILY_SESSIONS,

  FREE_GRADES,

  hasFullContentAccess,

  SUPER_ADMIN_TIER,

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

import { HomeScreen } from "./components/HomeScreen";

import { PricingScreen } from "./components/PricingScreen";

import { SettingsScreen } from "./components/SettingsScreen";

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

  trialStartedAt: null,

  trialEndsAt: null,

  trialActive: false,

  trialDaysLeft: 0,

  loading: false,

  error: null,

};



function AppShell({
  subscription,
  getToken,
  userId,
  isSignedIn = false,
}: {
  subscription: SubscriptionState & {
    refresh?: () => Promise<void>;
    startCheckout?: (plan: "monthly" | "yearly" | "family") => Promise<string | null>;
    openPortal?: () => Promise<string | null>;
  };
  getToken?: () => Promise<string | null>;
  userId?: string | null;
  isSignedIn?: boolean;
}) {

  const [consentGiven, setConsentGiven] = useState(hasLocalConsent());

  const [screen, setScreen] = useState<AppScreen>("home");

  const [words, setWords] = useState<WordEntry[]>([]);

  const [rules, setRules] = useState<RuleDefinition[]>([]);

  const [sessionWords, setSessionWords] = useState<WordEntry[]>([]);

  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(2);

  const [gameMode, setGameMode] = useState<GameMode>("sentence");

  const [activeRule, setActiveRule] = useState<RuleDefinition | null>(null);

  const [sessionKind, setSessionKind] = useState<SessionKind>("daily");

  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  const [settingsAddChild, setSettingsAddChild] = useState(false);

  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() => getActiveProfileId());

  const [progressVersion, setProgressVersion] = useState(0);

  const [rewardGoal, setRewardGoalState] = useState(() => getRewardGoal());

  const tier = subscription.tier;

  // Settings: any signed-in user may manage profiles up to maxProfiles (free/child: 1, family: 3).
  const canManageProfiles = Boolean(isSignedIn && getToken && subscription.maxProfiles >= 1);
  // Home/practice: require an active child for multi-profile plans, or once any profile exists.
  const showFamilyProfiles =
    canManageProfiles && (subscription.maxProfiles > 1 || subscription.profiles.length > 0);

  const trialActive = Boolean(isSignedIn && subscription.trialActive);
  const trialDaysLeft = isSignedIn ? subscription.trialDaysLeft : 0;
  const trialExpired = Boolean(
    isSignedIn && subscription.trialStartedAt && !subscription.trialActive,
  );
  const unlimitedSessions = hasFullContentAccess(tier, trialActive);

  const activeProfile = useMemo(
    () => subscription.profiles.find((p) => p.id === activeProfileId) ?? null,
    [subscription.profiles, activeProfileId],
  );

  const dailyLimitReached = !canStartDailySession(unlimitedSessions, FREE_DAILY_SESSIONS);



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

    ])

      .then(([wordsData, rulesData]) => {

        setWords(wordsData.words);

        setRules(rulesData.rules ?? []);

        const grades = gradesWithWords(wordsData.words);

        if (!grades.has(selectedGrade)) {

          const defaultGrade = grades.has(3) ? 3 : [...grades].sort()[0];

          if (defaultGrade != null) setSelectedGrade(defaultGrade);

        }

        setContentReady(true);

      })

      .catch((err: Error) => {
        setLoadError(err.message);
        setContentReady(true);
      });

  }, []);



  const availableGrades = useMemo(() => gradesWithWords(words), [words]);



  useEffect(() => {
    if (subscription.loading) return;

    if (!canAccessGrade(tier, selectedGrade, trialActive)) {
      const freeFallback = [...FREE_GRADES].find((g) => availableGrades.has(g));
      const anyFallback = [...availableGrades].sort((a, b) => a - b)[0];
      setSelectedGrade(freeFallback ?? anyFallback ?? 2);
    }
  }, [subscription.loading, tier, trialActive, selectedGrade, availableGrades]);

  useEffect(() => {
    if (subscription.loading) return;
    setGameMode((current) => (canAccessMode(tier, current, trialActive) ? current : "sentence"));
  }, [subscription.loading, tier, trialActive]);



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
      setSelectedGrade(profile.grade >= 2 && profile.grade <= 6 ? profile.grade : 2);
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

  const rewardPoints = getRewardPoints(progressStore);

  const handleRewardGoalChange = useCallback((goal: number) => {
    setRewardGoalState(setRewardGoal(goal));
  }, []);



  const launchSession = useCallback(

    (kind: SessionKind) => {

      const store = loadProgress(activeProfileId);

      let daily =

        kind === "weekly" && weeklyRule

          ? buildWeeklyWordSession(words, weeklyRule, selectedGrade, 5)

          : buildDailySession(words, store, selectedGrade);



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

    if (!canStartPractice(isSignedIn, isClerkEnabled())) return;

    if (showFamilyProfiles && !activeProfileId) return;

    if (!canAccessGrade(tier, selectedGrade, trialActive)) {

      setPaywallMessage("Αυτή η τάξη είναι διαθέσιμη με Premium.");

      setScreen("pricing");

      return;

    }

    if (!canAccessMode(tier, gameMode, trialActive)) {

      setPaywallMessage("Αυτός ο τρόπος εξάσκησης είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    if (!canStartDailySession(unlimitedSessions, FREE_DAILY_SESSIONS)) {

      setPaywallMessage(`Έφτασες το όριο ${FREE_DAILY_SESSIONS} ημερήσια session στο δωρεάν πλάνο.`);

      setScreen("pricing");

      return;

    }



    setSessionKind("daily");

    const rule = weeklyRule ?? rules.find((r) => r.grades.includes(selectedGrade)) ?? null;

    const seen = JSON.parse(localStorage.getItem(RULES_SEEN_KEY) || "{}") as Record<string, boolean>;

    if (rule && !seen[rule.id] && canAccessWeeklyRule(tier, trialActive)) {

      setActiveRule(rule);

      setScreen("rule");

      return;

    }

    incrementDailySessionCount();

    launchSession("daily");

  }, [launchSession, rules, selectedGrade, weeklyRule, tier, trialActive, gameMode, unlimitedSessions, showFamilyProfiles, activeProfileId, isSignedIn]);



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



  const handleSync = async () => {

    if (!canUseCloudSync(tier)) {

      setPaywallMessage("Ο συγχρονισμός με άλλες συσκευές είναι διαθέσιμος με Premium.");

      setScreen("pricing");

      return;

    }

    const auth = { userId, getToken, profileId: activeProfileId };

    const ok = await syncProgressToServer(auth);

    if (!ok) {

      await fetchProgressFromServer(auth);

    }

    setProgressVersion((v) => v + 1);

  };



  const openSettings = useCallback((options?: { addChild?: boolean }) => {

    setSettingsAddChild(Boolean(options?.addChild));

    setScreen("settings");

  }, []);



  const closeSettings = useCallback(() => {

    setSettingsAddChild(false);

    setScreen("home");

  }, []);



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



  if (!contentReady && !loadError) {

    return (

      <main className="screen screen--home">

        <p className="loading">Φόρτωση…</p>

      </main>

    );

  }



  if (words.length === 0 && !loadError) {

    return (

      <main className="screen screen--home">

        <p className="loading">Δεν υπάρχουν ακόμη λέξεις. Το περιεχόμενο θα ξαναχτιστεί από την αρχή.</p>

      </main>

    );

  }



  return (

    <div className="app">

      {screen === "home" && (

        <HomeScreen

          onStart={startSession}

          onOpenSettings={openSettings}

          onOpenPricing={() => setScreen("pricing")}

          activeChildName={activeProfile?.name ?? null}

          selectedGrade={selectedGrade}

          availableGrades={availableGrades}

          onGradeChange={setSelectedGrade}

          gameMode={gameMode}

          onModeChange={setGameMode}

          tier={tier}

          subscriptionLoading={subscription.loading}

          isSuperAdmin={subscription.isSuperAdmin}

          dailyLimitReached={dailyLimitReached}

          showFamilyProfiles={showFamilyProfiles}

          trialActive={trialActive}

          trialDaysLeft={trialDaysLeft}

          trialExpired={trialExpired}

          isSignedIn={isSignedIn}

          rewardPoints={rewardPoints}

          rewardGoal={rewardGoal}

        />

      )}

      {screen === "settings" && (

        <SettingsScreen

          onBack={closeSettings}

          onOpenPricing={() => setScreen("pricing")}

          onSyncProgress={handleSync}

          syncEnabled={SYNC_ENABLED}

          tier={tier}

          isSuperAdmin={subscription.isSuperAdmin}

          autoOpenAddChild={settingsAddChild}

          rewardGoal={rewardGoal}

          onRewardGoalChange={handleRewardGoalChange}

          familyProfiles={

            canManageProfiles && getToken

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

          <PricingScreen
            onBack={() => setScreen("home")}
            tier={tier}
            active={subscription.active}
            currentPeriodEnd={subscription.currentPeriodEnd}
            startCheckout={subscription.startCheckout}
            openPortal={subscription.openPortal}
          />

        </>

      )}

      {screen === "rule" && activeRule && (

        <RuleCard rule={activeRule} onContinue={handleRuleContinue} />

      )}

      {screen === "exercise" && sessionWords.length > 0 && gameMode === "sentence" && (

        <SentenceExercise

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

      {screen === "summary" && summary && (

        <SummaryScreen summary={summary} onHome={() => setScreen("home")} />

      )}

    </div>

  );

}



function AuthedApp() {
  const { isSignedIn, getToken, userId } = useAuth();
  const subscription = useSubscription();
  const migratedKeyRef = useRef<string | null>(null);

  // Only elevate when the API confirmed super-admin (avoids fake family UI when auth fails).
  const effectiveSubscription = useMemo(() => {
    if (!subscription.isSuperAdmin) return subscription;
    return {
      ...subscription,
      tier: SUPER_ADMIN_TIER,
      active: true,
      planType: SUPER_ADMIN_TIER,
      maxProfiles: Math.max(subscription.maxProfiles, 3),
      isSuperAdmin: true,
    };
  }, [subscription]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    void syncConsentToServer(getToken);
  }, [isSignedIn, getToken, userId]);

  useEffect(() => {
    if (!isSignedIn || !userId || subscription.loading) return;

    const profileIds =
      effectiveSubscription.maxProfiles >= 1
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
    effectiveSubscription.maxProfiles,
    effectiveSubscription.profiles,
  ]);

  return <AppShell subscription={effectiveSubscription} getToken={getToken} userId={userId} isSignedIn={Boolean(isSignedIn)} />;
}



export default function App() {

  if (isClerkEnabled()) {

    return <AuthedApp />;

  }

  return <AppShell subscription={FREE_SUBSCRIPTION} />;

}


