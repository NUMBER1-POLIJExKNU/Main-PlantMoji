import { selectSkin } from "@/game/companion/skins";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/companion-skin — persist a cosmetic skin choice (milestone20).
 *
 * DISPLAY-ONLY CONTRACT: this route writes companion_state.skin_key and
 * NOTHING else. It never awards XP or seeds, never touches quests, stage,
 * form_key, counters, or any other column, and nothing downstream may parse
 * its response into a game decision. Unlock checks READ bond_state.bond_level;
 * they never write it.
 *
 * Body: { plantId?, skinKey, locale? }. `locale` is accepted for client-call
 * parity but unused here — error codes are returned raw and all player copy
 * lives client-side (in both en and id).
 *
 * Schema drift (milestone20 migration not applied — missing skin_key column,
 * missing companion_state table, or a stale CHECK constraint) is an expected
 * state, answered with { ok:false, error:"migration_missing" } at HTTP 200 —
 * never a 500.
 */

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/;

// Same tiny in-memory window as /api/memory-reflection — enough to stop a
// scripted client from hammering writes, invisible to a human picking skins.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
// Once the map reaches this many keys, expired windows are swept before a new
// key is inserted, so a stream of unique x-forwarded-for values can't grow it
// unboundedly. The sweep runs only on the new-key path — counting an existing
// window stays allocation-free.
const MAX_TRACKED_KEYS = 500;
const windows = new Map<string, { count: number; startedAt: number }>();

function allowed(request: Request) {
  // XFF is client-spoofable; accepted for this no-auth demo — the limiter only
  // blunts accidental hammering, it is not a security boundary.
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    if (!current && windows.size >= MAX_TRACKED_KEYS) {
      for (const [staleKey, window] of windows) {
        if (now - window.startedAt >= WINDOW_MS) windows.delete(staleKey);
      }
    }
    windows.set(key, { count: 1, startedAt: now });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS;
}

/** milestone20 not applied: missing skin_key column (42703 / PGRST204),
 *  missing companion_state table (PGRST205), or a pre-milestone20 CHECK
 *  rejecting the new keys (23514). */
function migrationMissing(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "23514" ||
    /could not find the '.+' column/i.test(error.message) ||
    /column .+ does not exist/i.test(error.message) ||
    /could not find the table/i.test(error.message) ||
    /violates check constraint/i.test(error.message)
  );
}

export async function POST(request: Request) {
  if (!allowed(request)) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const plantId = typeof input.plantId === "string" && input.plantId.trim() ? input.plantId.trim() : "plant-01";
  if (!VALID_PLANT.test(plantId)) return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });

  const supabase = getServerSupabase();
  if (!supabase) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });

  // Unlock gate reads bond_state only. Missing row, missing table, or a
  // transient read failure all degrade to level 1 — worst case a cosmetic
  // "locked" answer, never a crash and never a fabricated unlock.
  const bondResult = await supabase
    .from("bond_state")
    .select("bond_level")
    .eq("plant_id", plantId)
    .maybeSingle();
  const bondLevel =
    !bondResult.error && typeof bondResult.data?.bond_level === "number"
      ? bondResult.data.bond_level
      : 1;

  const decision = selectSkin(input.skinKey, bondLevel);
  if (!decision.ok) {
    // unknown_skin is a tampered/stale client (400); locked is a legitimate
    // game-state answer the UI renders (200).
    return Response.json(
      { ok: false, error: decision.error },
      { status: decision.error === "unknown_skin" ? 400 : 200 },
    );
  }
  const skinKey = decision.skin.key;

  // Update ONLY skin_key. .select() makes PostgREST return the touched rows
  // so a missing companion_state row is distinguishable from a clean update.
  const update = await supabase
    .from("companion_state")
    .update({ skin_key: skinKey })
    .eq("plant_id", plantId)
    .select("plant_id");
  if (update.error) {
    if (migrationMissing(update.error)) return Response.json({ ok: false, error: "migration_missing" }, { status: 200 });
    return Response.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  if (!update.data || update.data.length === 0) {
    // No companion row yet (fresh plant) — create one carrying only the skin
    // choice; DB defaults fill cycle/stage/form_key. The companion engine owns
    // every other column and this route must never race it with stale values.
    const insert = await supabase.from("companion_state").insert({ plant_id: plantId, skin_key: skinKey });
    if (insert.error) {
      if (migrationMissing(insert.error)) return Response.json({ ok: false, error: "migration_missing" }, { status: 200 });
      // 23505: the companion engine created the row between our update and
      // insert — the skin_key update is now safe to replay once.
      const retry = insert.error.code === "23505"
        ? await supabase.from("companion_state").update({ skin_key: skinKey }).eq("plant_id", plantId)
        : null;
      if (!retry || retry.error) return Response.json({ ok: false, error: "update_failed" }, { status: 500 });
    }
  }

  return Response.json({ ok: true, skinKey });
}
