import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/demo-reset — wipes game progress for one plant so the filming
 * scenario (KBS documentary retakes) can be re-shot without hand-editing the
 * database.
 *
 * Destructive and reachable on a public URL, so auth is MANDATORY: unlike
 * /api/device-events (token optional for the local prototype), this endpoint
 * refuses to run at all when DEVICE_API_TOKEN is not configured — there is no
 * unauthenticated mode.
 *
 * Reset scope (rows for the given plant only):
 *   cleared — xp_rewards, bond_events, plant_badges, quests, device_events
 *   reset   — bond_state back to Lv.1 / 0 XP / no streak / chapter 1
 *   reset   — plants.current_state = 'Happy' with an epoch state_changed_at,
 *             so the route's "only newer events win" guard always accepts the
 *             next real event
 * NEVER touched — growth_records (real-world growth log) and sensor_readings
 * (Node-RED's table).
 */

const EPOCH = "1970-01-01T00:00:00Z";

// All five tables reference plants directly (no FKs between them), so any
// order satisfies the constraints — but the XP ledger and event log go first
// so a mid-reset failure can never leave reward history pointing at quests
// that are already gone.
const TABLES_TO_CLEAR = [
  "xp_rewards",
  "bond_events",
  "plant_badges",
  "quests",
  "device_events",
] as const;

export async function POST(request: Request) {
  // Hard auth gate: a destructive endpoint must never run open. If the token
  // is not configured, the whole feature is disabled.
  const requiredToken = process.env.DEVICE_API_TOKEN;
  if (!requiredToken) {
    return Response.json(
      { error: "demo-reset disabled: set DEVICE_API_TOKEN" },
      { status: 403 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${requiredToken}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Body: { plantId } — optional, defaults to the seeded demo plant.
  let plantId = "plant-01";
  const raw = await request.text();
  if (raw.trim().length > 0) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json(
        { ok: false, error: "body must be valid JSON" },
        { status: 400 },
      );
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json(
        { ok: false, error: "body must be a JSON object" },
        { status: 400 },
      );
    }
    const candidate = (body as Record<string, unknown>).plantId;
    if (candidate !== undefined) {
      if (typeof candidate !== "string" || candidate.trim() === "") {
        return Response.json(
          { ok: false, error: "plantId must be a non-empty string" },
          { status: 400 },
        );
      }
      plantId = candidate;
    }
  }

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
    .eq("id", plantId)
    .maybeSingle();

  if (plantError) {
    console.error("demo-reset: plant lookup failed:", plantError.message);
    return Response.json(
      { ok: false, error: `plant lookup failed: ${plantError.message}` },
      { status: 500 },
    );
  }
  if (!plant) {
    return Response.json(
      { ok: false, error: `unknown plantId: ${plantId}` },
      { status: 404 },
    );
  }

  // 1) Clear game history. delete({ count: "exact" })...select() reports how
  // many rows each table actually dropped, for the response summary.
  const cleared: Record<string, number> = {};
  for (const table of TABLES_TO_CLEAR) {
    const { data, count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("plant_id", plantId)
      .select("*");

    if (error) {
      console.error(`demo-reset: clearing ${table} failed:`, error.message);
      return Response.json(
        { ok: false, error: `failed to clear ${table}: ${error.message}` },
        { status: 500 },
      );
    }
    cleared[table] = count ?? data?.length ?? 0;
  }

  // 2) Reset progression to the fresh-install baseline (milestone3.sql
  // defaults). Upsert covers a plant that never had a bond_state row.
  const { error: bondError } = await supabase.from("bond_state").upsert(
    {
      plant_id: plantId,
      total_xp: 0,
      bond_level: 1,
      current_streak: 0,
      longest_streak: 0,
      last_qualified_date: null,
      current_chapter: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plant_id" },
  );
  if (bondError) {
    console.error("demo-reset: bond_state reset failed:", bondError.message);
    return Response.json(
      { ok: false, error: `failed to reset bond_state: ${bondError.message}` },
      { status: 500 },
    );
  }

  // 3) Return the plant to Happy with an epoch timestamp — matching the
  // milestone1.sql column default — so the "only newer events win" guard
  // (state_changed_at <= occurredAt) always accepts the next real event.
  const { error: plantsError } = await supabase
    .from("plants")
    .update({ current_state: "Happy", state_changed_at: EPOCH })
    .eq("id", plantId);
  if (plantsError) {
    console.error("demo-reset: plants reset failed:", plantsError.message);
    return Response.json(
      { ok: false, error: `failed to reset plants: ${plantsError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, plantId, cleared });
}
