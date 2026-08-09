import { describe, expect, it } from "vitest";
import {
  MOTION_CONFIG,
  createMotionDetector,
  isGuardianSuspendedWIB,
  meanAbsDiff,
  toGrayscale,
  updateBaseline,
  type MotionConfig,
} from "@/lib/motion-detect";

// Exhaustive synthetic-frame coverage: this engine is the DETERMINISTIC
// half of the guardian (the game-legal half), so its math is pinned hard.

const W = 4;
const H = 3;
const CFG: MotionConfig = {
  width: W,
  height: H,
  sampleFps: 8,
  diffThreshold: 10,
  debounceFrames: 3,
  cooldownMs: 10_000,
  baselineAlpha: 0.5,
};
const frame = (value: number) => new Float64Array(W * H).fill(value);

describe("MOTION_CONFIG", () => {
  it("matches the spec: ~64x48 @ ~8fps, 10s cooldown, real debounce", () => {
    expect(MOTION_CONFIG.width).toBe(64);
    expect(MOTION_CONFIG.height).toBe(48);
    expect(MOTION_CONFIG.sampleFps).toBe(8);
    expect(MOTION_CONFIG.cooldownMs).toBe(10_000);
    expect(MOTION_CONFIG.debounceFrames).toBeGreaterThanOrEqual(2);
    expect(MOTION_CONFIG.diffThreshold).toBeGreaterThan(0);
    expect(MOTION_CONFIG.baselineAlpha).toBeGreaterThan(0);
    expect(MOTION_CONFIG.baselineAlpha).toBeLessThan(1);
  });
});

describe("toGrayscale", () => {
  it("converts RGBA to luma and drops alpha", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 0]);
    const gray = toGrayscale(rgba);
    expect(gray.length).toBe(3);
    expect(gray[0]).toBeCloseTo(0.299 * 255, 3); // pure red
    expect(gray[1]).toBe(0); // black
    expect(gray[2]).toBeCloseTo(255, 3); // white — alpha is ignored
  });
});

describe("meanAbsDiff + updateBaseline", () => {
  it("meanAbsDiff is the plain mean of absolute differences, symmetric", () => {
    expect(meanAbsDiff(frame(50), frame(50))).toBe(0);
    expect(meanAbsDiff(frame(50), frame(80))).toBe(30);
    expect(meanAbsDiff(frame(80), frame(50))).toBe(30);
  });

  it("updateBaseline moves the baseline toward the frame by alpha, in place", () => {
    const baseline = frame(50);
    updateBaseline(baseline, frame(100), 0.5);
    expect(baseline[0]).toBe(75);
    expect(baseline[W * H - 1]).toBe(75);
  });
});

