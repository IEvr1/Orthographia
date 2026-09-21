import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useState } from "react";
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
import {
  DEFAULT_REWARD_GOAL,
  MAX_REWARD_GOAL,
  MIN_REWARD_GOAL,
} from "../lib/settings";
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
  sentence: "Πρόταση",
  choice: "Διάλεξε σωστά",
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
  isSuperAdmin?: boolean;
  dailyLimitReached: boolean;
  rewardPoints: number;
  rewardGoal: number;
  onRewardGoalChange: (goal: number) => void;
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
  isSuperAdmin = false,
  dailyLimitReached,
  rewardPoints,
  rewardGoal,
  onRewardGoalChange,
  familyProfiles,
}: HomeScreenProps) {
  const showWeekly = weeklyRule && canAccessWeeklyRule(tier);
  const showCloudSync = syncEnabled && onSyncProgress && canUseCloudSync(tier);
  const showFamilyProfiles = Boolean(familyProfiles);
  const needsProfile = showFamilyProfiles && familyProfiles!.profiles.length === 0;
  const mixLabel = sessionMix ? formatDifficultyMix(sessionMix) : null;
  const [goalDraft, setGoalDraft] = useState(String(rewardGoal));
  const [goalSaved, setGoalSaved] = useState(false);

  const saveGoal = () => {
    const parsed = Number.parseInt(goalDraft, 10);
    const next = Number.isFinite(parsed) ? parsed : DEFAULT_REWARD_GOAL;
    const saved = Math.min(MAX_REWARD_GOAL, Math.max(MIN_REWARD_GOAL, next));
    onRewardGoalChange(saved);
    setGoalDraft(String(saved));
    setGoalSaved(true);
    window.setTimeout(() => setGoalSaved(false), 1600);
  };

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
        <h1 className="hero-title">Μάθε να γράφεις σωστά!</h1>
        <p className="hero-sub">Δες την πρόταση και γράψε τη λέξη με τον τόνο της.</p>
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

      <div className="reward-panel">
        <p className="section-label">Επιβράβευση</p>
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

      <div className="settings-panel">
        <p className="section-label">Ρυθμίσεις γονέα</p>
        <label className="form-label" htmlFor="reward-goal-input">
          Στόχος σωστών απαντήσεων ({MIN_REWARD_GOAL}–{MAX_REWARD_GOAL})
          <input
            id="reward-goal-input"
            className="form-input"
            type="number"
            min={MIN_REWARD_GOAL}
            max={MAX_REWARD_GOAL}
            step={1}
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
          />
        </label>
        <div className="settings-panel__actions">
          <button type="button" className="btn btn-secondary" onClick={saveGoal}>
            Αποθήκευση στόχου
          </button>
          {goalSaved && <span className="settings-saved">Αποθηκεύτηκε</span>}
        </div>
      </div>

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
