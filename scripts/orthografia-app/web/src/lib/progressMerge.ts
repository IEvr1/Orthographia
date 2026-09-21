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
  };
}
