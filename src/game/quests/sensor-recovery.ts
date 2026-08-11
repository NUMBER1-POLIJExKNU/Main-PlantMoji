// The sensor half of the recovery-quest rule, split out of quest-engine.ts.
//
// It lives here because it is the one piece of the engine a BROWSER needs: the
// classroom cheat sandbox drives quest stages off hand-edited sensor values and
// has to ask the very same question the engine asks. quest-engine.ts pulls in
// Supabase data helpers, so importing it from a client component would drag
// server code into the bundle. This module has no I/O — definitions, the crop
// profile, and arithmetic — and quest-engine re-exports it so the engine and
// the sandbox can never answer differently.

import { getCropProfile, type CropProfile } from "@/lib/crop-profiles";
import type { QuestDefinition } from "./quest-definitions";

/**
 * True when the event's sensor data proves the recovery has NOT happened,
 * even if another mood currently outranks the trigger (e.g. still 33°C while
 * the state machine shows SoilAcidic) — handoff §16's completion condition is
 * the sensor value, not the mood label. Blocks when ANY of:
 *   * def.verifyTemperatureMax is set and data.temperature is a finite number
 *     above it ("temperature <= 30°C and remains stable"), OR
 *   * def.verifyPhRange is set and data.soilPH is a finite number outside
 *     [min, max] ("calibrated pH returns to normal range and remains stable"), OR
 *   * def.verifyHumidityMin is set and data.humidity is a finite number below
 *     it (handoff §5.2 dry-air hysteresis: dry OFF at >= 45% — anything drier
 *     means the air has NOT recovered), OR
 *   * def.verifyTemperatureMin is set and data.temperature is a finite number
 *     below the profile's cold recover point (still too cold), OR
 *   * def.verifyHumidityMax is set and data.humidity is a finite number above
 *     the profile's humid-air recover point (air still too humid).
 * Each clause reads its live threshold from the plant's crop profile; the
 * QuestDefinition field is the opt-in flag carrying the handoff demo value.
 */
export function sensorBlocksRecovery(
  def: QuestDefinition,
  data?: Record<string, unknown>,
  profile: CropProfile = getCropProfile(null),
): boolean {
  if (def.kind !== "recovery" || !data) return false;

  if (def.verifyTemperatureMax !== undefined) {
    const temperature = data.temperature;
    if (
      typeof temperature === "number" &&
      Number.isFinite(temperature) &&
      temperature > profile.temperature.overheating.recoverAtOrBelow
    ) {
      return true;
    }
  }

  if (def.verifyTemperatureMin !== undefined) {
    const temperature = data.temperature;
    if (
      typeof temperature === "number" &&
      Number.isFinite(temperature) &&
      temperature < profile.temperature.cold.recoverAtOrAbove
    ) {
      return true;
    }
  }

  if (def.verifyPhRange !== undefined) {
    const soilPH = data.soilPH;
    if (
      typeof soilPH === "number" &&
      Number.isFinite(soilPH) &&
      (soilPH < profile.soilPh.recommended.min || soilPH > profile.soilPh.recommended.max)
    ) {
      return true;
    }
  }

  if (def.verifyHumidityMin !== undefined) {
    const humidity = data.humidity;
    if (
      typeof humidity === "number" &&
      Number.isFinite(humidity) &&
      humidity < profile.airHumidity.dryAir.recoverAtOrAbove
    ) {
      return true;
    }
  }

  if (def.verifyHumidityMax !== undefined) {
    const humidity = data.humidity;
    if (
      typeof humidity === "number" &&
      Number.isFinite(humidity) &&
      humidity > profile.airHumidity.humidAir.recoverAtOrBelow
    ) {
      return true;
    }
  }

  return false;
}
