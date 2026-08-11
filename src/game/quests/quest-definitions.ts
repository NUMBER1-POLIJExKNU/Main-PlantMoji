// LeafTalk quest catalog (handoff §16 — MVP quests, Phase 6).
//
// Two quest kinds:
//   * 'maintain'  — hold the trigger mood continuously for requiredSeconds
//                   (Keep Me Happy: Happy for 30 minutes; Stay Comfy: Happy
//                   for 2 hours — both run side by side, the partial unique
//                   index on quests is per key).
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
   * recovery only: mirror of verifyTemperatureMax for the cold band. When an
   * event carries data.temperature below the profile's cold recover point, the
   * air is still too cold even if another mood outranks the trigger —
   * verification must not start / must relapse (Warm Me Up).
   */
  verifyTemperatureMin?: number;
  /**
   * recovery only: when an event carries data.soilPH outside [min, max], the
   * soil is NOT balanced even if another mood outranks the trigger —
   * verification must not start / must relapse (handoff §16: "calibrated pH
   * returns to normal range and remains stable").
   */
  verifyPhRange?: { min: number; max: number };
  /**
   * recovery only: when an event carries data.humidity below this value, the
   * AIR is still too dry even if another mood outranks the trigger —
   * verification must not start / must relapse (handoff §5.2 dry-air
   * hysteresis: dry OFF at >= 45% air humidity).
   */
  verifyHumidityMin?: number;
  /**
   * recovery only: mirror of verifyHumidityMin for the humid band. When an
   * event carries data.humidity above the profile's humid-air recover point,
   * the AIR is still too humid even if another mood outranks the trigger —
   * verification must not start / must relapse (Dehumidify My Air).
   */
  verifyHumidityMax?: number;
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
  STAY_COMFY: {
    key: "STAY_COMFY",
    title: "Stay Comfy",
    description: "Keep me in my comfort zone for two hours straight.",
    emoji: "🛋️",
    xpReward: 40,
    kind: "maintain",
    triggerMood: "Happy",
    requiredSeconds: 7200,
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
    verifyTemperatureMax: 26,
  },
  WARM_ME_UP: {
    key: "WARM_ME_UP",
    title: "Warm Me Up",
    description:
      "Brr — I'm too cold! Warm my air gently and keep it stable for 5 minutes. Move me somewhere warmer or away from cold drafts.",
    emoji: "🧣",
    xpReward: 30,
    kind: "recovery",
    triggerMood: "TooCold",
    requiredSeconds: 300,
    verifyTemperatureMin: 16,
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
  // DryAir is about AIR humidity, never soil moisture (handoff §3: DHT11
  // measures air humidity — never coach watering the soil for this mood).
  HUMIDIFY_MY_AIR: {
    key: "HUMIDIFY_MY_AIR",
    title: "Humidify My Air",
    description:
      "The AIR around my leaves is too dry — my soil is fine, so please don't water it. Mist the air gently or move me away from heaters and drafts, then keep it steady for 5 minutes.",
    emoji: "💦",
    xpReward: 20,
    kind: "recovery",
    triggerMood: "DryAir",
    requiredSeconds: 300,
    verifyHumidityMin: 45,
  },
  // DehumidifyMyAir is the AIR-humidity opposite of Humidify My Air — again
  // never about the soil (handoff §3: the DHT11 measures air humidity).
  DEHUMIDIFY_MY_AIR: {
    key: "DEHUMIDIFY_MY_AIR",
    title: "Dry My Air",
    description:
      "The AIR around my leaves is too humid — my soil is fine, so please don't change its water. Improve airflow, open a window, or move me away from steam and misting, then keep it steady for 5 minutes.",
    emoji: "🌬️",
    xpReward: 20,
    kind: "recovery",
    triggerMood: "HumidAir",
    requiredSeconds: 300,
    verifyHumidityMax: 55,
  },
  // Soil quests coach gentle, everyday care only — NEVER chemical dosing
  // (handoff §16: "Do not have AI prescribe dangerous chemical dosing").
  BALANCE_SOIL_ACIDIC: {
    key: "BALANCE_SOIL_ACIDIC",
    title: "Balance My Soil",
    description:
      "My soil feels too sour. Sprinkle a little wood ash or mix in some fresh potting soil, then keep me steady for 5 minutes.",
    emoji: "🧪",
    xpReward: 25,
    kind: "recovery",
    triggerMood: "SoilAcidic",
    requiredSeconds: 300,
    verifyPhRange: { min: 5.5, max: 6.5 },
  },
  BALANCE_SOIL_ALKALINE: {
    key: "BALANCE_SOIL_ALKALINE",
    title: "Balance My Soil",
    description:
      "My soil feels too chalky. Rinse it gently with plain water or mix in some leaf mould, then keep me steady for 5 minutes.",
    emoji: "🧪",
    xpReward: 25,
    kind: "recovery",
    triggerMood: "SoilAlkaline",
    requiredSeconds: 300,
    verifyPhRange: { min: 5.5, max: 6.5 },
  },
};

/** All quest definitions whose trigger mood matches `mood`. */
export function questsTriggeredBy(mood: PlantMood): QuestDefinition[] {
  return Object.values(QUEST_DEFINITIONS).filter(
    (definition) => definition.triggerMood === mood,
  );
}
