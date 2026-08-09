export const MOTION_SAMPLE_WIDTH = 64;
export const MOTION_SAMPLE_HEIGHT = 48;

export interface MotionState {
  baseline: Float32Array | null;
  active: boolean;
  consecutive: number;
  lastEventAt: number;
}

export interface MotionConfig {
  threshold: number;
  consecutiveFrames: number;
  cooldownMs: number;
  baselineAlpha: number;
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  threshold: 13,
  consecutiveFrames: 3,
  cooldownMs: 10_000,
  baselineAlpha: 0.035,
};

export function frameDifference(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (!a.length || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index]);
  return total / a.length;
}

export function isCameraActiveHour(hourWib: number) {
  return Number.isFinite(hourWib) && hourWib >= 6 && hourWib < 18;
}

export function nextMotionState(
  state: MotionState,
  frame: Uint8ClampedArray,
  now: number,
  config: MotionConfig = DEFAULT_MOTION_CONFIG,
): { state: MotionState; event: "MOTION_START" | "MOTION_END" | null; difference: number } {
  if (!state.baseline || state.baseline.length !== frame.length) {
    return { state: { ...state, baseline: Float32Array.from(frame), consecutive: 0 }, event: null, difference: 0 };
  }
  const difference = frameDifference(frame, state.baseline);
  const moving = difference >= config.threshold;
  const consecutive = moving ? state.consecutive + 1 : 0;
  let active = state.active;
  let lastEventAt = state.lastEventAt;
  let event: "MOTION_START" | "MOTION_END" | null = null;
  if (!active && consecutive >= config.consecutiveFrames && now - lastEventAt >= config.cooldownMs) {
    active = true;
    lastEventAt = now;
    event = "MOTION_START";
  } else if (active && !moving) {
    active = false;
    event = "MOTION_END";
  }
  const baseline = state.baseline.slice();
  if (!active) {
    for (let index = 0; index < frame.length; index += 1) {
      baseline[index] += (frame[index] - baseline[index]) * config.baselineAlpha;
    }
  }
  return { state: { baseline, active, consecutive, lastEventAt }, event, difference };
}

export function rgbaToGrayscale(data: Uint8ClampedArray) {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let source = 0, target = 0; source < data.length; source += 4, target += 1) {
    gray[target] = Math.round(data[source] * 0.299 + data[source + 1] * 0.587 + data[source + 2] * 0.114);
  }
  return gray;
}
