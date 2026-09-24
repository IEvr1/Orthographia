import type { WordProgress } from "../types";
import type { ProgressStore } from "./storage";
import { getRewardPoints } from "./storage";

function pickWord(local: WordProgress, remote: WordProgress): WordProgress {
  if (remote.attempts > local.attempts) return remote;
  if (remote.attempts < local.attempts) return local;

  const localSeen = local.lastSeen ? Date.parse(local.lastSeen) : 0;
  const remoteSeen = remote.lastSeen ? Date.parse(remote.lastSeen) : 0;
  return remoteSeen > localSeen ? remote : local;
}

export function mergeProgressStores(local: ProgressStore, remote: ProgressStore): ProgressStore {
  const words: Record<string, WordProgress> = { ...local.words };
  for (const [id, remoteWord] of Object.entries(remote.words ?? {})) {
    const localWord = words[id];
    words[id] = localWord ? pickWord(localWord, remoteWord) : remoteWord;
  }

  const lastSessionDate =
    [local.lastSessionDate, remote.lastSessionDate]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    ...local,
    words,
    lastSessionDate,
    deviceId: local.deviceId ?? remote.deviceId,
    rewardPoints: Math.max(getRewardPoints(local), getRewardPoints(remote)),
    streak: mergeStreak(local.streak, remote.streak),
    badges: [...new Set([...(local.badges ?? []), ...(remote.badges ?? [])])],
    errorStats: mergeErrorStats(local.errorStats, remote.errorStats),
  };
}

function mergeStreak(
  a?: ProgressStore["streak"],
  b?: ProgressStore["streak"],
): ProgressStore["streak"] | undefined {
  if (!a) return b;
  if (!b) return a;
  const best = Math.max(a.best, b.best);
  const lastDate = [a.lastDate, b.lastDate].filter(Boolean).sort().at(-1) ?? null;
  const current = lastDate === a.lastDate ? a.current : lastDate === b.lastDate ? b.current : Math.max(a.current, b.current);
  return { current, best, lastDate };
}

function mergeErrorStats(
  a?: ProgressStore["errorStats"],
  b?: ProgressStore["errorStats"],
): ProgressStore["errorStats"] {
  // Take the max per category — summing would double-count on repeated sign-in merges
  // when local and remote already reflect the same practice history.
  const out: ProgressStore["errorStats"] = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    const key = k as keyof NonNullable<ProgressStore["errorStats"]>;
    out[key] = Math.max(out[key] ?? 0, v ?? 0);
  }
  return out;
}
