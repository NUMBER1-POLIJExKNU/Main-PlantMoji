// Domain event contract between Node-RED and the game backend.
// See handoff §27 (event model) and §28 (idempotency).

export const PLANT_MOODS = [
  "Happy",
  "Overheating",
  "DryAir",
  "Sleepy",
  "SoilAcidic",
  "SoilAlkaline",
] as const;

export type PlantMood = (typeof PLANT_MOODS)[number];

/** Human-facing mood names (handoff §5.1). */
export const MOOD_LABELS: Record<PlantMood, string> = {
  Happy: "Happy",
  Overheating: "Overheating",
  DryAir: "Dry Air",
  Sleepy: "Sleepy",
  SoilAcidic: "Soil Acidic",
  SoilAlkaline: "Soil Alkaline",
};

// Milestone 1–2 accepts only device-originated events (handoff Correction 3).
// Game events (QUEST_*, XP_*, ...) are produced by the game engine later, not
// accepted from the device.
export const DEVICE_EVENT_TYPES = [
  "PLANT_STATE_CHANGED",
  "PLANT_RECOVERED",
  "SENSOR_OFFLINE",
  "SENSOR_ONLINE",
] as const;

export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

export interface DeviceEvent {
  /** Globally unique — duplicate deliveries with the same eventId are ignored. */
  eventId: string;
  plantId: string;
  type: DeviceEventType;
  /** ISO 8601 timestamp of when the event occurred on the device side. */
  occurredAt: string;
  data: Record<string, unknown>;
}

/**
 * Normalizes a mood string to its canonical code.
 * Tolerates spacing/case variants ("Dry Air", "dryair" → "DryAir") so a
 * Node-RED label/code mismatch cannot break the demo.
 */
export function normalizeMood(value: unknown): PlantMood | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[\s_-]/g, "").toLowerCase();
  for (const mood of PLANT_MOODS) {
    if (mood.toLowerCase() === compact) return mood;
  }
  return null;
}

export type ParsedDeviceEvent =
  | { ok: true; event: DeviceEvent }
  | { ok: false; error: string };

/** Validates an unknown request body against the device event contract. */
export function parseDeviceEvent(input: unknown): ParsedDeviceEvent {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = input as Record<string, unknown>;

  const eventId = body.eventId;
  if (typeof eventId !== "string" || eventId.length === 0 || eventId.length > 128) {
    return { ok: false, error: "eventId must be a non-empty string (max 128 chars)" };
  }

  const plantId = body.plantId;
  if (typeof plantId !== "string" || plantId.length === 0 || plantId.length > 64) {
    return { ok: false, error: "plantId must be a non-empty string (max 64 chars)" };
  }

  const type = body.type;
  if (typeof type !== "string" || !(DEVICE_EVENT_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      error: `type must be one of: ${DEVICE_EVENT_TYPES.join(", ")}`,
    };
  }

  // Strict ISO 8601 WITH timezone offset. A zone-less timestamp would be
  // reinterpreted by Postgres (UTC) vs the device (UTC+7) and silently freeze
  // the state_changed_at guard for hours — reject it at the trust boundary.
  // Fractional seconds up to 9 digits: JS toISOString emits 3, PowerShell
  // 'o' emits 7; Postgres rounds to microseconds on input.
  const ISO_WITH_OFFSET =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
  const occurredAt = body.occurredAt;
  if (
    typeof occurredAt !== "string" ||
    !ISO_WITH_OFFSET.test(occurredAt) ||
    Number.isNaN(Date.parse(occurredAt))
  ) {
    return {
      ok: false,
      error:
        "occurredAt must be an ISO 8601 timestamp with timezone offset (e.g. 2026-08-07T12:00:00+07:00)",
    };
  }
  // A clock misconfigured hours ahead would also freeze the guard — surface
  // it as a clear 400 instead. 10 min of skew is tolerated.
  if (Date.parse(occurredAt) > Date.now() + 10 * 60 * 1000) {
    return {
      ok: false,
      error: "occurredAt is more than 10 minutes in the future — check the device clock",
    };
  }

  const rawData = body.data ?? {};
  if (typeof rawData !== "object" || rawData === null || Array.isArray(rawData)) {
    return { ok: false, error: "data must be a JSON object" };
  }
  const data = { ...(rawData as Record<string, unknown>) };

  if (type === "PLANT_STATE_CHANGED") {
    const currentState = normalizeMood(data.currentState);
    if (!currentState) {
      return {
        ok: false,
        error: `data.currentState must be one of: ${PLANT_MOODS.join(", ")}`,
      };
    }
    data.currentState = currentState;

    if (data.previousState != null) {
      const previousState = normalizeMood(data.previousState);
      if (!previousState) {
        return {
          ok: false,
          error: `data.previousState must be one of: ${PLANT_MOODS.join(", ")} (or omitted)`,
        };
      }
      data.previousState = previousState;
    }
  }

  return {
    ok: true,
    event: {
      eventId,
      plantId,
      type: type as DeviceEventType,
      occurredAt,
      data,
    },
  };
}
