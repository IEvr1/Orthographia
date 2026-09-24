/**
 * Verify progress merge does not double-count error stats.
 * Run: node scripts/verify-merge.mjs
 */
import assert from "node:assert/strict";

function mergeErrorStats(a, b) {
  const out = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = Math.max(out[k] ?? 0, v ?? 0);
  }
  return out;
}

function pickWord(local, remote) {
  if (remote.attempts > local.attempts) return remote;
  if (remote.attempts < local.attempts) return local;
  const localSeen = local.lastSeen ? Date.parse(local.lastSeen) : 0;
  const remoteSeen = remote.lastSeen ? Date.parse(remote.lastSeen) : 0;
  return remoteSeen > localSeen ? remote : local;
}

{
  const merged = mergeErrorStats({ root: 5, ending: 2 }, { root: 5, stress: 1 });
  assert.equal(merged.root, 5, "same counts stay 5 (not 10)");
  assert.equal(merged.ending, 2);
  assert.equal(merged.stress, 1);
  console.log("OK  errorStats max-merge (no double-count)");
}

{
  const merged = mergeErrorStats({ root: 3 }, { root: 7 });
  assert.equal(merged.root, 7, "takes higher remote");
  console.log("OK  errorStats prefers higher count");
}

{
  const local = { attempts: 4, lastSeen: "2026-01-01T00:00:00Z", correct: 2 };
  const remote = { attempts: 4, lastSeen: "2026-02-01T00:00:00Z", correct: 3 };
  assert.equal(pickWord(local, remote).lastSeen, remote.lastSeen);
  console.log("OK  word pick prefers newer lastSeen on tie");
}

console.log("\nAll merge checks verified.");
