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
import { formatDifficultyMix } from "../lib/difficulty";
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
  sessionMix,
  selectedGrade,
  availableGrades,
  onGradeChange,
  gameMode,
  onModeChange,
  weeklyRule,
  tier,
  dailyLimitReached,
  familyProfiles,
}: HomeScreenProps) {
  const showWeekly = weeklyRule && canAccessWeeklyRule(tier);
  const showCloudSync = syncEnabled && onSyncProgress && canUseCloudSync(tier);
  const showFamilyProfiles = Boolean(familyProfiles);
  const needsProfile = showFamilyProfiles && familyProfiles!.profiles.length === 0;
  const mixLabel = sessionMix ? formatDifficultyMix(sessionMix) : null;

  return (
    <main className="screen screen--home fade-in">
      <div className="home-topbar">
        <button type="button" className="plan-badge" onClick={onOpenPricing}>
          {tierLabel(tier)}
          {tier === "free" && " · Αναβάθμιση"}
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

      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά!</h1>
        <p className="hero-sub">Άκου τη λέξη, δες την πρόταση και γράψε την με τον τόνο της.</p>
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
                  disabled={!allowed}
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

      <div className="grade-picker">
        <p className="section-label">Τρόπος εξάσκησης</p>
        <div className="grade-options">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((mode) => {
            const allowed = canAccessMode(tier, mode);
            return (
              <button
                key={mode}
                type="button"
                className={`grade-chip${gameMode === mode ? " grade-chip--active" : ""}${!allowed ? " grade-chip--locked" : ""}`}
                disabled={!allowed}
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
        className="btn btn-primary btn-xl"
        disabled={dailyLimitReached || needsProfile}
        onClick={onStart}
      >
        {needsProfile
          ? "Πρόσθεσε προφίλ παιδιού"
          : dailyLimitReached
            ? "Έφτασες το ημερήσιο όριο"
            : "Σημερινή αποστολή"}
      </button>
      {dailyLimitReached && tier === "free" && (
        <button type="button" className="btn btn-secondary btn-xl" onClick={onOpenPricing}>
          Αναβάθμιση για απεριόριστη εξάσκηση
        </button>
      )}

      {showWeekly && (
        <div className="weekly-rule-card">
          <p className="section-label">Κανόνας της εβδομάδας</p>
          <p className="weekly-rule-title">{weeklyRule!.title}</p>
          <p className="weekly-rule-body">{weeklyRule!.body}</p>
          <button
            type="button"
            className="btn btn-secondary btn-xl"
            disabled={needsProfile}
            onClick={onWeeklyStart}
          >
            {needsProfile ? "Πρόσθεσε προφίλ παιδιού" : "5 λέξεις για τον κανόνα"}
          </button>
        </div>
      )}

      {totalWords > 0 && (
        <div className="progress-panel">
          {activeChildName ? (
            <p className="progress-hint progress-hint--child">
              Πρόοδος: {activeChildName} — {masteredCount}/{totalWords} λέξεις ({GRADE_LABELS[selectedGrade]})
            </p>
          ) : (
            <p className="progress-hint">
              Ξέρεις ήδη {masteredCount} από {totalWords} λέξεις!
            </p>
          )}

          {progressStats && progressStats.needsReview > 0 && (
            <p className="progress-detail">
              {progressStats.needsReview} λέξ{progressStats.needsReview === 1 ? "η" : "εις"} για επανάληψη
            </p>
          )}

          {progressStats && progressStats.mastered > 0 && (
            <p className="progress-detail">
              Εύκολες: {progressStats.easyMastered} · Μέτριες: {progressStats.mediumMastered} · Δύσκολες:{" "}
              {progressStats.hardMastered}
            </p>
          )}

          {mixLabel && (
            <p className="progress-detail">Σημερινή αποστολή: {mixLabel}</p>
          )}
        </div>
      )}

      <div className="progress-sync">
        <button type="button" className="btn-text" onClick={onExportProgress}>
          Εξαγωγή προόδου
        </button>
        <button type="button" className="btn-text" onClick={onImportProgress}>
          Εισαγωγή προόδου
        </button>
        {showCloudSync && (
          <button type="button" className="btn-text" onClick={onSyncProgress}>
            Συγχρονισμός cloud
          </button>
        )}
        {syncEnabled && !canUseCloudSync(tier) && (
          <button type="button" className="btn-text" onClick={onOpenPricing}>
            Cloud sync (Premium)
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
