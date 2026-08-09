import { describe, expect, it } from "vitest";
import { JAMKACHU_CONTEXT_DIALOGUE, JAMKACHU_DIALOGUE, JAMKACHU_DIALOGUE_COUNT, JAMKACHU_EVENT_DIALOGUE, JAMKACHU_TOTAL_DIALOGUE_COUNT, dialogueCandidates, dialogueForMood, personalityDialogueCandidates } from "@/game/personality/dialogue-bank";
import { PLANT_MOODS } from "@/types/events";

describe("Jamkachu dialogue bank", () => {
  it("contains exactly 300 unique, mood-balanced lines", () => {
    const all = Object.values(JAMKACHU_DIALOGUE).flat();
    expect(JAMKACHU_DIALOGUE_COUNT).toBe(300);
    expect(new Set(all).size).toBe(300);
    for (const mood of PLANT_MOODS) expect(JAMKACHU_DIALOGUE[mood]).toHaveLength(50);
  });

  it("provides the 1,800-line composition across the 10-stage ladder", () => {
    // 6 moods × 10 companion stages × 2 time contexts × 10 observations.
    expect(JAMKACHU_CONTEXT_DIALOGUE).toHaveLength(1200);
    expect(Object.values(JAMKACHU_EVENT_DIALOGUE).flat()).toHaveLength(300);
    expect(JAMKACHU_TOTAL_DIALOGUE_COUNT).toBe(1800);
    expect(new Set([...Object.values(JAMKACHU_DIALOGUE).flat(), ...JAMKACHU_CONTEXT_DIALOGUE, ...Object.values(JAMKACHU_EVENT_DIALOGUE).flat()]).size).toBe(1800);
  });

  it("speaks contextual lines for the new ladder stages", () => {
    for (const stage of ["Seedling", "Fruit", "Elder", "Radiant", "Legend"]) {
      expect(JAMKACHU_CONTEXT_DIALOGUE.some((line) => line.includes(`as a ${stage} companion`))).toBe(true);
    }
    expect(new Set(dialogueCandidates("Happy", "Legend", "later", "entry", 24)).size).toBeGreaterThan(20);
  });

  it("offers enough alternatives to avoid a recent-20 history", () => {
    expect(new Set(dialogueCandidates("Happy", "Bloom", "morning", "entry", 24)).size).toBeGreaterThan(20);
  });

  it("selects a stable line for the same mood entry", () => {
    expect(dialogueForMood("Happy", "entry-1")).toBe(dialogueForMood("Happy", "entry-1"));
  });

  it("gives every personality 20+ distinct localized lines and distinct voices", () => {
    const personalities = ["cute", "calm", "funny", "energetic", "shy"] as const;
    for (const locale of ["id", "en"] as const) {
      const firstLines = personalities.map((personality) => {
        const lines = personalityDialogueCandidates(personality, "Overheating", locale, "same", 24);
        expect(new Set(lines).size).toBeGreaterThan(20);
        return lines[0];
      });
      expect(new Set(firstLines).size).toBe(personalities.length);
    }
  });

  it("never gives unsupported watering, fertiliser, or chemical doses", () => {
    const copy = Object.values(JAMKACHU_DIALOGUE).flat().join(" ").toLowerCase();
    expect(copy).not.toMatch(/water me|fertili[sz]er|\b\d+\s*(ml|gram|g)\b/);
  });
});
