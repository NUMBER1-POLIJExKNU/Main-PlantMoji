import { describe, expect, it } from "vitest";
import { MAX_BOND_LEVEL, XP_PER_LEVEL, levelForXp, normalizePersonality } from "@/types/game";

describe("levelForXp", () => {
  it("maps 0-14 total XP to level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(XP_PER_LEVEL - 1)).toBe(1);
  });

  it("maps 15-29 total XP to level 2", () => {
    expect(levelForXp(XP_PER_LEVEL)).toBe(2);
    expect(levelForXp(XP_PER_LEVEL * 2 - 1)).toBe(2);
  });

  it("maps 30 total XP to level 3", () => {
    expect(levelForXp(XP_PER_LEVEL * 2)).toBe(3);
  });

  it("stops at the cap, however much XP arrives", () => {
    const capXp = (MAX_BOND_LEVEL - 1) * XP_PER_LEVEL;
    expect(levelForXp(capXp)).toBe(MAX_BOND_LEVEL);
    expect(levelForXp(capXp + XP_PER_LEVEL * 100)).toBe(MAX_BOND_LEVEL);
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
