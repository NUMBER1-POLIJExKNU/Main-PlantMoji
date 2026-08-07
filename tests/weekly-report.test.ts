import { describe, expect, it } from "vitest";
import { computeHealthySeconds, wibWeekWindow } from "@/lib/weekly-report";
import type { HealthyTimeline } from "@/lib/weekly-report";

describe("computeHealthySeconds", () => {
  it("counts one Happy interval bounded by state changes", () => {
    // 0-20s: mood unknown (not healthy). 20-80s: Happy (healthy). 80-100s: Sleepy.
    const timeline: HealthyTimeline = {
      windowStartMs: 0,
      windowEndMs: 100_000,
      moodAtStart: null,
      sensorOnlineAtStart: true,
      events: [
        { atMs: 20_000, kind: "state", mood: "Happy" },
        { atMs: 80_000, kind: "state", mood: "Sleepy" },
      ],
    };
    expect(computeHealthySeconds(timeline)).toBe(60);
  });

  it("excludes spans where the sensor is offline even while the last mood was Happy", () => {
    // 0-30s: Happy + online (healthy). 30-70s: offline (excluded). 70-100s: online again (healthy).
    const timeline: HealthyTimeline = {
      windowStartMs: 0,
      windowEndMs: 100_000,
      moodAtStart: "Happy",
      sensorOnlineAtStart: true,
      events: [
        { atMs: 30_000, kind: "sensor", online: false },
        { atMs: 70_000, kind: "sensor", online: true },
      ],
    };
    expect(computeHealthySeconds(timeline)).toBe(60);
  });

  it("carries a pre-window seed state through the whole window when nothing changes", () => {
    const timeline: HealthyTimeline = {
      windowStartMs: 0,
      windowEndMs: 50_000,
      moodAtStart: "Happy",
      sensorOnlineAtStart: true,
      events: [],
    };
    expect(computeHealthySeconds(timeline)).toBe(50);
  });

  it("excludes through the window end for an unclosed offline span", () => {
    // 0-40s: Happy + online (healthy). 40-100s: offline with no matching SENSOR_ONLINE.
    const timeline: HealthyTimeline = {
      windowStartMs: 0,
      windowEndMs: 100_000,
      moodAtStart: "Happy",
      sensorOnlineAtStart: true,
      events: [{ atMs: 40_000, kind: "sensor", online: false }],
    };
    expect(computeHealthySeconds(timeline)).toBe(40);
  });
});

describe("wibWeekWindow", () => {
  it("anchors the window to Monday 00:00 WIB regardless of which weekday is the reference", () => {
    // 2026-08-05T10:00:00Z is Wed Aug 5 WIB; 2026-08-03T10:00:00Z is Mon Aug 3 WIB —
    // both fall in the same WIB week, so both must resolve to the same Monday start.
    const wednesday = new Date("2026-08-05T10:00:00Z");
    const monday = new Date("2026-08-03T10:00:00Z");
    const now = new Date("2026-08-06T12:00:00Z");

    const wedWindow = wibWeekWindow(wednesday, now);
    const monWindow = wibWeekWindow(monday, now);

    expect(new Date(wedWindow.startMs).toISOString()).toBe("2026-08-02T17:00:00.000Z");
    expect(wedWindow.startMs).toBe(monWindow.startMs);
  });

  it("caps an in-progress week's end at `now`", () => {
    const reference = new Date("2026-08-05T10:00:00Z");
    const now = new Date("2026-08-06T12:00:00Z");
    const window = wibWeekWindow(reference, now);
    expect(window.endMs).toBe(now.getTime());
  });

  it("runs a fully elapsed week through its next-Monday boundary", () => {
    const reference = new Date("2026-08-05T10:00:00Z");
    const now = new Date("2026-08-15T00:00:00Z"); // well past the following Monday
    const window = wibWeekWindow(reference, now);
    expect(new Date(window.endMs).toISOString()).toBe("2026-08-09T17:00:00.000Z");
  });

  it("clamps endMs to startMs when `now` is before the window starts", () => {
    const reference = new Date("2026-08-05T10:00:00Z");
    const now = new Date("2026-08-01T00:00:00Z"); // before the Monday start
    const window = wibWeekWindow(reference, now);
    expect(window.endMs).toBe(window.startMs);
  });
});
