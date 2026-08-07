// Read helpers for the UI pages (quests / collection / settings).
//
// Engine convention (handoff §26): every function takes the SupabaseClient as
// its FIRST parameter — the caller decides server-only-ness, tests can inject
// a fake client. These helpers only READ; on query errors they log and return
// a safe empty value so a page never white-screens during the demo
// (handoff §46 robustness). getPlant is the exception: it returns a
// discriminated result so the settings page can tell a transient DB error
// apart from a genuinely missing seed row.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMood, PLANT_MOODS, type PlantMood } from "@/types/events";
import type { PlantBadgeRow } from "@/types/game";
import type { Plant } from "@/types/plant";

// ── Growth stage (handoff §14 — manual in MVP) ──────────────────────────

export const GROWTH_STAGES = [
  "New Plant",
  "Settled",
  "Growing",
  "Thriving",
  "Mature",
] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

/** Case/space-insensitive match against GROWTH_STAGES ("growing" → "Growing"),
 *  or null when the value is not a known stage. */
export function normalizeGrowthStage(value: unknown): GrowthStage | null {
  const compact = typeof value === "string" ? value.trim().toLowerCase() : "";
  return GROWTH_STAGES.find((stage) => stage.toLowerCase() === compact) ?? null;
}

// ── Plants ──────────────────────────────────────────────────────────────

/** Mirrors lib/plants.ts fetchPlant, minus "no-env" (callers pass a client). */
export type PlantQueryResult =
  | { status: "ok"; plant: Plant }
  | { status: "not-found" }
  | { status: "no-schema" }
  | { status: "error"; message: string };

/** PostgREST's "table missing from schema cache" — the migrations haven't
 *  been run in this Supabase project yet. Duplicated from lib/plants.ts,
 *  which is server-only and can't be imported here. */
function isMissingTableError(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

export async function getPlant(
  supabase: SupabaseClient,
  plantId: string,
): Promise<PlantQueryResult> {
  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return { status: "no-schema" };
    console.error(`getPlant(${plantId}) failed:`, error.message);
    return { status: "error", message: error.message };
  }
  if (!data) return { status: "not-found" };
  return { status: "ok", plant: data as Plant };
}

// ── Mood collection (handoff §20, Phase 13) ─────────────────────────────

/**
 * Moods the plant has ever been observed in: every distinct
 * `data->>currentState` in the PLANT_STATE_CHANGED history, plus the live
 * `plants.current_state` (covers a fresh install whose seed row predates any
 * device event). Returned in canonical PLANT_MOODS order.
 */
export async function getSeenMoods(
  supabase: SupabaseClient,
  plantId: string,
): Promise<PlantMood[]> {
  const [eventsResult, plantResult] = await Promise.all([
    supabase
      .from("device_events")
      // Alias the jsonb text extraction so rows come back as { currentState }.
      .select("currentState:data->>currentState")
      .eq("plant_id", plantId)
      .eq("type", "PLANT_STATE_CHANGED")
      // State ENTRIES only (never sensor samples) — a demo-scale history sits
      // far below this cap, and 6 possible moods saturate long before it.
      .limit(5000),
    supabase.from("plants").select("current_state").eq("id", plantId).maybeSingle(),
  ]);

  const seen = new Set<PlantMood>();

  if (eventsResult.error) {
    console.error(`getSeenMoods(${plantId}) events query failed:`, eventsResult.error.message);
  } else {
    for (const row of (eventsResult.data ?? []) as { currentState: string | null }[]) {
      const mood = normalizeMood(row.currentState);
      if (mood) seen.add(mood);
    }
  }

  if (plantResult.error) {
    console.error(`getSeenMoods(${plantId}) plant query failed:`, plantResult.error.message);
  } else {
    const liveMood = normalizeMood(
      (plantResult.data as { current_state?: string } | null)?.current_state,
    );
    if (liveMood) seen.add(liveMood);
  }

  return PLANT_MOODS.filter((mood) => seen.has(mood));
}

// ── Badges (handoff §18) ────────────────────────────────────────────────

/** All badges this plant has unlocked, oldest first. */
export async function getUnlockedBadges(
  supabase: SupabaseClient,
  plantId: string,
): Promise<PlantBadgeRow[]> {
  const { data, error } = await supabase
    .from("plant_badges")
    .select("*")
    .eq("plant_id", plantId)
    .order("unlocked_at", { ascending: true });

  if (error) {
    console.error(`getUnlockedBadges(${plantId}) failed:`, error.message);
    return [];
  }
  return (data ?? []) as PlantBadgeRow[];
}
