import { describe, expect, it } from "vitest";
import { formatSensorAge } from "@/components/live-activity-bar";

// The activity strip printed `${seconds.toFixed(1)}s` at every scale. With the
// kit switched off that read "16620.0s" — the one number on screen that is
// supposed to answer "is the garden talking to us?" at a glance, in a unit
// nobody converts in their head.

describe("formatSensorAge", () => {
  it("keeps tenths of a second for the live heartbeat", () => {
    // Under a minute is the range where 0.4s and 12s differ meaningfully.
    expect(formatSensorAge(0, "en")).toBe("0.0s");
    expect(formatSensorAge(0.4, "en")).toBe("0.4s");
    expect(formatSensorAge(12.34, "en")).toBe("12.3s");
    expect(formatSensorAge(59.9, "en")).toBe("59.9s");
  });

  it("switches to minutes and seconds past a minute", () => {
    expect(formatSensorAge(60, "en")).toBe("1m 0s");
    expect(formatSensorAge(90, "en")).toBe("1m 30s");
    expect(formatSensorAge(3599, "en")).toBe("59m 59s");
  });

  it("switches to hours and minutes past an hour", () => {
    expect(formatSensorAge(3600, "en")).toBe("1h 0m");
    // The reported case: sensors off for 277 minutes.
    expect(formatSensorAge(277 * 60, "en")).toBe("4h 37m");
    expect(formatSensorAge(86_399, "en")).toBe("23h 59m");
  });

  it("switches to days and hours past a day", () => {
    // A kit left off over a weekend must not report four figures of hours.
    expect(formatSensorAge(86_400, "en")).toBe("1d 0h");
    expect(formatSensorAge(2 * 86_400 + 7 * 3600, "en")).toBe("2d 7h");
    expect(formatSensorAge(30 * 86_400, "en")).toBe("30d 0h");
  });

  it("never shows more than two units", () => {
    // A duration does not need "4h 37m 12s"; the extra precision is noise at
    // that scale and makes the strip wrap.
    for (const seconds of [61, 3661, 90_061, 900_061]) {
      expect(formatSensorAge(seconds, "en").split(" ")).toHaveLength(2);
    }
  });

  it("uses Indonesian units", () => {
    // detik / menit / jam / hari. "h" is hari, not hours — a reader only ever
    // sees one locale's ladder, so there is nothing to confuse it with.
    expect(formatSensorAge(12.3, "id")).toBe("12.3dt");
    expect(formatSensorAge(90, "id")).toBe("1mnt 30dt");
    expect(formatSensorAge(277 * 60, "id")).toBe("4j 37mnt");
    expect(formatSensorAge(2 * 86_400 + 7 * 3600, "id")).toBe("2h 7j");
  });

  it("refuses to render a nonsense age", () => {
    // A clock skew or an unparsed timestamp must show a dash, not "-3.0s".
    expect(formatSensorAge(-1, "en")).toBe("—");
    expect(formatSensorAge(Number.NaN, "en")).toBe("—");
    expect(formatSensorAge(Number.POSITIVE_INFINITY, "en")).toBe("—");
  });
});
