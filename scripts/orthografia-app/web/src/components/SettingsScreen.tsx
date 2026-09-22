import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import type { PlanTier } from "../lib/access";
import { canUseCloudSync, tierLabel } from "../lib/access";
import {
  DEFAULT_REWARD_GOAL,
  MAX_REWARD_GOAL,
  MIN_REWARD_GOAL,
} from "../lib/settings";
import type { ChildProfile } from "../lib/subscription";
import { isClerkEnabled } from "../lib/subscription";
import { ChildProfileManager } from "./ChildProfileManager";

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.01 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { SettingsIcon };

interface SettingsScreenProps {
  onBack: () => void;
  onOpenPricing: () => void;
  onSyncProgress?: () => void;
  syncEnabled: boolean;
  tier: PlanTier;
  isSuperAdmin?: boolean;
  autoOpenAddChild?: boolean;
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

export function SettingsScreen({
  onBack,
  onOpenPricing,
  onSyncProgress,
  syncEnabled,
  tier,
  isSuperAdmin = false,
  autoOpenAddChild = false,
  rewardGoal,
  onRewardGoalChange,
  familyProfiles,
}: SettingsScreenProps) {
  const showCloudSync = syncEnabled && onSyncProgress && canUseCloudSync(tier);
  const showFamilyProfiles = Boolean(familyProfiles);
  const [goalDraft, setGoalDraft] = useState(String(rewardGoal));
  const [goalSaved, setGoalSaved] = useState(false);

  useEffect(() => {
    setGoalDraft(String(rewardGoal));
  }, [rewardGoal]);

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
    <main className="screen screen--settings fade-in">
      <div className="settings-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        <div className="settings-header__right">
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

      <div className="settings-hero">
        <h1 className="settings-title">Ρυθμίσεις</h1>
        <p className="settings-subtitle">
          {isSuperAdmin ? "Διαχειριστής" : tierLabel(tier)}
        </p>
      </div>

      {showFamilyProfiles && (
        <section className="settings-section">
          <ChildProfileManager
            profiles={familyProfiles!.profiles}
            maxProfiles={familyProfiles!.maxProfiles}
            activeProfileId={familyProfiles!.activeProfileId}
            getToken={familyProfiles!.getToken}
            onSelectProfile={familyProfiles!.onSelectProfile}
            onRefresh={familyProfiles!.onRefreshProfiles}
            autoOpenAdd={autoOpenAddChild}
          />
        </section>
      )}

      <section className="settings-section">
        <p className="section-label section-label--strong">Στόχος</p>
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
        <p className="hint-text">Κάθε σωστή απάντηση δίνει 1 πόντο.</p>
        <div className="settings-panel__actions">
          <button type="button" className="btn btn-secondary" onClick={saveGoal}>
            Αποθήκευση στόχου
          </button>
          {goalSaved && <span className="settings-saved">Αποθηκεύτηκε</span>}
        </div>
      </section>

      <section className="settings-section">
        <p className="section-label">Δεδομένα</p>
        <div className="settings-actions">
          {showCloudSync && (
            <button type="button" className="settings-action" onClick={onSyncProgress}>
              Συγχρονισμός με άλλες συσκευές
            </button>
          )}
          {syncEnabled && !canUseCloudSync(tier) && (
            <button type="button" className="settings-action" onClick={onOpenPricing}>
              Συγχρονισμός με άλλες συσκευές
            </button>
          )}
        </div>
      </section>

      {tier === "free" && (
        <section className="settings-section">
          <p className="section-label">Συνδρομή</p>
          <button type="button" className="btn btn-secondary btn-xl settings-upgrade" onClick={onOpenPricing}>
            Αναβάθμιση
          </button>
        </section>
      )}
    </main>
  );
}
