// Pure tests for the educational layer (handoff §2, §51): why-cards must
// cover every mood and quest, and farmer wisdom must stay honest — generic
// placeholder heuristics only, until the §43 Jember interviews happen.

import { describe, expect, it } from "vitest";
import { FARMER_WISDOM } from "@/game/education/farmer-wisdom";
import { QUEST_WHY, WHY_CARDS } from "@/game/education/why-cards";
import { PLANT_MOODS } from "@/types/events";
import { QUEST_KEYS } from "@/types/game";

describe("WHY_CARDS", () => {
  it("has an entry for every PLANT_MOODS member", () => {
    for (const mood of PLANT_MOODS) {
      expect(WHY_CARDS[mood]).toBeDefined();
    }
  });

  it("has no extra keys beyond PLANT_MOODS", () => {
    expect(Object.keys(WHY_CARDS).sort()).toEqual([...PLANT_MOODS].sort());
  });

  it("gives every card a non-empty title, why, and action", () => {
    for (const mood of PLANT_MOODS) {
      const card = WHY_CARDS[mood];
      expect(card.title.trim().length).toBeGreaterThan(0);
      expect(card.why.trim().length).toBeGreaterThan(0);
      expect(card.action.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("QUEST_WHY", () => {
  it("has a non-empty sentence for every QUEST_KEYS member", () => {
    for (const key of QUEST_KEYS) {
      expect(QUEST_WHY[key]).toBeDefined();
      expect(QUEST_WHY[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("has no extra keys beyond QUEST_KEYS", () => {
    expect(Object.keys(QUEST_WHY).sort()).toEqual([...QUEST_KEYS].sort());
  });
});

describe("FARMER_WISDOM", () => {
  it("has at least four entries", () => {
    expect(FARMER_WISDOM.length).toBeGreaterThanOrEqual(4);
  });

  it("gives every entry non-empty fields", () => {
    for (const entry of FARMER_WISDOM) {
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(entry.saying.trim().length).toBeGreaterThan(0);
      expect(entry.source.trim().length).toBeGreaterThan(0);
      expect(entry.translation.trim().length).toBeGreaterThan(0);
      expect(entry.sensorLink.metric.trim().length).toBeGreaterThan(0);
      expect(entry.sensorLink.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses a unique id per entry", () => {
    const ids = FARMER_WISDOM.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks every source as placeholder until the §43 interviews happen", () => {
    for (const entry of FARMER_WISDOM) {
      expect(entry.source).toContain("to be replaced");
    }
  });

  it("never attributes a saying to a named person (integrity rule)", () => {
    // Honorific/title followed by a capitalized name — the shape a fabricated
    // attribution would take ("Pak Slamet", "Mr. Budi", ...).
    const personalName = /\b(?:Pak|Bu|Ibu|Bapak|Mas|Mbak|Mr|Mrs|Ms|Dr|Farmer)\.?\s+[A-Z][a-z]/;
    for (const entry of FARMER_WISDOM) {
      for (const text of [entry.saying, entry.source, entry.translation]) {
        expect(text).not.toMatch(personalName);
      }
    }
  });

  it("links every entry's mood (when set) to a real PlantMood", () => {
    for (const entry of FARMER_WISDOM) {
      if (entry.sensorLink.mood !== undefined) {
        expect(PLANT_MOODS).toContain(entry.sensorLink.mood);
      }
    }
  });
});
