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
import { SENSOR_LIMITS } from "@/types/raw-sensors";
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

const mid = (range: { min: number; max: number }) => (range.min + range.max) / 2;
const round1 = (value: number) => Math.round(value * 10) / 10;

function clampVitals(vitals: CheatSensorValues): CheatSensorValues {
  const fit = (value: number, limit: { min: number; max: number }) =>
    Math.min(limit.max, Math.max(limit.min, value));
  return {
    temperature: round1(fit(vitals.temperature, SENSOR_LIMITS.temperature)),
    humidity: Math.round(fit(vitals.humidity, SENSOR_LIMITS.humidity)),
    light: Math.round(fit(vitals.light, SENSOR_LIMITS.light)),
    soilPh: round1(fit(vitals.soilPh, SENSOR_LIMITS.soilPH)),
  };
}

/** Every reading in its comfortable band for this crop — the state a healthy
 *  plant reports, and the baseline every quest scenario deviates from. */
export function comfortableVitals(profile: CropProfile = getCropProfile(null)): CheatSensorValues {
  return clampVitals({
    temperature: mid(profile.temperature.recommended),
    humidity: mid(profile.airHumidity.recommended),
    light: profile.light.minimumPercentDuringLightingHours + 25,
    soilPh: mid(profile.soilPh.recommended),
  });
}

/**
 * The readings that MAKE a quest's stage true, so the board can move the world
 * instead of only the card. Jumping to SENSE/ACT reproduces the problem the
 * quest exists for; VERIFY/REWARD reports it fixed.
 *
 * Exactly one reading ever leaves its comfortable band, because mood is a
 * priority ladder: nudging two at once would hand the mascot a face from a
 * different quest than the one being demonstrated. Thresholds come from the
 * crop profile — the same numbers the engine verifies against — so the sensor
 * state and the stage can never contradict each other.
 */
export function sensorsForStage(
  key: QuestKey,
  stage: number,
  profile: CropProfile = getCropProfile(null),
): CheatSensorValues {
  const comfy = comfortableVitals(profile);
  // A maintain quest is about holding a good state, so comfortable IS its
  // scenario at every stage.
  if (stage > STAGE_ACT || QUEST_DEFINITIONS[key]?.kind !== "recovery") return comfy;

  const { temperature, airHumidity, soilPh, light } = profile;
  switch (key) {
    case "COOL_ME_DOWN":
      return clampVitals({ ...comfy, temperature: temperature.overheating.enterAtOrAbove + 2 });
    case "WARM_ME_UP":
      return clampVitals({ ...comfy, temperature: temperature.cold.enterAtOrBelow - 2 });
    case "HUMIDIFY_MY_AIR":
      return clampVitals({ ...comfy, humidity: airHumidity.dryAir.enterBelow - 5 });
    case "DEHUMIDIFY_MY_AIR":
      return clampVitals({ ...comfy, humidity: airHumidity.humidAir.enterAbove + 5 });
    case "BALANCE_SOIL_ACIDIC":
      return clampVitals({ ...comfy, soilPh: soilPh.recommended.min - 1.3 });
    case "BALANCE_SOIL_ALKALINE":
      return clampVitals({ ...comfy, soilPh: soilPh.recommended.max + 1.3 });
    case "GIVE_ME_MORE_LIGHT":
      return clampVitals({ ...comfy, light: light.minimumPercentDuringLightingHours - 15 });
    default:
      return comfy;
  }
}

/** Stage the presenter pinned on the board, or 0 when untouched. */
export function stageFromBoard(quests: Record<string, unknown> | undefined, key: QuestKey): number {
  const raw = Number(quests?.[key]);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(QUEST_STAGE_COUNT, Math.max(0, Math.round(raw)));
}

/**
 * The stage to paint, by precedence: the board, then the sensors, then the
 * real row.
 *
 * The board is ABSOLUTE, not a floor. Taking the furthest of the three read
 * well on paper and was useless in the room: the live row already floors every
 * quest at ACT, and a comfortable sandbox floors a recovery quest at VERIFY,
 * so three of the four buttons changed nothing and the board felt dead. "Jump
 * to this stage" has to mean it, backwards included — that is the whole point
 * of a cheat control.
 *
 * Clearing a quest's entry (stage 0) hands it back to the sensors, so a
 * presenter can pin a stage for one beat and then go back to demonstrating
 * that fixing the soil is what really moves the card.
 */
export function cheatQuestStage(input: {
  key: QuestKey;
  questStatus?: string | null;
  quests?: Record<string, unknown>;
  vitals?: CheatSensorValues | null;
  profile?: CropProfile;
}): number {
  const board = stageFromBoard(input.quests, input.key);
  if (board > 0) return Math.min(QUEST_STAGE_COUNT, board);

  const sensors = input.vitals ? stageFromSensors(input.key, input.vitals, input.profile) : 0;
  if (sensors > 0) return sensors;

  return stageFromQuestStatus(input.questStatus);
}
