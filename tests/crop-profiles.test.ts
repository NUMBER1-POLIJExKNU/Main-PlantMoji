import { describe, expect, it } from "vitest";
import {
  evaluateCropEnvironment,
  getCropProfile,
  isCropProfileKey,
} from "@/lib/crop-profiles";

describe("strawberry crop profile", () => {
  const profile = getCropProfile("strawberry");

  it("normalizes missing and unknown saved values to strawberry", () => {
    expect(getCropProfile(null).key).toBe("strawberry");
    expect(getCropProfile("unknown").key).toBe("strawberry");
    expect(isCropProfileKey("strawberry")).toBe(true);
    expect(isCropProfileKey("tomato")).toBe(false);
  });

  it("offers the complete-sensor Jember classroom profiles", () => {
    expect(isCropProfileKey("soybean")).toBe(true);
    expect(isCropProfileKey("cayenne-pepper")).toBe(true);
    expect(getCropProfile("soybean").soilPh.recommended).toEqual({ min: 5.5, max: 7.5 });
    expect(getCropProfile("cayenne-pepper").airHumidity.recommended).toEqual({ min: 60, max: 80 });
  });

  it("defines temperature and dry-air hysteresis boundaries", () => {
    expect(profile.temperature.tolerated.max).toBe(27);
    expect(profile.temperature.overheating.enterAtOrAbove).toBe(28);
    expect(profile.temperature.overheating.recoverAtOrBelow).toBe(26);
    expect(profile.airHumidity.dryAir.enterBelow).toBe(40);
    expect(profile.airHumidity.dryAir.recoverAtOrAbove).toBe(45);
  });

  it("defines the opposite cold + humid-air bands", () => {
    expect(profile.temperature.cold.enterAtOrBelow).toBe(14);
    expect(profile.temperature.cold.recoverAtOrAbove).toBe(16);
    expect(profile.airHumidity.humidAir.enterAbove).toBe(60);
    expect(profile.airHumidity.humidAir.recoverAtOrBelow).toBe(55);
  });

  it("keeps every profile's hysteresis bands internally ordered", () => {
    for (const key of ["strawberry", "soybean", "cayenne-pepper"] as const) {
      const p = getCropProfile(key);
      // Overheating enters higher than it recovers; cold enters lower than it recovers.
      expect(p.temperature.overheating.enterAtOrAbove).toBeGreaterThan(p.temperature.overheating.recoverAtOrBelow);
      expect(p.temperature.cold.enterAtOrBelow).toBeLessThan(p.temperature.cold.recoverAtOrAbove);
      // Cold band sits below the overheating band, with no overlap.
      expect(p.temperature.cold.recoverAtOrAbove).toBeLessThan(p.temperature.overheating.recoverAtOrBelow);
      // Dry enters below it recovers; humid enters above it recovers; dry < humid.
      expect(p.airHumidity.dryAir.enterBelow).toBeLessThan(p.airHumidity.dryAir.recoverAtOrAbove);
      expect(p.airHumidity.humidAir.enterAbove).toBeGreaterThan(p.airHumidity.humidAir.recoverAtOrBelow);
      expect(p.airHumidity.dryAir.recoverAtOrAbove).toBeLessThan(p.airHumidity.humidAir.recoverAtOrBelow);
    }
  });

  it("classifies the requested temperature and humidity advisory boundaries", () => {
    const reading = (temperature: number, humidity: number) =>
      evaluateCropEnvironment({ temperature, humidity, soilPh: 6, light: 60 }, profile);
    expect(reading(27, 40).temperature).toBe("Optimal");
    expect(reading(28, 40).temperature).toBe("High");
    expect(reading(26, 40).temperature).toBe("Optimal");
    expect(reading(20, 39).airHumidity).toBe("Low");
    expect(reading(20, 40).airHumidity).toBe("Optimal");
    expect(reading(20, 45).airHumidity).toBe("Optimal");
  });

  it.each([
    [5.49, "Low"], [5.5, "Optimal"], [6.5, "Optimal"], [6.51, "High"],
  ] as const)("classifies pH %s as %s", (soilPh, expected) => {
    expect(evaluateCropEnvironment({ temperature: 20, humidity: 40, soilPh, light: 60 }, profile).soilPh).toBe(expected);
  });

  it("classifies waiting, low and high sensor states", () => {
    expect(evaluateCropEnvironment(null, profile)).toEqual({ temperature: "Waiting", airHumidity: "Waiting", soilPh: "Waiting", light: "Waiting" });
    expect(evaluateCropEnvironment({ temperature: 14, humidity: 39, soilPh: 5.49, light: 0 }, profile)).toEqual({ temperature: "Low", airHumidity: "Low", soilPh: "Low", light: "Low" });
    expect(evaluateCropEnvironment({ temperature: 28, humidity: 61, soilPh: 6.51, light: 30 }, profile)).toEqual({ temperature: "High", airHumidity: "High", soilPh: "High", light: "Optimal" });
  });
});
