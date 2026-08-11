import { describe, expect, it } from "vitest";
import { sprinkleJamkachuEmoji } from "@/lib/jamkachu-emoji";

describe("Jamkachu dialogue emoji", () => {
  it("adds mood-safe emoji occasionally and deterministically", () => {
    const outputs = Array.from({ length: 18 }, (_, index) => sprinkleJamkachuEmoji("I am growing with you!", "Happy", String(index)));
    expect(new Set(outputs).size).toBeGreaterThan(1);
    expect(outputs.some((line) => /[🌱💚✨]/u.test(line))).toBe(true);
    expect(sprinkleJamkachuEmoji("I am growing with you!", "Happy", "same")).toBe(sprinkleJamkachuEmoji("I am growing with you!", "Happy", "same"));
  });

  it("never invents an emoji for an empty line or duplicates an existing one", () => {
    expect(sprinkleJamkachuEmoji("", "Sleepy", "x")).toBe("");
    const line = "Good night 🌙";
    expect((sprinkleJamkachuEmoji(line, "Sleepy", "x").match(/🌙/gu) ?? [])).toHaveLength(1);
  });

  it("covers both temperature and humidity extremes", () => {
    expect(() => sprinkleJamkachuEmoji("It feels chilly.", "TooCold", "cold")).not.toThrow();
    expect(() => sprinkleJamkachuEmoji("The air feels humid.", "HumidAir", "humid")).not.toThrow();
  });
});
