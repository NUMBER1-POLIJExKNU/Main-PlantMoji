import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/camera-events — deterministic touch fan-out from the guardian
 * camera page (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
 *
 * PRESENTATION + LOG ONLY: this route inserts one camera_events row and
 * nothing else — no XP, no Seeds, no quests, no bond writes, ever (project
 * invariant: camera signals are never rewards). The browser may only report
 * kind "touch"; pest_advice rows are created exclusively by /api/camera-scan.
 *
 * Rate limit (≥10s between rows) is enforced HERE against the table's own
 * latest row, so a stuck client, a reload loop, or a hand waved at the lens
 * can never flood the farm with giggles. Events are ephemeral by design:
 * a rejected or lost event is a missed giggle, not data loss.
 */

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/; // same rule as /api/daily-quiz
const MIN_GAP_MS = 10_000;

/** PostgREST "missing from schema cache": milestone19 hasn't been run. */
function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const plantId = typeof body.plantId === "string" ? body.plantId : "plant-01";
  if (!VALID_PLANT.test(plantId)) {
    return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });
  }
  if (body.kind !== "touch") {
    return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  // occurredAt is advisory client context only — the rate limit and the
  // stored timestamp both use SERVER time (never trust a device clock).
  if (
    body.occurredAt !== undefined &&
    (typeof body.occurredAt !== "string" || Number.isNaN(Date.parse(body.occurredAt)))
  ) {
    return Response.json({ ok: false, error: "invalid_occurred_at" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase is not configured (check .env.local)" },
      { status: 503 },
    );
  }

  const { data: lastRows, error: lastError } = await supabase
    .from("camera_events")
    .select("occurred_at")
    .eq("plant_id", plantId)
    .eq("kind", "touch")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (lastError) {
    if (isMissingSchemaError(lastError)) {
      return Response.json({ ok: false, error: "migration_required" }, { status: 503 });
    }
    console.error(`camera-events(${plantId}) rate-limit read failed:`, lastError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }

  const lastAt = lastRows?.[0]?.occurred_at ? Date.parse(String(lastRows[0].occurred_at)) : null;
  const now = Date.now();
  // Known bounded race: two concurrent POSTs can both pass this check and
  // insert. Impact is a spare table row only — live.js additionally swallows
  // replays behind its own 10s CAMERA_TOUCH_GAP_MS throttle.
  if (lastAt !== null && Number.isFinite(lastAt) && now - lastAt < MIN_GAP_MS) {
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // note is omitted on purpose: pre-reconciliation databases (dd2dc1d) keep
  // a NOT NULL note column, and an explicit null would 500 every touch there.
  const { error: insertError } = await supabase.from("camera_events").insert({
    plant_id: plantId,
    kind: "touch",
    occurred_at: new Date(now).toISOString(),
  });
  if (insertError) {
    if (isMissingSchemaError(insertError)) {
      return Response.json({ ok: false, error: "migration_required" }, { status: 503 });
    }
    console.error(`camera-events(${plantId}) insert failed:`, insertError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
