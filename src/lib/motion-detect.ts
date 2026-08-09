// Deterministic frame-diff motion engine for the Camera Live Guardian
// (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// PURE MODULE — zero imports, zero DOM. The /camera page owns the canvas
// work (drawImage + getImageData) and feeds raw RGBA here; everything below
// is plain math, which is what makes the touch reaction sensor-truth-legal:
// no AI anywhere in this file, and nothing downstream of a MotionEvent may
// ever grant XP, Seeds, or quests (presentation + log only).
//
// Pipeline per sampled frame (~8 fps):
//   RGBA 64×48 → toGrayscale → meanAbsDiff vs rolling baseline →
//   threshold → N-consecutive-frames debounce → MOTION_START / MOTION_END,
//   with a 10 s cooldown between motion episodes and an EMA baseline that
//   absorbs slow lighting drift (clouds, curtains) but never absorbs the
//   motion frames themselves (a resting hand keeps diffing until it leaves).

export interface MotionConfig {
  /** Downscale target, px. Small on purpose: 64×48 ≈ 3k pixels per diff. */
  width: number;
  height: number;
  /** Sampling rate the page should drive pushFrame at (informational). */
  sampleFps: number;
  /** Mean absolute grayscale diff (0–255 scale) that counts as motion. */
  diffThreshold: number;
  /** Consecutive frames over/under threshold to enter/leave motion. */
  debounceFrames: number;
  /** Minimum quiet gap between MOTION_END and the next MOTION_START. */
  cooldownMs: number;
  /** EMA weight for baseline updates on calm frames (0 < alpha < 1). */
  baselineAlpha: number;
}

export const MOTION_CONFIG: MotionConfig = {
  width: 64,
  height: 48,
  sampleFps: 8,
  diffThreshold: 9,
  debounceFrames: 3,
  cooldownMs: 10_000,
  baselineAlpha: 0.08,
};

/** ITU-R BT.601 luma. Input is RGBA (4 bytes/px); output one value per px. */
export function toGrayscale(rgba: Uint8ClampedArray | number[]): Float64Array {
  const out = new Float64Array(Math.floor(rgba.length / 4));
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    out[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return out;
}

/** Plain mean of absolute per-pixel differences (0–255 scale). */
export function meanAbsDiff(a: Float64Array, b: Float64Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** In-place EMA: baseline += alpha * (frame - baseline). */
export function updateBaseline(baseline: Float64Array, frame: Float64Array, alpha: number): void {
  const n = Math.min(baseline.length, frame.length);
  for (let i = 0; i < n; i += 1) baseline[i] += alpha * (frame[i] - baseline[i]);
}

export type MotionEventKind = "MOTION_START" | "MOTION_END";

export interface MotionEvent {
  kind: MotionEventKind;
  /** The nowMs the caller passed for the frame that fired the transition. */
  atMs: number;
  /** meanAbsDiff score of that frame — surfaced for debugging/QA overlays. */
  score: number;
}

export interface MotionDetector {
  /** Feed one grayscale frame; returns a transition event or null. */
  pushFrame(gray: Float64Array, nowMs: number): MotionEvent | null;
  isActive(): boolean;
  /** Full re-prime including the cooldown clock (fresh session semantics). */
  reset(): void;
  /** Re-prime the baseline/debounce but KEEP the cooldown clock. Used when
   * sampling pauses (tab hidden, night-suspension exit at dawn): a stale
   * baseline is noise and must be relearned, but a pause must never
   * shortcut the 10s gap between motion episodes. */
  rePrime(): void;
}

export function createMotionDetector(config: MotionConfig = MOTION_CONFIG): MotionDetector {
  let baseline: Float64Array | null = null;
  let motionRun = 0;
  let calmRun = 0;
  let active = false;
  let cooldownUntil = 0;

  return {
    isActive: () => active,
    reset() {
      baseline = null;
      motionRun = 0;
      calmRun = 0;
      active = false;
      cooldownUntil = 0;
    },
    rePrime() {
      baseline = null;
      motionRun = 0;
      calmRun = 0;
      active = false;
      // cooldownUntil intentionally survives — see the interface docs.
    },
    pushFrame(gray: Float64Array, nowMs: number): MotionEvent | null {
      if (!baseline) {
        baseline = Float64Array.from(gray); // first frame primes silently
        return null;
      }
      const score = meanAbsDiff(gray, baseline);
      const moving = score >= config.diffThreshold;
      // Adaptive baseline: calm frames teach it the room (lighting drift);
      // motion frames NEVER do — otherwise a slow stroke would erase itself.
      if (!moving) updateBaseline(baseline, gray, config.baselineAlpha);

      if (!active) {
        motionRun = moving ? motionRun + 1 : 0;
        if (motionRun >= config.debounceFrames && nowMs >= cooldownUntil) {
          active = true;
          motionRun = 0;
          calmRun = 0;
          return { kind: "MOTION_START", atMs: nowMs, score };
        }
        return null;
      }

      calmRun = moving ? 0 : calmRun + 1;
      if (calmRun >= config.debounceFrames) {
        active = false;
        calmRun = 0;
        cooldownUntil = nowMs + config.cooldownMs; // per-event cooldown
        return { kind: "MOTION_END", atMs: nowMs, score };
      }
      return null;
    },
  };
}

// ── Night suspension (spec: 18:00–06:00 WIB) ─────────────────────────────
// Dark frames are noise and Jamkachu sleeps — mirrors live.js's night
// window (SLEEP_START_HOUR/SLEEP_END_HOUR) including the "Intl failure ⇒
// never night" fail-open, so a broken clock never silently kills the demo.

export const GUARDIAN_SUSPEND_START_HOUR = 18; // inclusive, WIB
export const GUARDIAN_SUSPEND_END_HOUR = 6; // exclusive, WIB

export function isGuardianSuspendedWIB(date: Date = new Date()): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        hour12: false,
      }).format(date),
    );
    if (!Number.isFinite(hour)) return false;
    const h = hour % 24; // some engines print midnight as "24"
    return h >= GUARDIAN_SUSPEND_START_HOUR || h < GUARDIAN_SUSPEND_END_HOUR;
  } catch {
    return false;
  }
}
