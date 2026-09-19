import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import type { GameMode, RuleDefinition } from "../types";
import type { PlanTier } from "../lib/access";
import {
  canAccessGrade,
  canAccessMode,
  canAccessWeeklyRule,
  tierLabel,
} from "../lib/access";
import type { DifficultyMix } from "../lib/difficulty";
import type { GradeProgressStats } from "../lib/progressStats";
import { isClerkEnabled } from "../lib/subscription";
import { ProgressSummaryPanel } from "./ProgressSummaryPanel";
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
  dictation: "Υπαγόρευση",
  reverse: "Αναζήτηση",
  choice: "Διάλεξε σωστά",
  sentence: "Πρόταση",
};

interface HomeScreenProps {
  onStart: () => void;
  onWeeklyStart: () => void;
  onOpenSettings: (options?: { addChild?: boolean }) => void;
  onOpenPricing: () => void;
  progressStats?: GradeProgressStats;
  lastSessionDate?: string | null;
  activeChildName?: string | null;
  sessionMix?: DifficultyMix | null;
  selectedGrade: number;
  availableGrades: Set<number>;
  onGradeChange: (grade: number) => void;
  gameMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  weeklyRule: RuleDefinition | null;
  tier: PlanTier;
  subscriptionLoading?: boolean;
  isSuperAdmin?: boolean;
  dailyLimitReached: boolean;
  showFamilyProfiles?: boolean;
  needsProfile?: boolean;
}

export function HomeScreen({
  onStart,
  onWeeklyStart,
  onOpenSettings,
  onOpenPricing,
  progressStats,
  lastSessionDate = null,
  activeChildName,
  sessionMix,
  selectedGrade,
  availableGrades,
  onGradeChange,
  gameMode,
  onModeChange,
  weeklyRule,
  tier,
  subscriptionLoading = false,
  isSuperAdmin = false,
  dailyLimitReached,
  showFamilyProfiles = false,
  needsProfile = false,
}: HomeScreenProps) {
  const showWeekly = weeklyRule && canAccessWeeklyRule(tier);

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
          <button
            type="button"
            className="icon-btn"
            onClick={() => onOpenSettings()}
            aria-label="Ρυθμίσεις"
          >
            <SettingsIcon />
          </button>
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
        </div>
      </div>

      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά</h1>
        {showFamilyProfiles && activeChildName && (
          <p className="hero-child">{activeChildName} · {GRADE_LABELS[selectedGrade]} τάξη</p>
        )}
      </div>

      {needsProfile && (
        <p className="hint-text profile-setup-hint">
          Πρόσθεσε προφίλ παιδιού στις ρυθμίσεις για να ξεκινήσεις.
        </p>
      )}

      {!showFamilyProfiles && (
        <div className="grade-picker">
          <p className="section-label">Τάξη</p>
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
                  disabled={!allowed}
                  onClick={() => allowed && onGradeChange(grade)}
                  title={!allowed && hasWords ? "Διαθέσιμο με Premium" : undefined}
                >
                  {GRADE_LABELS[grade]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grade-picker">
        <p className="section-label">Τρόπος</p>
        <div className="mode-options">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
            const allowed = subscriptionLoading || canAccessMode(tier, mode);
            const locked = !subscriptionLoading && !canAccessMode(tier, mode);
            return (
              <button
                key={mode}
                type="button"
                className={`mode-chip${gameMode === mode ? " grade-chip--active" : ""}${locked ? " grade-chip--locked" : ""}`}
                aria-pressed={gameMode === mode}
                onClick={() => {
                  if (!allowed) {
                    if (isClerkEnabled()) onOpenPricing();
                    return;
                  }
                  onModeChange(mode);
                }}
                title={locked ? "Διαθέσιμο με Premium" : undefined}
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {needsProfile ? (
        <button
          type="button"
          className="btn btn-primary btn-xl"
          onClick={() => onOpenSettings({ addChild: true })}
        >
          Ρυθμίσεις → Πρόσθεσε παιδί
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-xl"
          disabled={dailyLimitReached}
          onClick={onStart}
        >
          {dailyLimitReached ? "Έφτασες το ημερήσιο όριο" : "Ξεκίνα"}
        </button>
      )}
      {dailyLimitReached && tier === "free" && (
        <button type="button" className="btn btn-secondary btn-xl" onClick={onOpenPricing}>
          Αναβάθμιση
        </button>
      )}

      {showWeekly && (
        <div className="weekly-rule-card">
          <p className="section-label">Κανόνας της εβδομάδας</p>
          <p className="weekly-rule-title">{weeklyRule!.title}</p>
          <p className="weekly-rule-body">{weeklyRule!.body}</p>
          {needsProfile ? (
            <button
              type="button"
              className="btn btn-secondary btn-xl"
              onClick={() => onOpenSettings({ addChild: true })}
            >
              Ρυθμίσεις → Πρόσθεσε παιδί
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-xl" onClick={onWeeklyStart}>
              5 λέξεις για τον κανόνα
            </button>
          )}
        </div>
      )}

      {progressStats && (
        <ProgressSummaryPanel
          stats={progressStats}
          gradeLabel={GRADE_LABELS[selectedGrade]}
          activeChildName={activeChildName}
          lastSessionDate={lastSessionDate}
          sessionMix={sessionMix}
        />
      )}

      <footer className="legal-footer">
        <a href="/privacy">Απορρήτο</a>
        <span>·</span>
        <a href="/terms">Όροι</a>
      </footer>
    </main>
  );
}
