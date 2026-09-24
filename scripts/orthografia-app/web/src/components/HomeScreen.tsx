import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import type { DrillItem, FamiliesPayload, GameMode, WordEntry } from "../types";
import type { PlanTier } from "../lib/access";
import { canAccessGrade, canAccessMode, canStartPractice, isPaidTier } from "../lib/access";
import { GRADE_LABELS, OFFERED_GRADES } from "../lib/grades";
import { MODE_LABELS, MODE_ORDER, modeAvailableForGrade } from "../lib/modeMeta";
import { isClerkEnabled } from "../lib/subscription";
import { SettingsIcon } from "./SettingsScreen";

function childAvatarLetter(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "Ο";
  return trimmed.charAt(0).toLocaleUpperCase("el-GR");
}

interface HomeScreenProps {
  onOpenSettings: (options?: { addChild?: boolean }) => void;
  onOpenPricing: () => void;
  onOpenLexicon: () => void;
  onOpenReport: () => void;
  onOpenLists?: () => void;
  onPracticeActiveList?: () => void;
  activeListLabel?: string | null;
  activeChildName?: string | null;
  selectedGrade: number;
  availableGrades: Set<number>;
  onGradeChange: (grade: number) => void;
  gameMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  gradeWords: WordEntry[];
  drills?: DrillItem[];
  families: FamiliesPayload;
  tier: PlanTier;
  subscriptionLoading: boolean;
  isSuperAdmin?: boolean;
  needsPurchase: boolean;
  showFamilyProfiles: boolean;
  trialActive?: boolean;
  trialDaysLeft?: number;
  trialExpired?: boolean;
  isSignedIn?: boolean;
  streakCurrent: number;
  streakBest: number;
  badgeCount: number;
  practiceHomeHint?: string | null;
}

