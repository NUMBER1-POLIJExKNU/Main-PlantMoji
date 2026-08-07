import { describe, expect, it } from "vitest";
import {
  BADGE_BONUS_XP,
  CHAPTER_BONUS_XP,
  GROWTH_RECORD_XP,
  MOOD_DISCOVERY_XP,
  STREAK_MILESTONES,
  STREAK_MILESTONE_XP,
  badgeRewardKey,
  chapterRewardKey,
  growthWeekRewardKey,
  isoWeekString,
  milestonesReached,
  moodRewardKey,
  streakMilestoneRewardKey,
} from "@/game/progression/bonus-xp";

describe("bonus XP constants", () => {
  it("are positive integers", () => {
    for (const amount of [
      BADGE_BONUS_XP,
      CHAPTER_BONUS_XP,
      MOOD_DISCOVERY_XP,
      GROWTH_RECORD_XP,
      STREAK_MILESTONE_XP,
    ]) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });

  it("keeps streak milestones strictly ascending", () => {
    expect([...STREAK_MILESTONES]).toEqual([3, 7, 14, 30]);
    for (let i = 1; i < STREAK_MILESTONES.length; i += 1) {
      expect(STREAK_MILESTONES[i]).toBeGreaterThan(STREAK_MILESTONES[i - 1]);
    }
  });
});

describe("reward key builders", () => {
  it("badgeRewardKey", () => {
    expect(badgeRewardKey("plant-01", "FIRST_RESCUE")).toBe("badge:plant-01:FIRST_RESCUE");
  });

  it("chapterRewardKey", () => {
    expect(chapterRewardKey("plant-01", 3)).toBe("chapter:plant-01:3");
  });

  it("moodRewardKey", () => {
    expect(moodRewardKey("plant-01", "Overheating")).toBe("mood:plant-01:Overheating");
  });

  it("streakMilestoneRewardKey", () => {
    expect(streakMilestoneRewardKey("plant-01", 7)).toBe("streak-milestone:plant-01:7");
  });

  it("growthWeekRewardKey", () => {
    expect(growthWeekRewardKey("plant-01", "2026-W32")).toBe("growth:plant-01:2026-W32");
  });

  it("stays unique across plants and values", () => {
    expect(badgeRewardKey("plant-01", "STREAK_7")).not.toBe(
      badgeRewardKey("plant-02", "STREAK_7"),
    );
    expect(streakMilestoneRewardKey("plant-01", 3)).not.toBe(
      streakMilestoneRewardKey("plant-01", 30),
    );
  });
});

describe("isoWeekString", () => {
  it("maps 2026-08-07 (WIB midday) to 2026-W32", () => {
    // 2026-08-07T05:00:00Z + 7h = Friday 2026-08-07 12:00 WIB.
    expect(isoWeekString(new Date("2026-08-07T05:00:00Z"))).toBe("2026-W32");
  });

  it("rolls into the next ISO week exactly at WIB Monday midnight", () => {
    // Sunday 2026-08-09 23:59 WIB — still week 32.
    expect(isoWeekString(new Date("2026-08-09T16:59:00Z"))).toBe("2026-W32");
    // Monday 2026-08-10 00:00 WIB — week 33.
    expect(isoWeekString(new Date("2026-08-09T17:00:00Z"))).toBe("2026-W33");
  });

  it("honors an explicit timeZone override", () => {
    // Same instant: Monday 00:30 in WIB (week 33) but still Sunday in UTC (week 32).
    const instant = new Date("2026-08-09T17:30:00Z");
    expect(isoWeekString(instant)).toBe("2026-W33");
    expect(isoWeekString(instant, "UTC")).toBe("2026-W32");
  });

  it("keeps early January in the previous ISO year when the week's Thursday is old-year", () => {
    // Thursday 2026-12-31 WIB → the year has 53 ISO weeks.
    expect(isoWeekString(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
    // Friday 2027-01-01 WIB shares that Thursday's week → still 2026-W53.
    expect(isoWeekString(new Date("2027-01-01T05:00:00Z"))).toBe("2026-W53");
    // Monday 2027-01-04 00:59 WIB starts 2027's week 1.
    expect(isoWeekString(new Date("2027-01-03T18:00:00Z"))).toBe("2027-W01");
  });

  it("pushes late December into next year's W01 when the week's Thursday is new-year", () => {
    // Monday 2024-12-30 WIB — its Thursday is 2025-01-02.
    expect(isoWeekString(new Date("2024-12-30T05:00:00Z"))).toBe("2025-W01");
  });
});

describe("milestonesReached", () => {
  it("returns nothing when no milestone is crossed", () => {
    expect(milestonesReached(0, 1)).toEqual([]);
    expect(milestonesReached(3, 3)).toEqual([]);
    expect(milestonesReached(30, 31)).toEqual([]);
  });

  it("returns exactly the newly crossed milestone", () => {
    expect(milestonesReached(2, 3)).toEqual([3]);
    expect(milestonesReached(6, 7)).toEqual([7]);
    expect(milestonesReached(29, 30)).toEqual([30]);
  });

  it("returns every milestone in a multi-day jump", () => {
    expect(milestonesReached(0, 7)).toEqual([3, 7]);
    expect(milestonesReached(0, 30)).toEqual([3, 7, 14, 30]);
    expect(milestonesReached(5, 20)).toEqual([7, 14]);
  });

  it("with previous 0 lists everything reached — the self-healing sweep input", () => {
    expect(milestonesReached(0, 14)).toEqual([3, 7, 14]);
  });
});
