// Badge definitions — Phase 11 MVP set (handoff §18).
// Static content lives in TypeScript during MVP (handoff §26); unlock state
// is persisted in the `plant_badges` table.

import type { BadgeDefinition, BadgeKey, QuestKey } from "@/types/game";

/**
 * Quest keys that count as "recovery" quests — the plant was in a bad state
 * (Overheating / Sleepy) and the caretaker fixed it. KEEP_ME_HAPPY is a
 * maintenance quest and does not count.
 */
export const RECOVERY_QUEST_KEYS: readonly QuestKey[] = [
  "COOL_ME_DOWN",
  "GIVE_ME_MORE_LIGHT",
];

export const BADGE_DEFINITIONS: Record<BadgeKey, BadgeDefinition> = {
  FIRST_RESCUE: {
    key: "FIRST_RESCUE",
    name: "First Help",
    description: "Helped the plant feel better for the first time.",
    emoji: "🚑",
  },
  LIGHT_MASTER: {
    key: "LIGHT_MASTER",
    name: "Light Helper",
    description: "Finished 5 light quests.",
    emoji: "☀️",
  },
  LEVEL_5_BOND: {
    key: "LEVEL_5_BOND",
    name: "Good Friends",
    description: "Reached friendship level 5.",
    emoji: "💚",
  },
  COOL_KEEPER: {
    key: "COOL_KEEPER",
    name: "Cool Helper",
    description: "Finished 5 cool-down quests.",
    emoji: "🧊",
  },
  PH_GUARDIAN: {
    key: "PH_GUARDIAN",
    name: "Happy Soil",
    description: "Kept the soil healthy for 7 days.",
    emoji: "🛡️",
  },
  STREAK_7: {
    key: "STREAK_7",
    name: "7-Day Care",
    description: "Cared for the plant 7 days in a row.",
    emoji: "📅",
  },
  HUMIDITY_HERO: {
    key: "HUMIDITY_HERO",
    name: "Air Helper",
    description: "Helped dry air feel better 5 times.",
    emoji: "💦",
  },
  MOOD_SCHOLAR: {
    key: "MOOD_SCHOLAR",
    name: "Mood Finder",
    description: "Found all 8 plant moods.",
    emoji: "🎓",
  },
  CARE_VETERAN: {
    key: "CARE_VETERAN",
    name: "Quest Star",
    description: "Finished 25 quests.",
    emoji: "🎖️",
  },
  CHRONICLER: {
    key: "CHRONICLER",
    name: "Plant Writer",
    description: "Wrote 5 plant growth notes.",
    emoji: "📓",
  },
  STREAK_30: {
    key: "STREAK_30",
    name: "30-Day Care",
    description: "Cared for the plant 30 days in a row.",
    emoji: "🗓️",
  },
  LEVEL_10_BOND: {
    key: "LEVEL_10_BOND",
    name: "Best Friends",
    description: "Reached friendship level 10.",
    emoji: "🌳",
  },
};