describe("createMotionDetector", () => {
  it("primes silently on the first frame", () => {
    const d = createMotionDetector(CFG);
    expect(d.pushFrame(frame(50), 0)).toBeNull();
    expect(d.isActive()).toBe(false);
  });

  it("fires MOTION_START on exactly the Nth consecutive motion frame, once", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0); // baseline
    expect(d.pushFrame(frame(80), 125)).toBeNull(); // run 1
    expect(d.pushFrame(frame(80), 250)).toBeNull(); // run 2
    const start = d.pushFrame(frame(80), 375); // run 3 → fire
    expect(start).toMatchObject({ kind: "MOTION_START", atMs: 375 });
    expect(start?.score).toBe(30);
    expect(d.isActive()).toBe(true);
    expect(d.pushFrame(frame(80), 500)).toBeNull(); // sustained motion stays silent
  });

  it("single-frame spikes and flicker never debounce into a START", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    expect(d.pushFrame(frame(90), 125)).toBeNull();
    expect(d.pushFrame(frame(50), 250)).toBeNull(); // calm — run resets
    expect(d.pushFrame(frame(90), 375)).toBeNull();
    expect(d.pushFrame(frame(50), 500)).toBeNull();
    expect(d.isActive()).toBe(false);
  });

  it("fires MOTION_END after debounceFrames calm frames, then enforces the 10s cooldown", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.pushFrame(frame(80), 250);
    expect(d.pushFrame(frame(80), 375)?.kind).toBe("MOTION_START");
    expect(d.pushFrame(frame(50), 500)).toBeNull(); // calm 1
    expect(d.pushFrame(frame(50), 625)).toBeNull(); // calm 2
    const end = d.pushFrame(frame(50), 750); // calm 3 → END
    expect(end).toMatchObject({ kind: "MOTION_END", atMs: 750 });
    expect(d.isActive()).toBe(false);
    // Cooldown: 750 + 10_000 = 10_750. Motion inside it never STARTs...
    expect(d.pushFrame(frame(80), 875)).toBeNull();
    expect(d.pushFrame(frame(80), 1_000)).toBeNull();
    expect(d.pushFrame(frame(80), 1_125)).toBeNull(); // debounce met, still cooling
    expect(d.pushFrame(frame(80), 5_000)).toBeNull();
    // ...and fires on the first debounced frame past it.
    expect(d.pushFrame(frame(80), 11_000)?.kind).toBe("MOTION_START");
  });

  it("absorbs slow lighting drift into the rolling baseline (no false START)", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    let fired: unknown = null;
    for (let i = 1; i <= 30; i += 1) {
      fired = d.pushFrame(frame(50 + i * 2), i * 125) ?? fired; // +60 total drift
    }
    expect(fired).toBeNull();
  });

  it("does NOT absorb motion frames into the baseline (a held hand keeps diffing)", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.pushFrame(frame(80), 250);
    const start = d.pushFrame(frame(80), 375);
    // If motion frames leaked into the EMA, the diff would have decayed
    // below threshold before the third frame. Score must still be full.
    expect(start?.score).toBe(30);
  });

  it("reset() returns to the pristine primed-on-next-frame state", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.reset();
    expect(d.isActive()).toBe(false);
    expect(d.pushFrame(frame(80), 250)).toBeNull(); // new baseline, not motion
    expect(d.pushFrame(frame(80), 375)).toBeNull(); // diff 0 vs new baseline
  });

  it("rePrime() relearns the baseline but KEEPS the cooldown clock", () => {
    const d = createMotionDetector(CFG);
    // Full episode → cooldown ends at 750 + 10_000 = 10_750.
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.pushFrame(frame(80), 250);
    expect(d.pushFrame(frame(80), 375)?.kind).toBe("MOTION_START");
    d.pushFrame(frame(50), 500);
    d.pushFrame(frame(50), 625);
    expect(d.pushFrame(frame(50), 750)?.kind).toBe("MOTION_END");

    // Tab hidden → shown: rePrime relearns the room like reset()...
    d.rePrime();
    expect(d.isActive()).toBe(false);
    expect(d.pushFrame(frame(90), 1_000)).toBeNull(); // primes silently
    // ...but unlike reset(), motion inside the surviving cooldown stays quiet.
    expect(d.pushFrame(frame(120), 1_125)).toBeNull();
    expect(d.pushFrame(frame(120), 1_250)).toBeNull();
    expect(d.pushFrame(frame(120), 1_375)).toBeNull(); // debounce met, still cooling
    // Past the original cooldown the same pattern fires again.
    expect(d.pushFrame(frame(90), 11_000)).toBeNull(); // calm frame — resets the run
    expect(d.pushFrame(frame(120), 11_125)).toBeNull();
    expect(d.pushFrame(frame(120), 11_250)).toBeNull();
    expect(d.pushFrame(frame(120), 11_375)?.kind).toBe("MOTION_START");
  });
});

describe("isGuardianSuspendedWIB", () => {
  it("suspends 18:00-06:00 WIB — 18:00 inclusive, 06:00 exclusive", () => {
    // WIB = UTC+7: 18:00 WIB == 11:00Z, 06:00 WIB == 23:00Z (prev day).
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T11:00:00Z"))).toBe(true); // 18:00
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T10:59:00Z"))).toBe(false); // 17:59
    expect(isGuardianSuspendedWIB(new Date("2026-08-08T22:59:00Z"))).toBe(true); // 05:59
    expect(isGuardianSuspendedWIB(new Date("2026-08-08T23:00:00Z"))).toBe(false); // 06:00
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T17:00:00Z"))).toBe(true); // 00:00 (midnight)
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T05:00:00Z"))).toBe(false); // 12:00 (noon)
  });

  it("fails open (not suspended) when the clock is unreadable", () => {
    expect(isGuardianSuspendedWIB(new Date(Number.NaN))).toBe(false);
  });
});
