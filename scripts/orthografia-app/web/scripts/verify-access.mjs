/**
 * Verify the three access stages for Orthographia practice gates.
 * Run: node scripts/verify-access.mjs
 */
import assert from "node:assert/strict";

/** Mirrors src/lib/access.ts evaluateAccess (no Vite env). */
function isPaidTier(tier) {
  return tier === "child" || tier === "family";
}

function hasFullContentAccess(tier, trialActive = false) {
  return isPaidTier(tier) || trialActive;
}

function evaluateAccess({ isSignedIn, authEnabled, tier, trialActive = false, bypass = false }) {
  if (bypass) {
    return { needsSignIn: false, needsPurchase: false, canPractice: true, canAccessContent: true };
  }
  const contentOk = hasFullContentAccess(tier, trialActive);
  const authOk = !authEnabled || isSignedIn;
  return {
    needsSignIn: Boolean(authEnabled && !isSignedIn),
    needsPurchase: Boolean(isSignedIn && !contentOk),
    canPractice: authOk && contentOk,
    canAccessContent: contentOk,
  };
}

const authOn = true;

// Stage 1 — signed out: no practice
{
  const a = evaluateAccess({ isSignedIn: false, authEnabled: authOn, tier: "free", trialActive: false });
  assert.equal(a.needsSignIn, true, "stage1: needsSignIn");
  assert.equal(a.canPractice, false, "stage1: canPractice");
  assert.equal(a.needsPurchase, false, "stage1: needsPurchase");
  console.log("OK  stage1 signed-out → block practice (require email sign-in)");
}

// Stage 2 — signed in + 5-day trial: full practice
{
  const a = evaluateAccess({ isSignedIn: true, authEnabled: authOn, tier: "free", trialActive: true });
  assert.equal(a.needsSignIn, false, "stage2: needsSignIn");
  assert.equal(a.canPractice, true, "stage2: canPractice");
  assert.equal(a.needsPurchase, false, "stage2: needsPurchase");
  console.log("OK  stage2 signed-in + trial → allow practice");
}

// Stage 3 — signed in + trial expired + free: purchase only
{
  const a = evaluateAccess({ isSignedIn: true, authEnabled: authOn, tier: "free", trialActive: false });
  assert.equal(a.needsSignIn, false, "stage3: needsSignIn");
  assert.equal(a.canPractice, false, "stage3: canPractice");
  assert.equal(a.needsPurchase, true, "stage3: needsPurchase");
  console.log("OK  stage3 trial expired → block practice (require purchase)");
}

// Paid still works after trial window
{
  const a = evaluateAccess({ isSignedIn: true, authEnabled: authOn, tier: "child", trialActive: false });
  assert.equal(a.canPractice, true, "paid: canPractice");
  assert.equal(a.needsPurchase, false, "paid: needsPurchase");
  console.log("OK  paid plan → allow practice");
}

// Auth disabled (no Clerk key) → practice not gated by sign-in (config issue)
{
  const a = evaluateAccess({ isSignedIn: false, authEnabled: false, tier: "free", trialActive: false });
  assert.equal(a.needsSignIn, false, "no-clerk: needsSignIn");
  assert.equal(a.canPractice, false, "no-clerk: still no content without trial/paid");
  console.log("OK  no Clerk key → no sign-in gate, but still no free practice");
}

console.log("\nAll access stages verified.");
