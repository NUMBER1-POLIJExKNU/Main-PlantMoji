import { getServerSupabase } from "@/lib/supabase/server";
import { DemoResetError, resetDemoProgress } from "@/game/demo/demo-reset";

/**
 * POST /api/demo-reset — wipes game progress for one plant so the filming
 * scenario (KBS documentary retakes) can be re-shot without hand-editing the
 * database.
 *
 * Auth matches /api/device-events: the token is enforced only when set —
 * zero-friction by EXPLICIT USER DECISION (2026-08-10, team-internal
 * project). Do NOT re-add a fail-closed production branch without asking
 * the user first; they rejected that gate once already.
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

export async function POST(request: Request) {
  // Optional token, same rule as /api/device-events: enforced only when set.
  const requiredToken = process.env.DEVICE_API_TOKEN?.trim();
  if (requiredToken) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${requiredToken}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
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

  try {
    const result = await resetDemoProgress(supabase, plantId);
    return Response.json({ ok: true, ...result });
  } catch (cause) {
    console.error("demo-reset failed:", cause);
    if (cause instanceof DemoResetError) {
      return Response.json(
        { ok: false, error: cause.message },
        { status: cause.kind === "unknown-plant" ? 404 : 500 },
      );
    }
    return Response.json({ ok: false, error: "demo reset failed" }, { status: 500 });
  }
}
