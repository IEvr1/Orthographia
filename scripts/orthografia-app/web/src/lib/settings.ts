const SETTINGS_KEY = "orthografia-settings-v1";

export const DEFAULT_REWARD_GOAL = 50;
export const MIN_REWARD_GOAL = 20;
export const MAX_REWARD_GOAL = 200;

export interface AppSettings {
  /** Correct answers needed for a celebration reward. */
  rewardGoal: number;
}

function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REWARD_GOAL;
  return Math.min(MAX_REWARD_GOAL, Math.max(MIN_REWARD_GOAL, Math.round(value)));
}

function defaultSettings(): AppSettings {
  return { rewardGoal: DEFAULT_REWARD_GOAL };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      rewardGoal: clampGoal(parsed.rewardGoal ?? DEFAULT_REWARD_GOAL),
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      rewardGoal: clampGoal(settings.rewardGoal),
    }),
  );
}

export function getRewardGoal(): number {
  return loadSettings().rewardGoal;
}

export function setRewardGoal(goal: number): number {
  const rewardGoal = clampGoal(goal);
  saveSettings({ ...loadSettings(), rewardGoal });
  return rewardGoal;
}
