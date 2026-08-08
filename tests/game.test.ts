import { describe, expect, it } from "vitest";
import { levelForXp, normalizePersonality } from "@/types/game";

describe("levelForXp", () => {
  it("maps 0-29 total XP to level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(29)).toBe(1);
  });

  it("maps 30-59 total XP to level 2", () => {
    expect(levelForXp(30)).toBe(2);
    expect(levelForXp(59)).toBe(2);
  });

  it("maps 60 total XP to level 3", () => {
    expect(levelForXp(60)).toBe(3);
  });
});

describe("normalizePersonality", () => {
  it("accepts each canonical personality id unchanged", () => {
    expect(normalizePersonality("cute")).toBe("cute");
    expect(normalizePersonality("calm")).toBe("calm");
    expect(normalizePersonality("funny")).toBe("funny");
    expect(normalizePersonality("energetic")).toBe("energetic");
    expect(normalizePersonality("shy")).toBe("shy");
  });

  it("trims whitespace and lowercases before matching", () => {
    expect(normalizePersonality("  Cute  ")).toBe("cute");
    expect(normalizePersonality("ENERGETIC")).toBe("energetic");
  });

  it("falls back to 'cute' for unknown strings", () => {
    expect(normalizePersonality("dragon")).toBe("cute");
    expect(normalizePersonality("")).toBe("cute");
  });

  it("falls back to 'cute' for non-string values", () => {
    expect(normalizePersonality(undefined)).toBe("cute");
    expect(normalizePersonality(null)).toBe("cute");
    expect(normalizePersonality(42)).toBe("cute");
    expect(normalizePersonality({})).toBe("cute");
  });
});
