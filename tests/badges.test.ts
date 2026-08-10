// Pure tests for the badge definitions (handoff §18). No DB access — the
// engine's live-state conditions are exercised only against a real Supabase
// project, not mocked here.

import { describe, expect, it } from "vitest";
import { BADGE_DEFINITIONS, RECOVERY_QUEST_KEYS } from "@/game/badges/badge-definitions";
import { BADGE_KEYS } from "@/types/game";

describe("BADGE_DEFINITIONS", () => {
  it("has an entry for every BADGE_KEYS member", () => {
    for (const key of BADGE_KEYS) {
      expect(BADGE_DEFINITIONS[key]).toBeDefined();
    }
  });

  it("has no extra keys beyond BADGE_KEYS", () => {
    expect(Object.keys(BADGE_DEFINITIONS).sort()).toEqual([...BADGE_KEYS].sort());
  });

  it("keys every definition's `key` field to match its record key", () => {
    for (const key of BADGE_KEYS) {
      expect(BADGE_DEFINITIONS[key].key).toBe(key);
    }
  });

  it("gives every badge a non-empty name, description, and emoji", () => {
    for (const key of BADGE_KEYS) {
      const definition = BADGE_DEFINITIONS[key];
      expect(definition.name.trim().length).toBeGreaterThan(0);
      expect(definition.description.trim().length).toBeGreaterThan(0);
      expect(definition.emoji.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("RECOVERY_QUEST_KEYS", () => {
  it("excludes KEEP_ME_HAPPY (a maintenance quest, not a recovery quest)", () => {
    expect(RECOVERY_QUEST_KEYS).not.toContain("KEEP_ME_HAPPY");
  });

  it("includes COOL_ME_DOWN and GIVE_ME_MORE_LIGHT", () => {
    expect(RECOVERY_QUEST_KEYS).toContain("COOL_ME_DOWN");
    expect(RECOVERY_QUEST_KEYS).toContain("GIVE_ME_MORE_LIGHT");
  });

  it("excludes HUMIDIFY_MY_AIR (tracked by HUMIDITY_HERO, not a recovery quest)", () => {
    expect(RECOVERY_QUEST_KEYS).not.toContain("HUMIDIFY_MY_AIR");
  });
});

describe("BADGE_DEFINITIONS — Phase 12 badges", () => {
  it("defines HUMIDITY_HERO", () => {
    expect(BADGE_DEFINITIONS.HUMIDITY_HERO).toEqual({
      key: "HUMIDITY_HERO",
      name: "Air Helper",
      description: "Helped dry air feel better 5 times.",
      emoji: "💦",
    });
  });

  it("defines MOOD_SCHOLAR", () => {
    expect(BADGE_DEFINITIONS.MOOD_SCHOLAR).toEqual({
      key: "MOOD_SCHOLAR",
      name: "Mood Finder",
      description: "Found all 8 plant moods.",
      emoji: "🎓",
    });
  });

  it("defines CARE_VETERAN", () => {
    expect(BADGE_DEFINITIONS.CARE_VETERAN).toEqual({
      key: "CARE_VETERAN",
      name: "Quest Star",
      description: "Finished 25 quests.",
      emoji: "🎖️",
    });
  });

  it("defines CHRONICLER", () => {
    expect(BADGE_DEFINITIONS.CHRONICLER).toEqual({
      key: "CHRONICLER",
      name: "Plant Writer",
      description: "Wrote 5 plant growth notes.",
      emoji: "📓",
    });
  });

  it("defines STREAK_30", () => {
    expect(BADGE_DEFINITIONS.STREAK_30).toEqual({
      key: "STREAK_30",
      name: "30-Day Care",
      description: "Cared for the plant 30 days in a row.",
      emoji: "🗓️",
    });
  });

  it("defines LEVEL_10_BOND", () => {
    expect(BADGE_DEFINITIONS.LEVEL_10_BOND).toEqual({
      key: "LEVEL_10_BOND",
      name: "Best Friends",
      description: "Reached friendship level 10.",
      emoji: "🌳",
    });
  });
});
