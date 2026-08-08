import { ingestRawSensorReading, RawSensorIngestError } from "@/game/events/raw-sensor-ingest";
import { getServerSupabase } from "@/lib/supabase/server";
import { parseRawSensorReading } from "@/types/raw-sensors";

/** Preferred endpoint for the new raw-only Node-RED flow. */
export async function POST(request: Request) {
  const requiredToken = process.env.DEVICE_API_TOKEN;
  if (requiredToken && request.headers.get("authorization") !== `Bearer ${requiredToken}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "body must be valid JSON" }, { status: 400 });
  }
  const parsed = parseRawSensorReading(body);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase is not configured (check .env.local)" },
      { status: 503 },
    );
  }

  try {
    const result = await ingestRawSensorReading(supabase, parsed.reading);
    return Response.json({ ok: true, contract: "raw-sensor-v1", ...result });
  } catch (cause) {
    console.error("sensor-readings processing failed:", cause);
    if (cause instanceof RawSensorIngestError && cause.kind === "unknown-plant") {
      return Response.json({ ok: false, error: cause.message }, { status: 404 });
    }
    return Response.json(
      { ok: false, error: cause instanceof RawSensorIngestError && cause.kind === "game" ? "game processing error" : "database error" },
      { status: 500 },
    );
  }
}
