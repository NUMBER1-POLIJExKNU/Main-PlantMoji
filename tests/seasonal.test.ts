import { describe, expect, it } from "vitest";
import {
  applySeasonalMultiplier,
  getActiveSeasonalEvents,
} from "@/game/seasonal/seasonal-events";

describe("getActiveSeasonalEvents / applySeasonalMultiplier", () => {
  it("applies the Hot Weather bonus on an August weekday (WIB)", () => {
    // 2026-08-05T03:00:00Z = 2026-08-05 10:00 WIB, a Wednesday.
    const date = new Date("2026-08-05T03:00:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id)).toEqual(["HOT_WEATHER"]);
    expect(applySeasonalMultiplier(100, date)).toEqual({ amount: 120, active });
  });

  it("does not stack Hot Weather and Weekend Growth on an August Saturday (WIB)", () => {
    // 2026-08-08T03:00:00Z = 2026-08-08 10:00 WIB, a Saturday.
    const date = new Date("2026-08-08T03:00:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id).sort()).toEqual(["HOT_WEATHER", "WEEKEND_GROWTH"]);
    // max(1.2, 1.1) = 1.2, never 1.2 * 1.1.
    expect(applySeasonalMultiplier(100, date).amount).toBe(120);
  });

  it("applies only the Weekend Growth bonus on a September Saturday (WIB)", () => {
    // 2026-09-05T03:00:00Z = 2026-09-05 10:00 WIB, a Saturday, outside the Hot Weather window.
    const date = new Date("2026-09-05T03:00:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id)).toEqual(["WEEKEND_GROWTH"]);
    expect(applySeasonalMultiplier(100, date).amount).toBe(110);
  });

  it("applies the Musim Hujan bonus on a rainy-season weekday (WIB)", () => {
    // 2026-11-18T03:00:00Z = 2026-11-18 10:00 WIB, a Wednesday.
    const date = new Date("2026-11-18T03:00:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id)).toEqual(["MUSIM_HUJAN"]);
    expect(applySeasonalMultiplier(100, date)).toEqual({ amount: 115, active });
  });

  it("does not stack Musim Hujan and Weekend Growth on a November Saturday (WIB)", () => {
    // 2026-11-21T03:00:00Z = 2026-11-21 10:00 WIB, a Saturday.
    const date = new Date("2026-11-21T03:00:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id).sort()).toEqual(["MUSIM_HUJAN", "WEEKEND_GROWTH"]);
    // max(1.15, 1.1) = 1.15, never 1.15 * 1.1.
    expect(applySeasonalMultiplier(100, date).amount).toBe(115);
  });

  it("keeps Musim Hujan active through its last day and ends it the day after (WIB)", () => {
    // 2027-04-30T03:00:00Z = 2027-04-30 10:00 WIB — final day of the window.
    const lastDay = new Date("2027-04-30T03:00:00Z");
    expect(getActiveSeasonalEvents(lastDay).map((e) => e.id)).toEqual(["MUSIM_HUJAN"]);
    expect(applySeasonalMultiplier(100, lastDay).amount).toBe(115);
    // 2027-05-01T03:00:00Z = 2027-05-01 10:00 WIB — season over (Weekend Growth
    // ended 2026-12-31, so this Saturday has no event either).
    const dayAfter = new Date("2027-05-01T03:00:00Z");
    expect(getActiveSeasonalEvents(dayAfter)).toEqual([]);
    expect(applySeasonalMultiplier(100, dayAfter).amount).toBe(100);
  });

  it("passes the amount through unchanged with no active event", () => {
    // 2026-01-15T03:00:00Z = 2026-01-15 10:00 WIB, a Thursday, before every window.
    const date = new Date("2026-01-15T03:00:00Z");
    expect(getActiveSeasonalEvents(date)).toEqual([]);
    expect(applySeasonalMultiplier(100, date)).toEqual({ amount: 100, active: [] });
  });

  it("treats a WIB-boundary instant as already the next calendar day", () => {
    // 2026-07-31T17:30:00Z is UTC+7 = 2026-08-01 00:30 WIB — a Saturday, already
    // inside the Hot Weather window even though the UTC calendar date is still July 31.
    const date = new Date("2026-07-31T17:30:00Z");
    const active = getActiveSeasonalEvents(date);
    expect(active.map((e) => e.id).sort()).toEqual(["HOT_WEATHER", "WEEKEND_GROWTH"]);
    expect(applySeasonalMultiplier(100, date).amount).toBe(120);
  });
});
