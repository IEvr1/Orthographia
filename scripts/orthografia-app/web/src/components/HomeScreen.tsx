import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import type { GameMode } from "../types";
import type { PlanTier } from "../lib/access";
import { canAccessGrade, canAccessMode, tierLabel } from "../lib/access";
import { isClerkEnabled } from "../lib/subscription";
import { SettingsIcon } from "./SettingsScreen";

const GRADE_LABELS: Record<number, string> = {
  1: "Α΄",
  2: "Β΄",
  3: "Γ΄",
  4: "Δ΄",
  5: "Ε΄",
  6: "Στ΄",
};

const MODE_LABELS: Record<GameMode, string> = {
  sentence: "Πρόταση",
  choice: "Διάλεξε σωστά",
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
  rewardPoints,
  rewardGoal,
}: HomeScreenProps) {
  const needsProfile = showFamilyProfiles && !activeChildName;
  const startBlocked = dailyLimitReached || needsProfile || subscriptionLoading;

  return (
    <main className="screen screen--home fade-in">
      <div className="home-topbar">
        <div className="home-topbar__plans">
          {isSuperAdmin && <span className="admin-badge">Διαχειριστής</span>}
          <button type="button" className="plan-badge" onClick={onOpenPricing}>
            {tierLabel(tier)}
            {tier === "free" && " · Αναβάθμιση"}
          </button>
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
            {[1, 2, 3, 4, 5, 6].map((grade) => {
              const hasWords = availableGrades.has(grade);
              const allowed = hasWords && canAccessGrade(tier, grade);
              const selected = selectedGrade === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  className={`grade-chip${selected ? " grade-chip--active" : ""}${!allowed ? " grade-chip--locked" : ""}`}
                  disabled={!allowed || subscriptionLoading}
                  onClick={() => allowed && onGradeChange(grade)}
                  title={!allowed && hasWords ? "Διαθέσιμο με Premium" : undefined}
                >
                  {GRADE_LABELS[grade]}
                </button>
              );
            })}
          </div>
          {tier === "free" && (
            <p className="hint-text">Δωρεάν: Α΄ και Β΄ τάξη. Premium: όλες οι τάξεις.</p>
          )}
        </div>
      )}

      <div className="mode-picker">
        <p className="section-label section-label--strong">Τρόπος εξάσκησης</p>
        <div className="mode-options">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
            const allowed = canAccessMode(tier, mode);
            return (
              <button
                key={mode}
                type="button"
                className={`mode-chip${gameMode === mode ? " mode-chip--active" : ""}${!allowed ? " mode-chip--locked" : ""}`}
                disabled={!allowed || subscriptionLoading}
                onClick={() => allowed && onModeChange(mode)}
                title={!allowed ? "Διαθέσιμο με Premium" : undefined}
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

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
        <p className="progress-detail">Κάθε σωστή απάντηση = 1 αστέρι προς τον στόχο.</p>
      </div>

      <footer className="legal-footer">
        <a href="/privacy">Απορρήτο</a>
        <span>·</span>
        <a href="/terms">Όροι</a>
      </footer>
    </main>
  );
}
