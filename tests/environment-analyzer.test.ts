import { describe, expect, it } from "vitest";
import { analyzeEnvironment, compareEnvironmentToCrops, type EnvironmentCropProfile } from "@/lib/environment-analyzer";

const crop = (key: string, order = 1): EnvironmentCropProfile => ({
  key, displayName: key, status: "draft", catalogOrder: order,
  temperature: { min: 20, max: 30 }, airHumidity: { min: 60, max: 80 }, soilPh: { min: 5.5, max: 7 },
  light: { required: 1, evaluateNow: true },
});

describe("Environment Analyzer", () => {
  it("reports transparent matches and boundary values", () => {
    const result = analyzeEnvironment({ temperature: 20, humidity: 80, soilPh: 5.5, light: 1 }, crop("chili"));
    expect(result.matchedConditions).toBe(4); expect(result.evaluatedConditions).toBe(4); expect(result.label).toBe("excellent");
  });
  it("distinguishes low, high, missing, and unavailable values", () => {
    const profile = crop("coffee"); profile.airHumidity = { min: null, max: null };
    const result = analyzeEnvironment({ temperature: 19, humidity: 70, soilPh: 8, light: Number.NaN }, profile);
    expect(result.conditions.temperature.direction).toBe("low"); expect(result.conditions.soilPh.direction).toBe("high");
    expect(result.conditions.airHumidity.status).toBe("not_evaluated"); expect(result.conditions.light.status).toBe("not_evaluated");
    expect(result.evaluatedConditions).toBe(2);
  });
  it("does not evaluate binary light outside its window", () => {
    const profile = crop("rice"); profile.light.evaluateNow = false;
    expect(analyzeEnvironment({ temperature: 25, humidity: 70, soilPh: 6, light: 0 }, profile).conditions.light.status).toBe("not_evaluated");
  });
  it("ranks deterministically by matches, evaluated count, then catalog order", () => {
    const snapshot = { temperature: 25, humidity: 70, soilPh: 6, light: 1 };
    const results = compareEnvironmentToCrops(snapshot, [crop("second", 2), crop("first", 1)]);
    expect(results.map((item) => item.cropKey)).toEqual(["second", "first"]);
  });
});
