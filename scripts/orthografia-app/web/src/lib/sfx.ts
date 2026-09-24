/** Short UI sound effects via Web Audio (no asset files). */

type AudioContextCtor = typeof AudioContext;

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Bright ascending chime when the learner gets a word right. */
export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume();
    const t0 = ctx.currentTime;
    // C6 → E6 → G6 — short, cheerful, ~280ms
    playTone(ctx, 1046.5, t0, 0.12, 0.18);
    playTone(ctx, 1318.5, t0 + 0.08, 0.12, 0.16);
    playTone(ctx, 1568.0, t0 + 0.16, 0.18, 0.14);
  } catch {
    // Autoplay / AudioContext failures are non-fatal
  }
}
