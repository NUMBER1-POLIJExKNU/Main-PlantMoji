// Pure tests for the event-emotion resolvers (handoff §12). No DB access,
// no timers — both resolvers are synchronous and deterministic.

import { describe, expect, it } from "vitest";
import {
  emotionForBondEvent,
  emotionForMoodChange,
  type EventEmotion,
} from "@/game/emotions/event-emotions";
import { BOND_EVENT_TYPES, type BondEventType } from "@/types/game";

describe("emotionForBondEvent", () => {
  // Exact mapping table over every BondEventType — nothing more, nothing
  // less, so a future BOND_EVENT_TYPES addition can't silently fall through
  // to an unintended emotion (or vice versa).
  const EXPECTED: Record<BondEventType, EventEmotion | null> = {
    QUEST_CREATED: null,
    QUEST_COMPLETED: "Proud",
    QUEST_EXPIRED: null,
    XP_AWARDED: null,
    LEVEL_UP: "Excited",
    STREAK_UPDATED: null,
    BADGE_UNLOCKED: null,
    CHAPTER_UNLOCKED: "Curious",
  };

  it("covers every BondEventType with the exact expected mapping", () => {
    for (const type of BOND_EVENT_TYPES) {
      const result = emotionForBondEvent(type);
      expect(result?.emotion ?? null).toBe(EXPECTED[type]);
    }
  });

  it("has no expectation entries beyond BOND_EVENT_TYPES", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...BOND_EVENT_TYPES].sort());
  });

  it("QUEST_COMPLETED resolves to Proud regardless of data payload", () => {
    expect(emotionForBondEvent("QUEST_COMPLETED", { questKey: "KEEP_ME_HAPPY" })?.emotion).toBe(
      "Proud",
    );
    expect(emotionForBondEvent("QUEST_COMPLETED")?.emotion).toBe("Proud");
  });

  it("LEVEL_UP resolves to Excited", () => {
    expect(emotionForBondEvent("LEVEL_UP")?.emotion).toBe("Excited");
  });

  it("CHAPTER_UNLOCKED resolves to Curious", () => {
    expect(emotionForBondEvent("CHAPTER_UNLOCKED")?.emotion).toBe("Curious");
  });

  it("all other event types resolve to null", () => {
    for (const type of ["QUEST_CREATED", "QUEST_EXPIRED", "XP_AWARDED", "STREAK_UPDATED", "BADGE_UNLOCKED"] as const) {
      expect(emotionForBondEvent(type)).toBeNull();
    }
  });
});

describe("emotionForMoodChange", () => {
  it("Happy → Happy: nothing resolved, no Recovering", () => {
    expect(emotionForMoodChange("Happy", "Happy")).toBeNull();
  });

  it("Overheating → Happy: a problem just resolved → Recovering", () => {
    expect(emotionForMoodChange("Overheating", "Happy")?.emotion).toBe("Recovering");
  });

  it("Overheating → Sleepy: still not Happy, no Recovering", () => {
    expect(emotionForMoodChange("Overheating", "Sleepy")).toBeNull();
  });

  it("null (unknown previous) → Happy: nothing observed to recover from", () => {
    expect(emotionForMoodChange(null, "Happy")).toBeNull();
  });

  it("every problem mood resolving to Happy triggers Recovering", () => {
    const problemMoods = ["Overheating", "DryAir", "Sleepy", "SoilAcidic", "SoilAlkaline"] as const;
    for (const previous of problemMoods) {
      expect(emotionForMoodChange(previous, "Happy")?.emotion).toBe("Recovering");
    }
  });

  it("staying in (or moving between) problem moods never triggers Recovering", () => {
    const problemMoods = ["Overheating", "DryAir", "Sleepy", "SoilAcidic", "SoilAlkaline"] as const;
    for (const previous of problemMoods) {
      for (const current of problemMoods) {
        expect(emotionForMoodChange(previous, current)).toBeNull();
      }
    }
  });
});

describe("EmotionMeta durations", () => {
  it("keeps every emotion's duration within a sane 3000–8000ms display window", () => {
    const emotions: EventEmotion[] = ["Proud", "Excited", "Curious", "Recovering"];
    for (const emotion of emotions) {
      const meta =
        emotion === "Recovering"
          ? emotionForMoodChange("Overheating", "Happy")
          : emotionForBondEvent(
              emotion === "Proud"
                ? "QUEST_COMPLETED"
                : emotion === "Excited"
                  ? "LEVEL_UP"
                  : "CHAPTER_UNLOCKED",
            );
      expect(meta).not.toBeNull();
      expect(meta!.durationMs).toBeGreaterThanOrEqual(3000);
      expect(meta!.durationMs).toBeLessThanOrEqual(8000);
    }
  });

  it("gives every emotion a non-empty emoji and label", () => {
    const metas = [
      emotionForBondEvent("QUEST_COMPLETED"),
      emotionForBondEvent("LEVEL_UP"),
      emotionForBondEvent("CHAPTER_UNLOCKED"),
      emotionForMoodChange("Overheating", "Happy"),
    ];
    for (const meta of metas) {
      expect(meta).not.toBeNull();
      expect(meta!.emoji.trim().length).toBeGreaterThan(0);
      expect(meta!.label.trim().length).toBeGreaterThan(0);
    }
  });
});
