import type { CropProfile } from "@/lib/crop-profiles";
import { hasSufficientLight, LIGHT_PERCENT_MAX, LIGHT_PERCENT_MIN } from "@/lib/light-sensor";
import { normalizeMood, type PlantMood } from "@/types/events";

export interface RawSensorReading {
  plantId: string;
  temperature: number;
  humidity: number;
  soilPH: number;
  light: number;
  recordedAt: string;
  readingId: string;
}

export type ParsedRawSensorReading =
  | { ok: true; reading: RawSensorReading }
  | { ok: false; error: string };

/**
 * Physically possible range for each sensor — the values the ingest endpoint
 * is willing to store. Humidity and light are percentages and pH is the 0–14
 * scale, so anything outside these is not a reading, it's a bad payload.
 *
 * Exported because the classroom cheat sandbox edits the same four numbers by
 * hand: a demo must not be able to put a value on screen that the real
 * hardware path would have rejected (200% humidity, pH 20). One definition,
 * so the validator and the demo editor can never drift apart.
 */
export const SENSOR_LIMITS = {
  temperature: { min: -40, max: 100 },
  humidity: { min: 0, max: 100 },
  soilPH: { min: 0, max: 14 },
  light: { min: LIGHT_PERCENT_MIN, max: LIGHT_PERCENT_MAX },
} as const;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseRecordedAt(value: unknown, now: Date): Date | null {
  if (value === undefined || value === null) return now;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== "string") return null;
  const ISO_WITH_OFFSET =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function looksLikeRawSensorPayload(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const body = input as Record<string, unknown>;
  const hasSensorField = ["temperature", "humidity", "soilPH", "soilPh", "light"].some(
    (key) => Object.hasOwn(body, key),
  );
  return (
    hasSensorField ||
    (Object.hasOwn(body, "plantId") && !Object.hasOwn(body, "eventId") && !Object.hasOwn(body, "type"))
  );
}

/** Validates the flat payload produced by the new Node-RED flow. */
export function parseRawSensorReading(
  input: unknown,
  now: Date = new Date(),
): ParsedRawSensorReading {
  if (Number.isNaN(now.getTime())) return { ok: false, error: "invalid server time" };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = input as Record<string, unknown>;
  const plantId = typeof body.plantId === "string" ? body.plantId.trim() : "";
  if (!plantId || plantId.length > 64) {
    return { ok: false, error: "plantId must be a non-empty string (max 64 chars)" };
  }

  const temperature = finiteNumber(body.temperature);
  const humidity = finiteNumber(body.humidity);
  const soilPH = finiteNumber(body.soilPH ?? body.soilPh);
  const light = finiteNumber(body.light);
  if (temperature === null || humidity === null || soilPH === null || light === null) {
    return {
      ok: false,
      error: "temperature, humidity, soilPH, and light must all be finite numbers",
    };
  }
  if (temperature < SENSOR_LIMITS.temperature.min || temperature > SENSOR_LIMITS.temperature.max) {
    return { ok: false, error: "temperature must be between -40 and 100°C" };
  }
  if (humidity < SENSOR_LIMITS.humidity.min || humidity > SENSOR_LIMITS.humidity.max) {
    return { ok: false, error: "humidity must be between 0 and 100%" };
  }
  if (soilPH < SENSOR_LIMITS.soilPH.min || soilPH > SENSOR_LIMITS.soilPH.max) {
    return { ok: false, error: "soilPH must be between 0 and 14" };
  }
  if (light < SENSOR_LIMITS.light.min || light > SENSOR_LIMITS.light.max) {
    return { ok: false, error: "light must be between 0 and 100%" };
  }

  const recordedAt = parseRecordedAt(body.recordedAt ?? body.timestamp, now);
  if (!recordedAt) {
    return {
      ok: false,
      error: "timestamp must be epoch milliseconds or ISO 8601 with a timezone offset",
    };
  }
  if (recordedAt.getTime() > now.getTime() + 10 * 60_000) {
    return { ok: false, error: "timestamp is more than 10 minutes in the future" };
  }

  const rawReadingId = body.readingId;
  if (
    rawReadingId !== undefined &&
    (typeof rawReadingId !== "string" || !rawReadingId.trim() || rawReadingId.trim().length > 96)
  ) {
    return { ok: false, error: "readingId must be a non-empty string (max 96 chars) when provided" };
  }
  const recordedAtIso = recordedAt.toISOString();
  const readingId =
    typeof rawReadingId === "string"
      ? rawReadingId.trim()
      : `raw:${plantId}:${recordedAtIso}`;

  return {
    ok: true,
    reading: {
      plantId,
      temperature,
      humidity,
      soilPH,
      light,
      recordedAt: recordedAtIso,
      readingId,
    },
  };
}

export function isCropLightingHours(date: Date, profile: CropProfile): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      hourCycle: "h23",
      timeZone: profile.timezone,
    }).format(date),
  );
  const { start, end } = profile.light.lightingHours;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Server-side equivalent of Node-RED's former Combine Plant State function.
 * Priority is heat → cold → dry air → humid air → daytime darkness → soil pH
 * → healthy. Heat/cold are mutually exclusive temperature bands, as are
 * dry/humid air; each uses hysteresis so the state does not flicker at the
 * threshold (enter on the outer bound, recover only past the inner one).
 */
export function determinePlantMood(
  reading: Pick<RawSensorReading, "temperature" | "humidity" | "soilPH" | "light">,
  currentValue: unknown,
  profile: CropProfile,
  duringLightingHours: boolean,
): PlantMood {
  const currentMood = normalizeMood(currentValue) ?? "Happy";
  const overheating =
    currentMood === "Overheating"
      ? reading.temperature > profile.temperature.overheating.recoverAtOrBelow
      : reading.temperature >= profile.temperature.overheating.enterAtOrAbove;
  if (overheating) return "Overheating";

  const tooCold =
    currentMood === "TooCold"
      ? reading.temperature < profile.temperature.cold.recoverAtOrAbove
      : reading.temperature <= profile.temperature.cold.enterAtOrBelow;
  if (tooCold) return "TooCold";

  const dryAir =
    currentMood === "DryAir"
      ? reading.humidity < profile.airHumidity.dryAir.recoverAtOrAbove
      : reading.humidity < profile.airHumidity.dryAir.enterBelow;
  if (dryAir) return "DryAir";

  const humidAir =
    currentMood === "HumidAir"
      ? reading.humidity > profile.airHumidity.humidAir.recoverAtOrBelow
      : reading.humidity > profile.airHumidity.humidAir.enterAbove;
  if (humidAir) return "HumidAir";
  if (duringLightingHours && !hasSufficientLight(reading.light)) {
    return "Sleepy";
  }
  if (reading.soilPH < profile.soilPh.recommended.min) return "SoilAcidic";
  if (reading.soilPH > profile.soilPh.recommended.max) return "SoilAlkaline";
  return "Happy";
}
