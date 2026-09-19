import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import type { GameMode, RuleDefinition } from "../types";
import type { PlanTier } from "../lib/access";
import {
  canAccessGrade,
  canAccessMode,
  canAccessWeeklyRule,
  canUseCloudSync,
  tierLabel,
} from "../lib/access";
import type { DifficultyMix } from "../lib/difficulty";
import type { GradeProgressStats } from "../lib/progressStats";
import type { ChildProfile } from "../lib/subscription";
import { isClerkEnabled } from "../lib/subscription";
import { ChildProfileManager } from "./ChildProfileManager";

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
  onExportProgress: () => void;
  onImportProgress: () => void;
  onSyncProgress?: () => void;
  onOpenPricing: () => void;
  syncEnabled: boolean;
  masteredCount: number;
  totalWords: number;
  progressStats?: GradeProgressStats;
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
  familyProfiles?: {
    profiles: ChildProfile[];
    maxProfiles: number;
    activeProfileId: string | null;
    getToken: () => Promise<string | null>;
    onSelectProfile: (id: string) => void;
    onRefreshProfiles: () => Promise<void>;
  };
}

export function HomeScreen({
  onStart,
  onWeeklyStart,
  onExportProgress,
  onImportProgress,
  onSyncProgress,
  onOpenPricing,
  syncEnabled,
  masteredCount,
  totalWords,
  progressStats,
  activeChildName,
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
  familyProfiles,
}: HomeScreenProps) {
  const showWeekly = weeklyRule && canAccessWeeklyRule(tier);
  const showCloudSync = syncEnabled && onSyncProgress && canUseCloudSync(tier);
  const showFamilyProfiles = Boolean(familyProfiles);
  const needsProfile = showFamilyProfiles && familyProfiles!.profiles.length === 0;

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

      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά</h1>
      </div>

      {showFamilyProfiles && (
        <ChildProfileManager
          profiles={familyProfiles!.profiles}
          maxProfiles={familyProfiles!.maxProfiles}
          activeProfileId={familyProfiles!.activeProfileId}
          getToken={familyProfiles!.getToken}
          onSelectProfile={familyProfiles!.onSelectProfile}
          onRefresh={familyProfiles!.onRefreshProfiles}
        />
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
        <div className="grade-options">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
            const allowed = subscriptionLoading || canAccessMode(tier, mode);
            const locked = !subscriptionLoading && !canAccessMode(tier, mode);
            return (
              <button
                key={mode}
                type="button"
                className={`grade-chip${gameMode === mode ? " grade-chip--active" : ""}${locked ? " grade-chip--locked" : ""}`}
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

      <button
        type="button"
        className="btn btn-primary btn-xl"
        disabled={dailyLimitReached || needsProfile}
        onClick={onStart}
      >
        {needsProfile
          ? "Πρόσθεσε παιδί"
          : dailyLimitReached
            ? "Έφτασες το ημερήσιο όριο"
            : "Ξεκίνα"}
      </button>
      {dailyLimitReached && tier === "free" && (
        <button type="button" className="btn btn-secondary btn-xl" onClick={onOpenPricing}>
          Αναβάθμιση
        </button>
      )}

      {showWeekly && (
        <button
          type="button"
          className="btn btn-secondary btn-xl weekly-rule-btn"
          disabled={needsProfile}
          onClick={onWeeklyStart}
        >
          {needsProfile ? "Πρόσθεσε παιδί" : `Κανόνας: ${weeklyRule!.title}`}
        </button>
      )}

      {totalWords > 0 && (
        <div className="progress-panel">
          <p className="progress-hint">
            {activeChildName
              ? `${activeChildName}: ${masteredCount}/${totalWords}`
              : `${masteredCount}/${totalWords} λέξεις`}
            {progressStats && progressStats.needsReview > 0 && (
              <span className="progress-review"> · {progressStats.needsReview} επανάληψη</span>
            )}
          </p>
        </div>
      )}

      <div className="progress-sync">
        <button type="button" className="btn-text btn-text--subtle" onClick={onExportProgress}>
          Εξαγωγή
        </button>
        <button type="button" className="btn-text btn-text--subtle" onClick={onImportProgress}>
          Εισαγωγή
        </button>
        {showCloudSync && (
          <button type="button" className="btn-text btn-text--subtle" onClick={onSyncProgress}>
            Cloud
          </button>
        )}
        {syncEnabled && !canUseCloudSync(tier) && (
          <button type="button" className="btn-text btn-text--subtle" onClick={onOpenPricing}>
            Cloud (Premium)
          </button>
        )}
      </div>

      <footer className="legal-footer">
        <a href="/privacy">Απορρήτο</a>
        <span>·</span>
        <a href="/terms">Όροι</a>
      </footer>
    </main>
  );
}
