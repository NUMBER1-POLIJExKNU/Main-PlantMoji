import { describe, expect, it } from "vitest";
import { frameDifference, isCameraActiveHour, nextMotionState, rgbaToGrayscale, type MotionState } from "@/lib/motion-detect";

const initial = (): MotionState => ({ baseline: null, active: false, consecutive: 0, lastEventAt: -10_000 });

describe("deterministic camera motion", () => {
  it("computes mean absolute frame difference", () => expect(frameDifference([0, 10], [10, 20])).toBe(10));
  it("converts RGBA without using AI", () => expect([...rgbaToGrayscale(new Uint8ClampedArray([255, 0, 0, 255]))]).toEqual([76]));
  it("requires consecutive frames and respects cooldown", () => {
    let state = nextMotionState(initial(), new Uint8ClampedArray([0, 0]), 0).state;
    expect(nextMotionState(state, new Uint8ClampedArray([30, 30]), 1).event).toBeNull();
    state = nextMotionState(state, new Uint8ClampedArray([30, 30]), 1).state;
    state = nextMotionState(state, new Uint8ClampedArray([30, 30]), 2).state;
    expect(nextMotionState(state, new Uint8ClampedArray([30, 30]), 3).event).toBe("MOTION_START");
  });
  it("watches only from 06:00 through 17:59 WIB", () => {
    expect(isCameraActiveHour(5)).toBe(false); expect(isCameraActiveHour(6)).toBe(true);
    expect(isCameraActiveHour(17)).toBe(true); expect(isCameraActiveHour(18)).toBe(false);
  });
});
