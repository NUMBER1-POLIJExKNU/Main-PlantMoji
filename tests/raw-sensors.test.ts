import { describe, expect, it } from "vitest";
import { getCropProfile } from "@/lib/crop-profiles";
import {
  determinePlantMood,
  isCropLightingHours,
  looksLikeRawSensorPayload,
  parseRawSensorReading,
} from "@/types/raw-sensors";

const NOW = new Date("2026-08-08T05:00:00Z"); // 12:00 WIB
const profile = getCropProfile("strawberry");
const normal = { temperature: 23, humidity: 55, soilPH: 6, light: 1 as const };

describe("raw sensor API contract", () => {
  it("parses the new flat Node-RED payload", () => {
    const parsed = parseRawSensorReading(
      {
        readingId: "plant-01-123",
        plantId: "plant-01",
        temperature: 23.5,
        humidity: 55,
        soilPH: 6.1,
        light: 1,
        timestamp: NOW.getTime(),
      },
      NOW,
    );
    expect(parsed).toEqual({
      ok: true,
      reading: {
        readingId: "plant-01-123",
        plantId: "plant-01",
        temperature: 23.5,
        humidity: 55,
        soilPH: 6.1,
        light: 1,
        recordedAt: NOW.toISOString(),
      },
    });
    expect(looksLikeRawSensorPayload({ temperature: 23 })).toBe(true);
    expect(looksLikeRawSensorPayload({ plantId: "plant-01" })).toBe(true);
    expect(looksLikeRawSensorPayload({ eventId: "legacy" })).toBe(false);
  });

  it.each([
    [{ plantId: "plant-01", temperature: 23, humidity: 55, soilPH: 6 }, /light/],
    [{ plantId: "plant-01", temperature: "23", humidity: 55, soilPH: 6, light: 1 }, /finite numbers/],
    [{ plantId: "plant-01", temperature: 23, humidity: 101, soilPH: 6, light: 1 }, /humidity/],
    [{ plantId: "plant-01", temperature: 23, humidity: 55, soilPH: 15, light: 1 }, /soilPH/],
    [{ plantId: "plant-01", temperature: 23, humidity: 55, soilPH: 6, light: 2 }, /light/],
  ])("rejects invalid payload %#", (input, expected) => {
    const parsed = parseRawSensorReading(input, NOW);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(expected);
  });
});

describe("server-side strawberry mood judgment", () => {
  it("uses the 28°C entry and 26°C recovery hysteresis", () => {
    expect(determinePlantMood({ ...normal, temperature: 27 }, "Happy", profile, true)).toBe("Happy");
    expect(determinePlantMood({ ...normal, temperature: 28 }, "Happy", profile, true)).toBe("Overheating");
    expect(determinePlantMood({ ...normal, temperature: 27 }, "Overheating", profile, true)).toBe("Overheating");
    expect(determinePlantMood({ ...normal, temperature: 26 }, "Overheating", profile, true)).toBe("Happy");
  });

  it("uses the 40/45% dry-air hysteresis", () => {
    expect(determinePlantMood({ ...normal, humidity: 39 }, "Happy", profile, true)).toBe("DryAir");
    expect(determinePlantMood({ ...normal, humidity: 40 }, "Happy", profile, true)).toBe("Happy");
    expect(determinePlantMood({ ...normal, humidity: 44 }, "DryAir", profile, true)).toBe("DryAir");
    expect(determinePlantMood({ ...normal, humidity: 45 }, "DryAir", profile, true)).toBe("Happy");
  });

  it("checks binary light only during lighting hours", () => {
    expect(determinePlantMood({ ...normal, light: 0 }, "Happy", profile, true)).toBe("Sleepy");
    expect(determinePlantMood({ ...normal, light: 0 }, "Happy", profile, false)).toBe("Happy");
    expect(isCropLightingHours(new Date("2026-08-08T05:00:00Z"), profile)).toBe(true);
    expect(isCropLightingHours(new Date("2026-08-08T13:00:00Z"), profile)).toBe(false);
  });

  it("uses pH 5.5–6.5 and keeps safety priority", () => {
    expect(determinePlantMood({ ...normal, soilPH: 5.49 }, "Happy", profile, true)).toBe("SoilAcidic");
    expect(determinePlantMood({ ...normal, soilPH: 6.51 }, "Happy", profile, true)).toBe("SoilAlkaline");
    expect(determinePlantMood({ ...normal, temperature: 28, soilPH: 5 }, "Happy", profile, true)).toBe("Overheating");
  });
});
