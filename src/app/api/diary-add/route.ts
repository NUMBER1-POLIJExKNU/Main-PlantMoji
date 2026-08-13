import { getServerSupabase } from "@/lib/supabase/server";
import { getPlant, normalizeGrowthStage } from "@/lib/queries";

/**
 * POST /api/diary-add — lets the Flutter app add a TEXT-ONLY diary note.
 * Writes into the same `growth_records` table the web Diary page reads
 * (src/lib/growth.ts / milestone5-growth-records.sql), so both sides stay
 * in sync automatically — no separate "mobile diary" table.
 *
 * `stage` is not accepted from the client: `growth_records.stage` is
 * NOT NULL with a CHECK constraint, and the mobile app only ever sends a
 * note, so the plant's CURRENT growth_stage (from `plants`) is used
 * automatically. height_cm / leaf_count are left null (web-only fields).
 *
 * This demo endpoint is intentionally public so the Flutter Web build can add
 * notes without exposing the device-ingest token in browser JavaScript.
 */

const MAX_NOTE_LENGTH = 200;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "body must be valid JSON" }, { status: 400 });
  }

  const raw = body as { plantId?: unknown; note?: unknown };
  const plantId =
    typeof raw.plantId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.plantId)
      ? raw.plantId
      : "plant-01";

  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length === 0) {
    return Response.json({ ok: false, error: "note is required" }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return Response.json(
      { ok: false, error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  }

  const plantResult = await getPlant(supabase, plantId);
  const stage =
    plantResult.status === "ok"
      ? normalizeGrowthStage(plantResult.plant.growth_stage) ?? "New Plant"
      : "New Plant";

  const { data, error } = await supabase
    .from("growth_records")
    .insert({ plant_id: plantId, stage, note, height_cm: null, leaf_count: null })
    .select("id, recorded_at, stage, note")
    .single();

  if (error) {
    console.error("diary-add insert failed:", error.message);
    return Response.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return Response.json(
    { ok: true, entry: { id: data.id, date: data.recorded_at, stage: data.stage, quote: data.note ?? "" } },
    { status: 201 },
  );
}
