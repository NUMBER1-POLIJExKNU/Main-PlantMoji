import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { processDeviceEvent } from "@/game/events/event-router";
import type { DeviceEvent } from "@/types/events";

export class DeviceEventIngestError extends Error {
  constructor(
    message: string,
    public readonly kind: "unknown-plant" | "database" | "game",
  ) {
    super(message);
    this.name = "DeviceEventIngestError";
  }
}

/** Persists and applies a validated semantic event, replay-safely. */
export async function ingestDeviceEvent(supabase: SupabaseClient, event: DeviceEvent) {
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("id")
    .eq("id", event.plantId)
    .maybeSingle();
  if (plantError) {
    throw new DeviceEventIngestError(`plant lookup failed: ${plantError.message}`, "database");
  }
  if (!plant) {
    throw new DeviceEventIngestError(`unknown plantId: ${event.plantId}`, "unknown-plant");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("device_events")
    .upsert(
      {
        event_id: event.eventId,
        plant_id: event.plantId,
        type: event.type,
        occurred_at: event.occurredAt,
        data: event.data,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id");
  if (insertError) {
    throw new DeviceEventIngestError(`event insert failed: ${insertError.message}`, "database");
  }
  const duplicate = !inserted || inserted.length === 0;

  let applied = false;
  if (event.type === "PLANT_STATE_CHANGED") {
    const { data: updated, error: updateError } = await supabase
      .from("plants")
      .update({
        current_state: event.data.currentState as string,
        state_changed_at: event.occurredAt,
      })
      .eq("id", event.plantId)
      .lte("state_changed_at", event.occurredAt)
      .select("id");
    if (updateError) {
      throw new DeviceEventIngestError(`state update failed: ${updateError.message}`, "database");
    }
    applied = (updated ?? []).length > 0;
  }

  try {
    await processDeviceEvent(event, { stateApplied: applied });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new DeviceEventIngestError(`game processing failed: ${message}`, "game");
  }
  return { eventId: event.eventId, duplicate, applied };
}
