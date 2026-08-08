import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestDeviceEvent } from "@/game/events/device-event-ingest";
import { getCropProfile } from "@/lib/crop-profiles";
import {
  determinePlantMood,
  isCropLightingHours,
  type RawSensorReading,
} from "@/types/raw-sensors";
import { normalizeMood, type DeviceEvent } from "@/types/events";

export class RawSensorIngestError extends Error {
  constructor(
    message: string,
    public readonly kind: "unknown-plant" | "database" | "game",
  ) {
    super(message);
    this.name = "RawSensorIngestError";
  }
}

async function ingestMoodEvent(supabase: SupabaseClient, event: DeviceEvent) {
  try {
    return await ingestDeviceEvent(supabase, event);
  } catch (cause) {
    const kind =
      typeof cause === "object" && cause !== null && "kind" in cause
        ? (cause as { kind?: string }).kind
        : null;
    throw new RawSensorIngestError(
      cause instanceof Error ? cause.message : String(cause),
      kind === "unknown-plant" ? "unknown-plant" : kind === "game" ? "game" : "database",
    );
  }
}

export async function ingestRawSensorReading(
  supabase: SupabaseClient,
  reading: RawSensorReading,
) {
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("id, current_state, crop_profile_key")
    .eq("id", reading.plantId)
    .maybeSingle();
  if (plantError) {
    throw new RawSensorIngestError(`plant lookup failed: ${plantError.message}`, "database");
  }
  if (!plant) {
    throw new RawSensorIngestError(`unknown plantId: ${reading.plantId}`, "unknown-plant");
  }

  const profile = getCropProfile(plant.crop_profile_key);
  const recordedDate = new Date(reading.recordedAt);
  const previousMood = normalizeMood(plant.current_state) ?? "Happy";
  const mood = determinePlantMood(
    reading,
    previousMood,
    profile,
    isCropLightingHours(recordedDate, profile),
  );

  const { data: insertedReadings, error: sensorError } = await supabase
    .from("sensor_readings")
    .upsert(
      {
        reading_id: reading.readingId,
        plant_id: reading.plantId,
        temperature: reading.temperature,
        humidity: reading.humidity,
        soil_ph: reading.soilPH,
        light: reading.light,
        recorded_at: reading.recordedAt,
      },
      { onConflict: "reading_id", ignoreDuplicates: true },
    )
    .select("reading_id");
  if (sensorError) {
    throw new RawSensorIngestError(`sensor insert failed: ${sensorError.message}`, "database");
  }

  const duplicateReading = !insertedReadings || insertedReadings.length === 0;
  const eventId = `${reading.readingId}:${mood.toLowerCase()}`;

  if (mood === previousMood) {
    // If the first attempt updated plants but crashed during game processing,
    // a retry sees the new mood. Re-run the already-persisted event only when
    // this exact reading is a duplicate and its event exists.
    if (duplicateReading) {
      const { data: priorEvent, error: priorEventError } = await supabase
        .from("device_events")
        .select("event_id, type, occurred_at, data")
        .eq("event_id", eventId)
        .maybeSingle();
      if (priorEventError) {
        throw new RawSensorIngestError(
          `event retry lookup failed: ${priorEventError.message}`,
          "database",
        );
      }
      if (priorEvent) {
        const replay: DeviceEvent = {
          eventId: priorEvent.event_id,
          plantId: reading.plantId,
          type: priorEvent.type,
          occurredAt: priorEvent.occurred_at,
          data: priorEvent.data,
        } as DeviceEvent;
        const replayResult = await ingestMoodEvent(supabase, replay);
        return {
          readingId: reading.readingId,
          recordedAt: reading.recordedAt,
          cropProfileKey: profile.key,
          cropProfileVersion: profile.version,
          mood,
          previousMood,
          stateChanged: true,
          duplicateReading,
          ...replayResult,
        };
      }
    }
    return {
      readingId: reading.readingId,
      recordedAt: reading.recordedAt,
      cropProfileKey: profile.key,
      cropProfileVersion: profile.version,
      mood,
      previousMood,
      stateChanged: false,
      eventId: null,
      duplicateReading,
      duplicate: false,
      applied: false,
    };
  }

  const event: DeviceEvent = {
    eventId,
    plantId: reading.plantId,
    type: "PLANT_STATE_CHANGED",
    occurredAt: reading.recordedAt,
    data: {
      previousState: previousMood,
      currentState: mood,
      temperature: reading.temperature,
      humidity: reading.humidity,
      soilPH: reading.soilPH,
      light: reading.light,
      cropProfileKey: profile.key,
      cropProfileVersion: profile.version,
      source: "raw-sensor-api",
    },
  };

  const eventResult = await ingestMoodEvent(supabase, event);
  return {
    readingId: reading.readingId,
    recordedAt: reading.recordedAt,
    cropProfileKey: profile.key,
    cropProfileVersion: profile.version,
    mood,
    previousMood,
    stateChanged: true,
    duplicateReading,
    ...eventResult,
  };
}
