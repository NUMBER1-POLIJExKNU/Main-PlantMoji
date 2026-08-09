import { describe, expect, it } from "vitest";
import {
  DEMO_MAX_LEVEL,
  DEMO_MAX_STREAK,
  DEMO_MAX_XP,
  buildDemoMaxSeed,
} from "@/game/demo/demo-max";
import { PLANT_MOODS } from "@/types/events";
import { BADGE_KEYS, COMPANION_STAGES, QUEST_KEYS } from "@/types/game";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";

const NOW = new Date("2026-08-07T12:00:00+07:00");

describe("demo max seed", () => {
  it("targets the highest currently shipped content level", () => {
    expect(DEMO_MAX_LEVEL).toBe(10);
    expect(DEMO_MAX_XP).toBe(299);
    expect(DEMO_MAX_STREAK).toBe(30);
  });

  it("unlocks every mood, badge, story, and quest type", () => {
    const seed = buildDemoMaxSeed("plant-01", NOW);

    expect(seed.moodEventRows.map((row) => row.data.currentState)).toEqual([...PLANT_MOODS]);
    expect(seed.badgeRows.map((row) => row.badge_key)).toEqual([...BADGE_KEYS]);
    expect(seed.questRows.map((row) => row.quest_key)).toEqual([...QUEST_KEYS]);
    expect(seed.questRows.every((row) => row.status === "COMPLETED")).toBe(true);
    expect(seed.companionEvolutionRows.map((row) => row.stage)).toEqual(["Sprout", "Seedling", "Bud", "Bloom", "Fruit", "Guardian", "Elder", "Radiant", "Legend"]);
    // Demo-max lands on the TOP of the ladder, derived — never hardcoded.
    expect(seed.companionEvolutionRows.at(-1)?.stage).toBe(COMPANION_STAGES[COMPANION_STAGES.length - 1]);
    expect(
      seed.bondEventRows.filter((row) => row.type === "CHAPTER_UNLOCKED"),
    ).toHaveLength(CHAPTER_DEFINITIONS.length);
  });

  it("represents exactly the displayed max XP in the reward ledger", () => {
    const seed = buildDemoMaxSeed("plant-01", NOW);
    expect(seed.xpRewardRows.reduce((sum, row) => sum + row.amount, 0)).toBe(DEMO_MAX_XP);
    expect(new Set(seed.xpRewardRows.map((row) => row.reward_key)).size).toBe(
      seed.xpRewardRows.length,
    );
  });

  it("uses stable ids so retrying the code is safe", () => {
    const first = buildDemoMaxSeed("plant-01", NOW);
    const replay = buildDemoMaxSeed("plant-01", NOW);

    expect(replay.questRows.map((row) => row.id)).toEqual(first.questRows.map((row) => row.id));
    expect(replay.moodEventRows.map((row) => row.event_id)).toEqual(
      first.moodEventRows.map((row) => row.event_id),
    );
  });
});
