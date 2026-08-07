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
    name: "First Rescue",
    description: "Completed a recovery quest for the first time.",
    emoji: "🚑",
  },
  LIGHT_MASTER: {
    key: "LIGHT_MASTER",
    name: "Light Master",
    description: "Completed the Give Me More Light quest 5 times.",
    emoji: "☀️",
  },
  LEVEL_5_BOND: {
    key: "LEVEL_5_BOND",
    name: "Level 5 Bond",
    description: "Reached Bond Level 5 together.",
    emoji: "💚",
  },
  COOL_KEEPER: {
    key: "COOL_KEEPER",
    name: "Cool Keeper",
    description: "Completed the Cool Me Down quest 5 times.",
    emoji: "🧊",
  },
  PH_GUARDIAN: {
    key: "PH_GUARDIAN",
    name: "pH Guardian",
    description: "Kept the soil pH healthy for the last 7 days straight.",
    emoji: "🛡️",
  },
  STREAK_7: {
    key: "STREAK_7",
    name: "7 Days Care Streak",
    description: "Reached a 7-day care streak.",
    emoji: "📅",
  },
};
