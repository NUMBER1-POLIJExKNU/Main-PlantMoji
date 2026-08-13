import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SENSOR_STALE_AFTER_MS, sensorStatus } from "@/components/monitoring-live";

// Regression: /monitoring showed a green "SENSORS LIVE" dot, an "Updated
// <poll time>" stamp and four numbers labelled "Live" while the kit had been
// silent for three hours. `state === "ok"` only ever meant the HTTP request
// succeeded — the history route answers 200 with the last stored row however
// old it is. Nothing failed, so nothing caught it.

const NOW = Date.parse("2026-08-13T15:39:00.000Z");
const ago = (ms: number) => NOW - ms;
const status = (over: Partial<Parameters<typeof sensorStatus>[0]> = {}) =>
  sensorStatus({ state: "ok", lastReadingMs: ago(2_000), nowMs: NOW, demo: false, ...over });

describe("monitoring sensor status", () => {
  it("reports live only while readings are actually arriving", () => {
    expect(status()).toBe("live");
    expect(status({ lastReadingMs: ago(SENSOR_STALE_AFTER_MS - 1) })).toBe("live");
  });

  it("reports offline once the newest reading passes the threshold", () => {
    expect(status({ lastReadingMs: ago(SENSOR_STALE_AFTER_MS + 1) })).toBe("offline");
    // The reading that actually shipped this bug: 3h11m of silence.
    expect(status({ lastReadingMs: ago(191 * 60_000) })).toBe("offline");
  });

  it("never calls a reachable API a live sensor", () => {
    // The whole defect in one line: HTTP 200 with a fossil attached.
    expect(status({ state: "ok", lastReadingMs: ago(24 * 3_600_000) })).toBe("offline");
  });

  it("treats unknown age as offline, never as fresh", () => {
    // No rows at all, or a recorded_at that would not parse.
    expect(status({ lastReadingMs: null })).toBe("offline");
  });

  it("keeps the fetch states it already had", () => {
    expect(status({ state: "loading" })).toBe("connecting");
    expect(status({ state: "error" })).toBe("retrying");
    expect(status({ state: "no-env" })).toBe("retrying");
    // Age must not override a failed fetch — the banners explain those.
    expect(status({ state: "error", lastReadingMs: ago(1_000) })).toBe("retrying");
  });

  it("never marks the classroom sandbox stale", () => {
    // Cheat-mode vitals are invented client-side and carry no recorded_at, so
    // a real feed that died hours ago must not paint the demo card red.
    expect(status({ demo: true, lastReadingMs: null })).toBe("demo");
    expect(status({ demo: true, lastReadingMs: ago(9 * 3_600_000) })).toBe("demo");
    expect(status({ demo: true, state: "error" })).toBe("demo");
  });

  it("sets the threshold well clear of the real push cadence", () => {
    // Measured on this kit: 1000 consecutive rows at a 2.0s median, worst gap
    // 3.5s, zero gaps over 60s. The threshold has to sit far above that so a
    // Wi-Fi blip cannot trip it, and far above the 10s poll so the label
    // cannot flicker between two ticks.
    expect(SENSOR_STALE_AFTER_MS).toBeGreaterThan(60_000);
    expect(status({ lastReadingMs: ago(3_500) })).toBe("live");
    expect(status({ lastReadingMs: ago(60_000) })).toBe("live");
    // ...but still short enough to admit a dead kit during a demo.
    expect(SENSOR_STALE_AFTER_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe("monitoring staleness reaches every surface", () => {
  const source = readFileSync("src/components/monitoring-live.tsx", "utf8");

  it("drives the dot, the label and all four cards from the one derivation", () => {
    // The bug was four independent reads of the same question disagreeing.
    expect(source).not.toMatch(/state === "ok" \? "is-live"/);
    expect(source).toContain('status === "live" ? "is-live" : status === "offline" ? "is-stale"');
    expect(source.split("stale={staleReal}").length - 1).toBe(4);
  });

  it("stops printing the poll clock over a dead feed", () => {
    // "Updated 00:39" for a 3-hour-old reading was the most convincing part
    // of the lie: it reports when the app last ASKED, not when the data was
    // made. While offline the card shows the reading's own time instead.
    expect(source).toContain("`${c.lastSeen} ${lastReadingAt}`");
    expect(source).toContain("staleReal && lastReadingAt");
  });

  it("says it out loud, in both languages", () => {
    // A recoloured dot is too quiet to undo the impression four big
    // fresh-looking numbers give.
    expect(source).toContain("c.staleBanner(lastReadingAt)");
    expect(source).toContain('offline: "SENSORS OFFLINE"');
    expect(source).toContain('offline: "SENSOR TERPUTUS"');
    expect(source).toContain('staleWord: "Stale"');
    expect(source).toContain('staleWord: "Data lama"');
  });

  it("has a stale dot style that is not the connecting amber", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".pm-monitor-status-dot.is-stale");
    expect(css).toContain(".pm-monitor-reading-foot > span.is-stale");
  });
});
