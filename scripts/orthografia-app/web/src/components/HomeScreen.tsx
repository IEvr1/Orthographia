import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import type { GameMode } from "../types";
import type { PlanTier } from "../lib/access";
import { canAccessGrade, canAccessMode, canStartPractice, isPaidTier } from "../lib/access";
import { GRADE_LABELS, OFFERED_GRADES } from "../lib/grades";
import { isClerkEnabled } from "../lib/subscription";
import { SettingsIcon } from "./SettingsScreen";

const MODE_LABELS: Record<GameMode, string> = {
  sentence: "Πρόταση",
  choice: "Διάλεξε",
};

interface HomeScreenProps {
  onStart: () => void;
  onOpenSettings: (options?: { addChild?: boolean }) => void;
  onOpenPricing: () => void;
  activeChildName?: string | null;
  selectedGrade: number;
  availableGrades: Set<number>;
  onGradeChange: (grade: number) => void;
  gameMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  tier: PlanTier;
  subscriptionLoading: boolean;
  isSuperAdmin?: boolean;
  dailyLimitReached: boolean;
  showFamilyProfiles: boolean;
  trialActive?: boolean;
  trialDaysLeft?: number;
  trialExpired?: boolean;
  isSignedIn?: boolean;
  rewardPoints: number;
  rewardGoal: number;
}

