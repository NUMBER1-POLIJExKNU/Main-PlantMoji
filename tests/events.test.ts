import { describe, expect, it } from "vitest";
import { normalizeMood, parseDeviceEvent, PLANT_MOODS } from "@/types/events";

/** Builds an ISO-8601 timestamp offset from "now", so future/past checks stay
 *  deterministic without needing fake timers. */
function isoOffsetFromNow(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

/** Builds a past ISO-8601 timestamp with an explicit fractional-second digit
 *  count (padded with zeros past the natural 3-digit toISOString() output),
 *  safely outside the 10-minute future window regardless of test run time. */
function pastIsoWithFractionDigits(msAgo: number, digits: number): string {
  const iso = new Date(Date.now() - msAgo).toISOString();
  const match = iso.match(/^(.*\.\d{3})Z$/);
  if (!match) throw new Error(`unexpected ISO format: ${iso}`);
  const base = match[1];
  if (digits === 3) return `${base}Z`;
  if (digits > 3) return `${base}${"0".repeat(digits - 3)}Z`;
  return `${base.slice(0, base.length - (3 - digits))}Z`;
}

function baseValid() {
  return {
    eventId: "evt-1",
    plantId: "plant-1",
    type: "SENSOR_ONLINE",
    occurredAt: new Date().toISOString(),
    data: {},
  };
}

describe("normalizeMood", () => {
  it("accepts each canonical mood code unchanged", () => {
    for (const mood of PLANT_MOODS) {
      expect(normalizeMood(mood)).toBe(mood);
    }
  });

  it("tolerates spacing, underscores, hyphens and case variants", () => {
    expect(normalizeMood("Dry Air")).toBe("DryAir");
    expect(normalizeMood("dry_air")).toBe("DryAir");
    expect(normalizeMood("DRY-AIR")).toBe("DryAir");
    expect(normalizeMood("dryair")).toBe("DryAir");
    expect(normalizeMood("Too Cold")).toBe("TooCold");
    expect(normalizeMood("too_cold")).toBe("TooCold");
    expect(normalizeMood("TOO-COLD")).toBe("TooCold");
    expect(normalizeMood("Humid Air")).toBe("HumidAir");
    expect(normalizeMood("humid_air")).toBe("HumidAir");
    expect(normalizeMood("soil acidic")).toBe("SoilAcidic");
    expect(normalizeMood("SOIL ALKALINE")).toBe("SoilAlkaline");
    // The strip regex is global, so surrounding whitespace is removed too.
    expect(normalizeMood("  happy  ")).toBe("Happy");
  });

  it("returns null for unknown strings and non-string values", () => {
    expect(normalizeMood("Thirsty")).toBeNull();
    expect(normalizeMood("")).toBeNull();
    expect(normalizeMood(null)).toBeNull();
    expect(normalizeMood(undefined)).toBeNull();
    expect(normalizeMood(42)).toBeNull();
    expect(normalizeMood({})).toBeNull();
  });
});

describe("parseDeviceEvent", () => {
  it("accepts a valid event", () => {
    const result = parseDeviceEvent(baseValid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.eventId).toBe("evt-1");
    expect(result.event.plantId).toBe("plant-1");
    expect(result.event.type).toBe("SENSOR_ONLINE");
  });

  it("rejects a body that is not a JSON object", () => {
    expect(parseDeviceEvent(null).ok).toBe(false);
    expect(parseDeviceEvent("nope").ok).toBe(false);
    expect(parseDeviceEvent([]).ok).toBe(false);
    expect(parseDeviceEvent(42).ok).toBe(false);
  });

  it("rejects a missing eventId", () => {
    const { eventId: _eventId, ...rest } = baseValid();
    const result = parseDeviceEvent(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/eventId/);
  });

  it("rejects a missing plantId", () => {
    const { plantId: _plantId, ...rest } = baseValid();
    const result = parseDeviceEvent(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/plantId/);
  });

  it("rejects a missing or unrecognized type", () => {
    const { type: _type, ...rest } = baseValid();
    const missing = parseDeviceEvent(rest);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/type must be one of/);

    const unknown = parseDeviceEvent({ ...baseValid(), type: "QUEST_CREATED" });
    expect(unknown.ok).toBe(false);
  });

  it("rejects occurredAt without a timezone offset", () => {
    const result = parseDeviceEvent({ ...baseValid(), occurredAt: "2026-08-07T12:00:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/timezone offset/);
  });

  it("rejects occurredAt more than 10 minutes in the future", () => {
    const result = parseDeviceEvent({
      ...baseValid(),
      occurredAt: isoOffsetFromNow(11 * 60 * 1000),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/10 minutes in the future/);
  });

  it("accepts occurredAt within the 10 minute future tolerance", () => {
    const result = parseDeviceEvent({
      ...baseValid(),
      occurredAt: isoOffsetFromNow(5 * 60 * 1000),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts fractional-second offsets with 3 and 7 digits", () => {
    const threeDigit = parseDeviceEvent({
      ...baseValid(),
      occurredAt: pastIsoWithFractionDigits(60_000, 3),
    });
    expect(threeDigit.ok).toBe(true);

    const sevenDigit = parseDeviceEvent({
      ...baseValid(),
      occurredAt: pastIsoWithFractionDigits(60_000, 7),
    });
    expect(sevenDigit.ok).toBe(true);
  });

  it("normalizes currentState casing/spacing for PLANT_STATE_CHANGED", () => {
    const spaced = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: { currentState: "Dry Air" },
    });
    expect(spaced.ok).toBe(true);
    if (spaced.ok) expect(spaced.event.data.currentState).toBe("DryAir");

    const lower = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: { currentState: "dryair" },
    });
    expect(lower.ok).toBe(true);
    if (lower.ok) expect(lower.event.data.currentState).toBe("DryAir");
  });

  it("rejects an invalid currentState", () => {
    const result = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: { currentState: "Thirsty" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/currentState must be one of/);
  });

  it("requires currentState for PLANT_STATE_CHANGED", () => {
    const result = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/currentState must be one of/);
  });

  it("normalizes an optional previousState and rejects an invalid one", () => {
    const ok = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: { currentState: "Happy", previousState: "SOIL ACIDIC" },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.event.data.previousState).toBe("SoilAcidic");

    const bad = parseDeviceEvent({
      ...baseValid(),
      type: "PLANT_STATE_CHANGED",
      data: { currentState: "Happy", previousState: "Thirsty" },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/previousState must be one of/);
  });
});
