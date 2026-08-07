import { runGameTick } from "@/game/events/event-router";

/**
 * POST /api/game-tick — evaluates timestamp-based quest progress for the
 * plant. Called periodically by the home screen so time-window quests
 * ("stable for 5 minutes") complete promptly even when no device event
 * arrives. Purely a lazy re-evaluation of persisted timestamps: idempotent,
 * grants nothing that the timestamps don't already prove, safe to call
 * without auth.
 */
export async function POST(request: Request) {
  let plantId = "plant-01";
  try {
    const body = await request.json();
    if (typeof body?.plantId === "string" && body.plantId.length <= 64) {
      plantId = body.plantId;
    }
  } catch {
    // empty body → default plant
  }

  try {
    await runGameTick(plantId);
  } catch (error) {
    // Missing tables = migrations not run yet; a setup state, not a fault.
    if (error instanceof Error && /could not find the table/i.test(error.message)) {
      return Response.json(
        { ok: false, error: "schema_missing — run supabase/milestone1.sql and milestone3.sql" },
        { status: 503 },
      );
    }
    console.error("game-tick failed:", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