export function HomeScreen({
  onOpenSettings,
  onOpenPricing,
  onOpenLexicon,
  onOpenReport,
  onOpenLists,
  onPracticeActiveList,
  activeListLabel = null,
  activeChildName,
  selectedGrade,
  availableGrades,
  onGradeChange,
  gameMode,
  onModeChange,
  gradeWords,
  drills = [],
  families,
  tier,
  subscriptionLoading,
  isSuperAdmin = false,
  needsPurchase = false,
  showFamilyProfiles,
  trialActive = false,
  trialDaysLeft = 0,
  trialExpired = false,
  isSignedIn = false,
  streakCurrent,
  streakBest,
  badgeCount,
  practiceHomeHint = null,
}: HomeScreenProps) {
  const needsProfile = showFamilyProfiles && !activeChildName;
  const authEnabled = isClerkEnabled();
  const needsSignIn = !canStartPractice(isSignedIn, authEnabled);

  const planStatusLabel = trialActive
    ? trialDaysLeft === 1
      ? "Δοκιμή · 1 ημέρα"
      : `Δοκιμή · ${trialDaysLeft} ημέρες`
    : trialExpired
      ? "Δοκιμή έληξε"
      : null;

  return (
    <main className="screen screen--home fade-in">
      <div className="home-topbar">
        <div className="home-topbar__plans">
          {isSuperAdmin && <span className="admin-badge">Διαχειριστής</span>}
          {!isPaidTier(tier) && (
            <>
              {planStatusLabel && (
                <span className="plan-badge plan-badge--status">{planStatusLabel}</span>
              )}
              {!needsSignIn && (
                <button type="button" className="plan-badge plan-badge--cta" onClick={onOpenPricing}>
                  Αναβάθμιση
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

      <div className="hero hero--home">
        <div
          className={`hero-avatar${activeChildName ? " hero-avatar--child" : ""}`}
          aria-hidden="true"
        >
          <span className="hero-avatar__letter">{childAvatarLetter(activeChildName)}</span>
        </div>
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Μάθε να γράφεις σωστά!</h1>
        {activeChildName ? (
          <p className="hero-child">
            Παίζει <span className="hero-child__name">{activeChildName}</span>
          </p>
        ) : (
          <p className="hero-child hero-child--invite">Έτοιμοι για εξάσκηση;</p>
        )}
      </div>

      {!needsSignIn && (
        <div className="streak-strip" aria-label="Σερί και διακρίσεις">
          <span className="streak-pill">
            Σερί <strong>{streakCurrent}</strong>
            {streakBest > 0 ? ` · ρεκόρ ${streakBest}` : ""}
          </span>
          <button type="button" className="streak-pill streak-pill--btn" onClick={onOpenReport}>
            Αναφορά προόδου{badgeCount > 0 ? ` (${badgeCount})` : ""}
          </button>
        </div>
      )}

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
                : needsPurchase || !planAllows
                  ? "Απαιτείται συνδρομή"
                  : !hasWords
                    ? "Δεν υπάρχουν ακόμη λέξεις"
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
        </div>
      )}

      <div className="mode-picker">
        <p className="section-label section-label--strong">Τρόπος εξάσκησης</p>
        <div className="mode-options mode-options--many">
          {MODE_ORDER.map((mode) => {
            const modeAllowed = canAccessMode(tier, mode, trialActive);
            const contentOk = modeAvailableForGrade(
              mode,
              gradeWords,
              families,
              drills,
              selectedGrade,
            );
            const allowed = modeAllowed && contentOk && !needsSignIn;
            const lockReason = needsSignIn
              ? "Σύνδεση για εξάσκηση"
              : needsPurchase || !modeAllowed
                ? "Απαιτείται συνδρομή"
                : !contentOk
                  ? "Όχι αρκετό υλικό σε αυτή την τάξη"
                  : undefined;
            return (
              <button
                key={mode}
                type="button"
                className={`mode-chip mode-chip--compact${gameMode === mode ? " mode-chip--active" : ""}${!allowed ? " mode-chip--locked" : ""}`}
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

      {needsPurchase && (
        <button type="button" className="btn btn-primary btn-start btn-start--pulse" onClick={onOpenPricing}>
          {trialExpired ? "Αγόρασε για να συνεχίσεις" : "Αγορά συνδρομής"}
        </button>
      )}
      {needsProfile && (
        <button
          type="button"
          className="btn btn-primary btn-start btn-start--pulse"
          onClick={() => onOpenSettings({ addChild: true })}
        >
          Πρόσθεσε προφίλ παιδιού
        </button>
      )}
      {!needsSignIn && !needsPurchase && !needsProfile && (
        <p className="hint-text practice-home-hint">
          {practiceHomeHint ?? "Η εξάσκηση ξεκινά αυτόματα όταν επιλέξεις τάξη και τρόπο."}
        </p>
      )}
      {needsPurchase && (
        <p className="hint-text">
          {trialExpired
            ? "Η δωρεάν δοκιμή 5 ημερών έληξε. Η εξάσκηση συνεχίζεται μόνο με συνδρομή."
            : "Η εξάσκηση είναι διαθέσιμη με δοκιμή ή συνδρομή."}
        </p>
      )}

      {!needsSignIn && !needsPurchase && (
        <>
          {activeListLabel && onPracticeActiveList && (
            <button
              type="button"
              className="btn btn-secondary btn-start"
              onClick={onPracticeActiveList}
            >
              Λίστα: {activeListLabel}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-start" onClick={onOpenLexicon}>
            Λεξικό μαθητή
          </button>
          {onOpenLists && (
            <button type="button" className="btn btn-secondary btn-start" onClick={onOpenLists}>
              Λίστες εξάσκησης
            </button>
          )}
        </>
      )}

      <footer className="legal-footer">
        <div className="legal-footer__links">
          <button type="button" className="legal-footer__btn" onClick={onOpenPricing}>
            Κόστος Πλάνου
          </button>
          <span>·</span>
          <a href="/privacy">Απορρήτο</a>
          <span>·</span>
          <a href="/terms">Όροι</a>
          <span>·</span>
          <a href="/contact">Επικοινωνία</a>
        </div>
        <p className="legal-footer__note">🎁 Οι πρώτες 5 ημέρες δωρεάν</p>
      </footer>
    </main>
  );
}
