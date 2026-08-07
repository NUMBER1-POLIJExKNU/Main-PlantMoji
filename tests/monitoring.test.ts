import { describe, expect, it } from "vitest";
import {
  clamp,
  clampMinutes,
  downsample,
  formatReading,
  needleAngle,
} from "@/components/sensor-gauge";

describe("clamp", () => {
  it("passes through in-range values", () => {
    expect(clamp(27.2, 0, 50)).toBe(27.2);
  });

  it("pins values below min and above max", () => {
    expect(clamp(-3, 0, 50)).toBe(0);
    expect(clamp(120, 0, 100)).toBe(100);
  });

  it("treats NaN as min (a broken reading never swings the needle)", () => {
    expect(clamp(Number.NaN, 0, 50)).toBe(0);
  });
});

describe("needleAngle", () => {
  it("points left (-90°) at min, up (0°) at mid, right (+90°) at max", () => {
    expect(needleAngle(0, 0, 50)).toBe(-90);
    expect(needleAngle(25, 0, 50)).toBe(0);
    expect(needleAngle(50, 0, 50)).toBe(90);
  });

  it("maps quarter-scale to -45°", () => {
    expect(needleAngle(12.5, 0, 50)).toBe(-45);
  });

  it("clamps out-of-range readings to the arc ends", () => {
    expect(needleAngle(-10, 0, 100)).toBe(-90);
    expect(needleAngle(250, 0, 100)).toBe(90);
  });

  it("pins a degenerate range (max <= min) to min", () => {
    expect(needleAngle(5, 10, 10)).toBe(-90);
    expect(needleAngle(5, 20, 10)).toBe(-90);
  });
});

describe("formatReading", () => {
  it("keeps one decimal like the design (27.2, 56.7)", () => {
    expect(formatReading(27.16)).toBe("27.2");
    expect(formatReading(56.74)).toBe("56.7");
  });

  it("drops the trailing zero on whole readings (57, not 57.0)", () => {
    expect(formatReading(57)).toBe("57");
    expect(formatReading(56.98)).toBe("57");
  });

  it("handles zero", () => {
    expect(formatReading(0)).toBe("0");
  });
});

describe("clampMinutes", () => {
  it("defaults to 60 for missing or non-numeric input", () => {
    expect(clampMinutes(null)).toBe(60);
    expect(clampMinutes(undefined)).toBe(60);
    expect(clampMinutes("")).toBe(60);
    expect(clampMinutes("abc")).toBe(60);
  });

  it("passes through valid whole minutes", () => {
    expect(clampMinutes("60")).toBe(60);
    expect(clampMinutes("5")).toBe(5);
    expect(clampMinutes("360")).toBe(360);
  });

  it("clamps below 5 and above 360", () => {
    expect(clampMinutes("4")).toBe(5);
    expect(clampMinutes("-30")).toBe(5);
    expect(clampMinutes("500")).toBe(360);
  });

  it("rounds fractional minutes", () => {
    expect(clampMinutes("12.4")).toBe(12);
    expect(clampMinutes("12.6")).toBe(13);
  });
});

describe("downsample", () => {
  const indexes = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("returns rows unchanged when at or under the cap", () => {
    expect(downsample(indexes(10), 500)).toEqual(indexes(10));
    expect(downsample(indexes(500), 500)).toEqual(indexes(500));
  });

  it("handles empty input and non-positive caps", () => {
    expect(downsample([], 500)).toEqual([]);
    expect(downsample(indexes(10), 0)).toEqual([]);
    expect(downsample(indexes(10), -1)).toEqual([]);
  });

  it("keeps only the first row for cap 1", () => {
    expect(downsample(indexes(10), 1)).toEqual([0]);
  });

  it("samples exactly cap rows, keeping first and last", () => {
    const out = downsample(indexes(100), 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(99);
  });

  it("spaces evenly when the stride divides exactly", () => {
    // step = 99/9 = 11 → every 11th index.
    expect(downsample(indexes(100), 10)).toEqual([0, 11, 22, 33, 44, 55, 66, 77, 88, 99]);
    expect(downsample(indexes(7), 3)).toEqual([0, 3, 6]);
  });

  it("keeps gaps within one step of each other (evenness)", () => {
    const out = downsample(indexes(1000), 500);
    expect(out).toHaveLength(500);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
    const gaps = out.slice(1).map((v, i) => v - out[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  });

  it("preserves order and never duplicates rows", () => {
    const out = downsample(indexes(937), 500);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThan(out[i - 1]);
    }
  });
});
