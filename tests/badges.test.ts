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
});
