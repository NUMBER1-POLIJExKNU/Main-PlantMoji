// LeafTalk quest catalog (handoff §16 — MVP quests, Phase 6).
//
// Two quest kinds:
//   * 'maintain'  — hold the trigger mood continuously for requiredSeconds
//                   (Keep Me Happy: Happy for 30 minutes).
//   * 'recovery'  — the trigger mood starts the quest; leaving it begins a
//                   VERIFYING window of requiredSeconds that must pass without
//                   relapse before completion (handoff §17: reward verified
//                   outcomes, never one good sample).

import type { PlantMood } from "@/types/events";
import type { QuestKey } from "@/types/game";

export type QuestKind = "maintain" | "recovery";

export interface QuestDefinition {
  key: QuestKey;
  title: string;
  description: string;
  emoji: string;
  xpReward: number;
  kind: QuestKind;
  /** Mood that starts this quest when the plant enters it. */
  triggerMood: PlantMood;
  /** maintain: hold duration. recovery: verification stability window. */
  requiredSeconds: number;
  /**
   * recovery only: when an event carries data.temperature above this value,
   * the underlying problem is NOT fixed even if another mood outranks the
   * trigger — verification must not start / must relapse (handoff §16:
   * "temperature <= 30°C and remains stable").
   */
  verifyTemperatureMax?: number;
  /**
   * recovery only: when an event carries data.soilPH outside [min, max], the
   * soil is NOT balanced even if another mood outranks the trigger —
   * verification must not start / must relapse (handoff §16: "calibrated pH
   * returns to normal range and remains stable").
   */
  verifyPhRange?: { min: number; max: number };
}

export const QUEST_DEFINITIONS: Record<QuestKey, QuestDefinition> = {
  KEEP_ME_HAPPY: {
    key: "KEEP_ME_HAPPY",
    title: "Keep Me Happy",
    description: "Keep me feeling great for 30 minutes straight.",
    emoji: "🌱",
    xpReward: 20,
    kind: "maintain",
    triggerMood: "Happy",
    requiredSeconds: 1800,
  },
  COOL_ME_DOWN: {
    key: "COOL_ME_DOWN",
    title: "Cool Me Down",
    description:
      "I'm overheating! Cool my air down and keep it stable for 5 minutes.",
    emoji: "❄️",
    xpReward: 30,
    kind: "recovery",
    triggerMood: "Overheating",
    requiredSeconds: 300,
    verifyTemperatureMax: 30,
  },
  GIVE_ME_MORE_LIGHT: {
    key: "GIVE_ME_MORE_LIGHT",
    title: "Give Me More Light",
    description:
      "It's too dark and I'm getting sleepy. Bring back the light and keep it steady for 5 minutes.",
    emoji: "☀️",
    xpReward: 20,
    kind: "recovery",
    triggerMood: "Sleepy",
    requiredSeconds: 300,
  },
  // Soil quests coach gentle, everyday care only — NEVER chemical dosing
  // (handoff §16: "Do not have AI prescribe dangerous chemical dosing").
  BALANCE_SOIL_ACIDIC: {
    key: "BALANCE_SOIL_ACIDIC",
    title: "Balance My Soil",
    description:
      "My soil feels too sour. Try a gentle rinse with plain water or mix in some fresh potting soil, then keep me steady for 5 minutes.",
    emoji: "🧪",
    xpReward: 25,
    kind: "recovery",
    triggerMood: "SoilAcidic",
    requiredSeconds: 300,
    verifyPhRange: { min: 6.0, max: 7.0 },
  },
  BALANCE_SOIL_ALKALINE: {
    key: "BALANCE_SOIL_ALKALINE",
    title: "Balance My Soil",
    description:
      "My soil feels too chalky. Try a gentle rinse with plain water or mix in some fresh potting soil, then keep me steady for 5 minutes.",
    emoji: "🧪",
    xpReward: 25,
    kind: "recovery",
    triggerMood: "SoilAlkaline",
    requiredSeconds: 300,
    verifyPhRange: { min: 6.0, max: 7.0 },
  },
};

/** All quest definitions whose trigger mood matches `mood`. */
export function questsTriggeredBy(mood: PlantMood): QuestDefinition[] {
  return Object.values(QUEST_DEFINITIONS).filter(
    (definition) => definition.triggerMood === mood,
  );
}
