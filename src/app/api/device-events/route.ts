import { getServerSupabase } from "@/lib/supabase/server";
import { parseDeviceEvent } from "@/types/events";
import {
  DeviceEventIngestError,
  ingestDeviceEvent,
} from "@/game/events/device-event-ingest";
import { ingestRawSensorReading, RawSensorIngestError } from "@/game/events/raw-sensor-ingest";
import { looksLikeRawSensorPayload, parseRawSensorReading } from "@/types/raw-sensors";

/**
 * POST /api/device-events — accepts both the legacy semantic-event envelope
 * and the new flat raw-sensor payload from Node-RED.
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

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase is not configured (check .env.local)" },
      { status: 503 },
    );
  }

  if (looksLikeRawSensorPayload(body)) {
    const parsed = parseRawSensorReading(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    try {
      const result = await ingestRawSensorReading(supabase, parsed.reading);
      return Response.json({ ok: true, contract: "raw-sensor-v1", ...result });
    } catch (cause) {
      console.error("device-events raw-sensor processing failed:", cause);
      if (cause instanceof RawSensorIngestError && cause.kind === "unknown-plant") {
        return Response.json({ ok: false, error: cause.message }, { status: 404 });
      }
      return Response.json(
        { ok: false, error: cause instanceof RawSensorIngestError && cause.kind === "game" ? "game processing error" : "database error" },
        { status: 500 },
      );
    }
  }

  const parsed = parseDeviceEvent(body);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  try {
    const result = await ingestDeviceEvent(supabase, parsed.event);
    return Response.json({ ok: true, contract: "semantic-event-v1", ...result });
  } catch (cause) {
    console.error("device-events processing failed:", cause);
    if (cause instanceof DeviceEventIngestError && cause.kind === "unknown-plant") {
      return Response.json({ ok: false, error: cause.message }, { status: 404 });
    }
    return Response.json(
      { ok: false, error: cause instanceof DeviceEventIngestError && cause.kind === "game" ? "game processing error" : "database error" },
      { status: 500 },
    );
  }
}
