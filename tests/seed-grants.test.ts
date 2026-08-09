import { describe, expect, it } from "vitest";
import {
  SEED_GRANTS,
  seedBadgeRewardKey,
  seedChapterRewardKey,
  seedQuestRewardKey,
  seedQuizRewardKey,
  seedStreakDayRewardKey,
} from "@/game/economy/seed-grants";

describe("SEED_GRANTS", () => {
  it("matches the spec amounts exactly (deterministic, sensor-truth events only)", () => {
    expect(SEED_GRANTS).toEqual({
      questCompleted: 3,
      badgeUnlocked: 5,
      chapterUnlocked: 10,
      quizCorrect: 1,
      streakDay: 1,
    });
  });
});

describe("seed reward keys", () => {
  it("are deterministic and namespaced under seed: so they can never collide with xp_rewards keys", () => {
    expect(seedQuestRewardKey("q-1")).toBe("seed:quest:q-1");
    expect(seedBadgeRewardKey("plant-01", "FIRST_RESCUE")).toBe("seed:badge:plant-01:FIRST_RESCUE");
    expect(seedChapterRewardKey("plant-01", 2)).toBe("seed:chapter:plant-01:2");
    expect(seedStreakDayRewardKey("plant-01", "2026-08-09")).toBe("seed:day:plant-01:2026-08-09");
    expect(seedQuizRewardKey("plant-01", "2026-08-09", 0, "temp-basics")).toBe(
      "seed:quiz:plant-01:2026-08-09:0:temp-basics",
    );
  });

  it("produces distinct keys per source for the same plant", () => {
    const keys = [
      seedQuestRewardKey("x"),
      seedBadgeRewardKey("p", "x"),
      seedChapterRewardKey("p", 1),
      seedStreakDayRewardKey("p", "2026-01-01"),
      seedQuizRewardKey("p", "2026-01-01", 0, "x"),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
