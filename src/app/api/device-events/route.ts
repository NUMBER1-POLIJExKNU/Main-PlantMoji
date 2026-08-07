import { getServerSupabase } from "@/lib/supabase/server";
import { parseDeviceEvent } from "@/types/events";
import { processDeviceEvent } from "@/game/events/event-router";

/**
 * POST /api/device-events — the single entry point for semantic events from
 * Node-RED (handoff §25, Correction 2).
 *
 * Pipeline: authenticate → validate → persist (idempotent) → apply state.
 * Duplicate deliveries of the same eventId never double-apply (handoff §28),
 * and out-of-order retries can never overwrite a newer plant state.
 */
export async function POST(request: Request) {
  // Shared-token auth: enforced only when DEVICE_API_TOKEN is set, so the
  // local prototype stays friction-free (handoff §45: don't over-engineer
  // auth for a one-plant prototype).
  const requiredToken = process.env.DEVICE_API_TOKEN;
  if (requiredToken) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${requiredToken}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "body must be valid JSON" }, { status: 400 });
  }

  const parsed = parseDeviceEvent(body);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const event = parsed.event;

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase is not configured (check .env.local)" },
      { status: 503 },
    );
  }

  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("id")
    .eq("id", event.plantId)
    .maybeSingle();

  if (plantError) {
    console.error("device-events: plant lookup failed:", plantError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }
  if (!plant) {
    return Response.json(
      { ok: false, error: `unknown plantId: ${event.plantId}` },
      { status: 404 },
    );
  }

  // Idempotent persist: a retry with the same eventId inserts nothing.
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
    console.error("device-events: insert failed:", insertError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }
  const duplicate = !inserted || inserted.length === 0;

  // Apply the mood even on duplicates: if the first delivery persisted the
  // event but crashed before this update, the Node-RED retry still lands it.
  // The state_changed_at guard makes re-application harmless and blocks
  // stale events from overwriting a newer state.
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
      console.error("device-events: state update failed:", updateError.message);
      return Response.json({ ok: false, error: "database error" }, { status: 500 });
    }
    applied = (updated ?? []).length > 0;
  }

  // Game progression (quests → XP → streak → badges → story). Runs on
  // duplicates too: if a previous delivery persisted the event but crashed
  // mid-processing, the retry finishes the job — every engine step is
  // idempotent. A failure returns 500 so Node-RED retries.
  try {
    await processDeviceEvent(event, { stateApplied: applied });
  } catch (error) {
    console.error("device-events: game processing failed:", error);
    return Response.json({ ok: false, error: "game processing error" }, { status: 500 });
  }

  return Response.json({ ok: true, eventId: event.eventId, duplicate, applied });
}