export function HomeScreen({
  onStart,
  onOpenSettings,
  onOpenPricing,
  activeChildName,
  selectedGrade,
  availableGrades,
  onGradeChange,
  gameMode,
  onModeChange,
  tier,
  subscriptionLoading,
  isSuperAdmin = false,
  dailyLimitReached,
  showFamilyProfiles,
  trialActive = false,
  trialDaysLeft = 0,
  trialExpired = false,
  isSignedIn = false,
  rewardPoints,
  rewardGoal,
}: HomeScreenProps) {
  const needsProfile = showFamilyProfiles && !activeChildName;
  const authEnabled = isClerkEnabled();
  const needsSignIn = !canStartPractice(isSignedIn, authEnabled);
  const startBlocked = dailyLimitReached || needsProfile || subscriptionLoading || needsSignIn;

  const planStatusLabel = trialActive
    ? trialDaysLeft === 1
      ? "Δοκιμή · 1 ημέρα"
      : `Δοκιμή · ${trialDaysLeft} ημέρες`
    : trialExpired
      ? "Δοκιμή έληξε"
      : "Δωρεάν";

  const gradeHint = (() => {
    if (needsSignIn) {
      return "";
    }
    if (trialActive) {
      return "Δωρεάν δοκιμή 5 ημερών: όλες οι τάξεις (Β΄–Στ΄) και τρόποι εξάσκησης.";
    }
    if (trialExpired) {
      return "Η δοκιμή έληξε. Δωρεάν: όλες οι τάξεις (Β΄–Στ΄). Premium: απεριόριστη εξάσκηση και όλοι οι τρόποι.";
    }
    return "Δωρεάν: όλες οι τάξεις (Β΄–Στ΄). Δοκιμή ή Premium για όλους τους τρόπους και απεριόριστη εξάσκηση.";
  })();

  return (
    <main className="screen screen--home fade-in">
      <div className="home-topbar">
        <div className="home-topbar__plans">
          {isSuperAdmin && <span className="admin-badge">Διαχειριστής</span>}
          {!isPaidTier(tier) && (
            <>
              <span className="plan-badge plan-badge--status">{planStatusLabel}</span>
              {!needsSignIn && (
                <button type="button" className="plan-badge plan-badge--cta" onClick={onOpenPricing}>
                  Πάμε Premium
                </button>
              )}
            </>
          )}
        </div>
        <div className="home-topbar__actions">
          {isClerkEnabled() && (
            <div className="home-auth">
              <SignedOut>
                <SignInButton mode="modal">
                  <button type="button" className="btn-text">
                    Σύνδεση
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Ρυθμίσεις"
            onClick={() => onOpenSettings()}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά!</h1>
        {activeChildName && <p className="hero-child">Παίζει: {activeChildName}</p>}
      </div>

      {!showFamilyProfiles && (
        <div className="grade-picker">
          <p className="section-label">Διάλεξε τάξη</p>
          <div className="grade-options">
            {OFFERED_GRADES.map((grade) => {
              const hasWords = availableGrades.has(grade);
              const planAllows = canAccessGrade(tier, grade, trialActive);
              const allowed = hasWords && planAllows && !needsSignIn;
              const selected = selectedGrade === grade;
              const lockReason = needsSignIn
                ? "Σύνδεση για εξάσκηση"
                : !hasWords
                  ? "Δεν υπάρχουν ακόμη λέξεις"
                  : !planAllows
                    ? "Διαθέσιμο με Premium"
                    : undefined;
              return (
                <button
                  key={grade}
                  type="button"
                  className={`grade-chip${selected ? " grade-chip--active" : ""}${!allowed ? " grade-chip--locked" : ""}${!hasWords ? " grade-chip--empty" : ""}`}
                  disabled={!allowed || subscriptionLoading}
                  onClick={() => allowed && onGradeChange(grade)}
                  title={lockReason}
                  aria-label={lockReason ? `${GRADE_LABELS[grade]} — ${lockReason}` : GRADE_LABELS[grade]}
                >
                  {GRADE_LABELS[grade]}
                </button>
              );
            })}
          </div>
          {tier === "free" && gradeHint ? <p className="hint-text">{gradeHint}</p> : null}
        </div>
      )}

      <div className="mode-picker">
        <p className="section-label section-label--strong">Τρόπος εξάσκησης</p>
        <div className="mode-options">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
            const modeAllowed = canAccessMode(tier, mode, trialActive);
            const allowed = modeAllowed && !needsSignIn;
            const lockReason = needsSignIn
              ? "Σύνδεση για εξάσκηση"
              : !modeAllowed
                ? "Διαθέσιμο με Premium"
                : undefined;
            return (
              <button
                key={mode}
                type="button"
                className={`mode-chip${gameMode === mode ? " mode-chip--active" : ""}${!allowed ? " mode-chip--locked" : ""}`}
                disabled={!allowed || subscriptionLoading}
                onClick={() => allowed && onModeChange(mode)}
                title={lockReason}
                aria-label={lockReason ? `${MODE_LABELS[mode]} — ${lockReason}` : MODE_LABELS[mode]}
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {needsSignIn ? (
        <SignInButton mode="modal">
          <button type="button" className="btn btn-primary btn-start">
            Σύνδεση για να ξεκινήσεις
          </button>
        </SignInButton>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-start"
          disabled={startBlocked && !needsProfile}
          onClick={() => {
            if (needsProfile) {
              onOpenSettings({ addChild: true });
              return;
            }
            onStart();
          }}
        >
          {needsProfile
            ? "Πρόσθεσε προφίλ παιδιού"
            : dailyLimitReached
              ? "Έφτασες το ημερήσιο όριο"
              : "Ξεκινάμε"}
        </button>
      )}
      {dailyLimitReached && tier === "free" && (
        <button type="button" className="btn btn-secondary btn-start" onClick={onOpenPricing}>
          Αναβάθμιση για απεριόριστη εξάσκηση
        </button>
      )}

      <div className="reward-panel">
        <p className="section-label section-label--strong">Στόχος</p>
        <p className="reward-score">
          {activeChildName ? `${activeChildName}: ` : ""}
          <strong>
            {rewardPoints}/{rewardGoal}
          </strong>{" "}
          σωστές απαντήσεις
        </p>
        <div className="reward-bar" aria-hidden="true">
          <div
            className="reward-bar__fill"
            style={{ width: `${Math.min(100, (rewardPoints / Math.max(1, rewardGoal)) * 100)}%` }}
          />
        </div>
      </div>

      <footer className="legal-footer">
        <a href="/privacy">Απορρήτο</a>
        <span>·</span>
        <a href="/terms">Όροι</a>
      </footer>
    </main>
  );
}
