import { fetchPlant } from "@/lib/plants";
import { getHomeMoodMessage } from "@/lib/plant-messages";

/**
 * GET /api/mood-message?plantId=… — the plant's current-mood line in its own
 * voice, for the static pixel-farm page (public/farm/live.js) which can't
 * import the server-only message helper directly.
 *
 * Delegates to getHomeMoodMessage: AI-personalized when ANTHROPIC_API_KEY is
 * set, deterministic personality template otherwise. The helper caches per
 * mood entry (handoff §24), so repeated calls for an unchanged mood cost at
 * most one AI call — and live.js additionally only fetches on mood change.
 *
 * Missing env/schema are setup states, not faults → 503 (game-tick's
 * pattern) so the page quietly keeps its hardcoded fallback bubble.
 */
export async function GET(request: Request) {
  let plantId = "plant-01";
  const requested = new URL(request.url).searchParams.get("plantId");
  if (requested && requested.length <= 64) plantId = requested;

  const result = await fetchPlant(plantId);
  if (result.status === "no-env") {
    return Response.json({ ok: false, error: "supabase_env_missing" }, { status: 503 });
  }
  if (result.status === "no-schema") {
    return Response.json(
      { ok: false, error: "schema_missing — run supabase/milestone1.sql" },
      { status: 503 },
    );
  }
  if (result.status === "not-found") {
    return Response.json({ ok: false, error: "plant_not_found" }, { status: 404 });
  }
  if (result.status !== "ok") {
    return Response.json({ ok: false }, { status: 500 });
  }

  // Always resolves to a displayable string; never throws (§24 contract).
  return Response.json({ message: await getHomeMoodMessage(result.plant) });
}
