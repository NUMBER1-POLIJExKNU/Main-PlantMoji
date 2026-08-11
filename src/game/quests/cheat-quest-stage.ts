// Which stage the HERO MISSION card shows while the classroom sandbox is on.
//
// The quest cards render from Supabase, so in the sandbox they sat frozen at
// ACT: the cheat board wrote stage numbers to localStorage that nothing read,
// and the real state machine can only advance on hardware readings that a demo
// never produces. Two ways forward, and a presenter gets both:
//
//   * force it — the board jumps a quest to any stage outright, and
//   * earn it — fix the problem in the sensor editor and the quest moves the
//     way it would for a real plant.
//
// The "earn it" half asks sensorBlocksRecovery, the same predicate the engine
// uses, so the demo cannot teach a rule the product does not follow. It stops
// at VERIFY rather than handing out REWARD: on real hardware the reward is
// gated on the reading HOLDING, and collapsing that into the moment of the fix
// would sell "tap-to-win", which is exactly what this quest design refuses.
// REWARD stays reachable, but only by deliberately forcing it on the board.

import { getCropProfile, type CropProfile } from "@/lib/crop-profiles";
import { QUEST_DEFINITIONS } from "./quest-definitions";
import { sensorBlocksRecovery } from "./sensor-recovery";
import type { QuestKey } from "@/types/game";

/** SENSE, ACT, VERIFY, REWARD. A "stage" is how many are lit, so 1..4, and
 *  the index of the CURRENT step is stage - 1. */
export const QUEST_STAGE_COUNT = 4;
export const STAGE_SENSE = 1;
export const STAGE_ACT = 2;
export const STAGE_VERIFY = 3;
export const STAGE_REWARD = 4;

export interface CheatSensorValues {
  temperature: number;
  humidity: number;
  light: number;
  soilPh: number;
}

/** The engine reads `soilPH`; the sandbox store spells it `soilPh`. */
export function toSensorData(vitals: CheatSensorValues): Record<string, unknown> {
  return {
    temperature: vitals.temperature,
    humidity: vitals.humidity,
    light: vitals.light,
    soilPH: vitals.soilPh,
  };
}

/** Stage the live quest row alone justifies: VERIFYING lights VERIFY, anything
 *  else leaves the player on ACT. Mirrors the card's own real-data rule. */
export function stageFromQuestStatus(status: string | null | undefined): number {
  return status === "VERIFYING" ? STAGE_VERIFY : STAGE_ACT;
}

/**
 * Stage the sandbox sensors have earned, or 0 when they have nothing to say.
 * Only recovery quests have a sensor-verifiable goal — a maintain quest like
 * Keep Me Happy is about elapsed time, which no sensor edit can fast-forward,
 * so those are left to the board.
 */
export function stageFromSensors(
  key: QuestKey,
  vitals: CheatSensorValues,
  profile: CropProfile = getCropProfile(null),
): number {
  const def = QUEST_DEFINITIONS[key];
  if (!def || def.kind !== "recovery") return 0;
  return sensorBlocksRecovery(def, toSensorData(vitals), profile) ? STAGE_ACT : STAGE_VERIFY;
}

/** Stage the presenter pinned on the board, or 0 when untouched. */
export function stageFromBoard(quests: Record<string, unknown> | undefined, key: QuestKey): number {
  const raw = Number(quests?.[key]);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(QUEST_STAGE_COUNT, Math.max(0, Math.round(raw)));
}

/**
 * The stage to paint. Takes the furthest of the three sources so neither way
 * of advancing can walk the card backwards mid-demo — a presenter who forces
 * REWARD keeps it while nudging sensors, and fixing the soil still moves a
 * card the board never touched.
 */
export function cheatQuestStage(input: {
  key: QuestKey;
  questStatus?: string | null;
  quests?: Record<string, unknown>;
  vitals?: CheatSensorValues | null;
  profile?: CropProfile;
}): number {
  const stages = [
    stageFromQuestStatus(input.questStatus),
    stageFromBoard(input.quests, input.key),
    input.vitals ? stageFromSensors(input.key, input.vitals, input.profile) : 0,
  ];
  return Math.min(QUEST_STAGE_COUNT, Math.max(...stages));
}
