import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { windowFromNewest } from "@/lib/sensor-history-window";
import { GAP_BREAK_MS } from "@/components/sensor-history-charts";
import { SENSOR_STALE_AFTER_MS } from "@/components/monitoring-live";

// The history window used to be `recorded_at >= now - 60min`, which tied the
// chart to the viewer's clock rather than to the data. Switch the kit off and
// the window slid off the end of the readings; an hour later /monitoring's
// biggest card was an empty box — exactly when someone would want to see what
// the sensors last recorded.

const MINUTES = 60;
const T0 = Date.parse("2026-08-13T12:00:00.000Z");
/** `count` rows at `stepMs` apart ending at `endMs`, newest-first like the query. */
function rows(count: number, endMs: number, stepMs = 2_000) {
  return Array.from({ length: count }, (_, i) => ({
    recorded_at: new Date(endMs - i * stepMs).toISOString(),
  }));
}
const span = (out: { recorded_at: string }[]) =>
  Date.parse(out[0].recorded_at) - Date.parse(out[out.length - 1].recorded_at);

describe("sensor history window", () => {
  it("keeps the live hour while readings are arriving", () => {
    const live = rows(1000, T0);
    const out = windowFromNewest(live, MINUTES);
    expect(out).toHaveLength(1000);
    expect(out[0].recorded_at).toBe(live[0].recorded_at);
  });

  it("still answers with the hour before a kit stopped, however long ago", () => {
    // The reported bug: sensors off, wall clock marches on, card goes blank.
    // The window is anchored on the newest READING, so age is irrelevant.
    const stopped = rows(900, Date.parse("2026-08-13T09:00:00.000Z"));
    const out = windowFromNewest(stopped, MINUTES);
    expect(out).toHaveLength(900);
    expect(out[0].recorded_at).toBe(stopped[0].recorded_at);
  });

  it("drops rows older than the window measured back from the newest row", () => {
    // 30 min of 2s rows, then a much older block that must not be dragged in.
    const recent = rows(900, T0);
    const ancient = rows(200, T0 - 5 * 3_600_000);
    const out = windowFromNewest([...recent, ...ancient], MINUTES);
    expect(out).toHaveLength(900);
    expect(span(out)).toBeLessThanOrEqual(MINUTES * 60_000);
  });

  it("splices onto the previous history when the fresh rows are too few", () => {
    // Kit switched back on: a handful of new rows, a three-hour hole, then
    // the history from before the outage. Anchoring alone would leave those
    // few rows alone on an empty axis, so the window reaches back across it.
    const fresh = rows(5, T0);
    const before = rows(500, T0 - 3 * 3_600_000);
    const out = windowFromNewest([...fresh, ...before], MINUTES);
    expect(out.length).toBeGreaterThan(fresh.length);
    expect(out[0].recorded_at).toBe(fresh[0].recorded_at);
    // It reached past the outage into the older block.
    expect(span(out)).toBeGreaterThan(3 * 3_600_000);
  });

  it("never empties a non-empty result", () => {
    // Whatever the shape, if rows exist the chart gets something to draw.
    for (const input of [rows(1, T0), rows(3, T0), rows(59, T0), rows(61, T0)]) {
      expect(windowFromNewest(input, MINUTES).length).toBeGreaterThan(0);
    }
    expect(windowFromNewest([], MINUTES)).toEqual([]);
  });

  it("hands back everything rather than emptying on an unparseable anchor", () => {
    const broken = [{ recorded_at: "not a date" }, ...rows(10, T0)];
    expect(windowFromNewest(broken, MINUTES)).toHaveLength(11);
  });
});

describe("sensor history chart gaps", () => {
  it("breaks the line on the same silence the status bar calls offline", () => {
    // Two names for one judgement ("this kit has stopped"). GAP_BREAK_MS is
    // duplicated because monitoring-live imports the chart, not the reverse.
    expect(GAP_BREAK_MS).toBe(SENSOR_STALE_AFTER_MS);
  });

  it("does not carry a series across an outage", () => {
    const source = readFileSync("src/components/sensor-history-charts.tsx", "utf8");
    // Without this the spliced halves are joined by one long diagonal
    // asserting a smooth drift that nothing measured.
    expect(source).toContain("if (previousT !== null && sample.t - previousT > GAP_BREAK_MS) open = false;");
  });

  it("labels the frozen window instead of implying it is current", () => {
    const source = readFileSync("src/components/monitoring-live.tsx", "utf8");
    expect(source).toContain("c.trendFrozen(lastReadingAt, spanMinutes) : c.trendNote(spanMinutes)");
    expect(source).toContain("trendFrozen: (at: string, mins: number) =>");
    expect(source).toContain("sensors stopped");
    expect(source).toContain("sensor berhenti");
  });

  it("states the span it really drew rather than the hour it asked for", () => {
    // PostgREST caps at 1000 rows, so at a 2s cadence the chart has always
    // shown the newest ~34 minutes. "· 1 hour" was off by nearly half.
    const monitoring = readFileSync("src/components/monitoring-live.tsx", "utf8");
    const bar = readFileSync("src/components/live-activity-bar.tsx", "utf8");
    expect(monitoring).not.toContain("Sensor history · 1 hour");
    expect(monitoring).not.toContain("Riwayat sensor · 1 jam");
    expect(monitoring).toContain("const spanMinutes = samples.length > 1");
    expect(bar).not.toContain("· 60 min");
    expect(bar).not.toContain("· 60 mnt");
  });
});

describe("sensor history route", () => {
  const source = readFileSync("src/app/api/sensor-history/route.ts", "utf8");

  it("no longer filters the history by the wall clock", () => {
    expect(source).not.toContain('gte("recorded_at", sinceIso)');
    expect(source).not.toContain("Date.now() - minutes");
    expect(source).toContain("windowFromNewest(rows, minutes)");
  });

  it("keeps the newest rows when the fetch limit bites", () => {
    // Ordering must stay descending: at a 2s cadence an hour is ~1800 rows
    // and PostgREST caps at 1000, so ascending order would return the OLDEST
    // thousand and the chart would trail an hour behind the garden.
    expect(source).toContain('order("recorded_at", { ascending: false })');
  });
});
