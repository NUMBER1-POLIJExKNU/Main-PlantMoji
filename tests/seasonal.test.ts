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

  it("passes the amount through unchanged with no active event", () => {
    // 2026-01-15T03:00:00Z = 2026-01-15 10:00 WIB, a Thursday, outside both windows.
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
