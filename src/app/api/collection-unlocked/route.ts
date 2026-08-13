import { getServerSupabase } from "@/lib/supabase/server";
import { getPlant, getSeenMoods, getUnlockedBadges } from "@/lib/queries";
import { isMissingTableError } from "@/lib/supabase-errors";
import type { BadgeKey } from "@/types/game";
import type { PlantMood } from "@/types/events";

/**
 * GET /api/collection-unlocked?plantId= — feeds the Flutter "Collection"
 * screen AND the "Ikatan Lv." badge on the home screen, in one call (the
 * mobile app polls this alongside sensor-history, so keeping it to a single
 * round trip matters).
 *
 * Response: { unlockedIds: string[], level: number, totalXp: number,
 *             currentStreak: number }
 *
 * `unlockedIds` mixes four kinds of progress, all read from tables the WEB
 * app already writes to — nothing here is mobile-only state:
 *  - moods   → src/types/events.ts PLANT_MOODS, via getSeenMoods()
 *  - badges  → `plant_badges` table, via getUnlockedBadges()
 *  - story   → `bond_state.current_chapter` (chapter 1 unlocks at
 *              registration/first launch, so story_1 is included whenever
 *              the plant row exists)
 *  - wisdom  → heuristic: wisdom_1 unlocks once the caretaker has earned at
 *              least one badge. There's no dedicated "wisdom unlocked" table
 *              yet (farmer-wisdom.ts is static content) — adjust this rule
 *              freely if the web side grows real wisdom-unlock tracking.
 *
 * `level` is `bond_state.bond_level` — the SAME number the web app shows,
 * so the plant's growth stage on both sides always agrees.
 */

// Flutter's CollectionItem ids (see main.dart's `_moods` / `_badges` lists).
const MOOD_TO_ID: Partial<Record<PlantMood, string>> = {
  Happy: "comfort",
  Overheating: "overheat",
  TooCold: "too_cold",
  DryAir: "dry_air",
  Sleepy: "low_light",
  SoilAcidic: "soil_acidic",
  SoilAlkaline: "soil_alkaline",
  HumidAir: "humidity_locked", // only real backing for that tile so far
};

const BADGE_TO_ID: Partial<Record<BadgeKey, string>> = {
  FIRST_RESCUE: "badge_1",
  STREAK_7: "badge_2",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("plantId");
  const plantId =
    requested && /^[A-Za-z0-9_-]{1,64}$/.test(requested) ? requested : "plant-01";

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  }

  const [plantResult, moods, badges, bondResult] = await Promise.all([
    getPlant(supabase, plantId),
    getSeenMoods(supabase, plantId),
    getUnlockedBadges(supabase, plantId),
    supabase
      .from("bond_state")
      .select("bond_level, total_xp, current_streak, current_chapter")
      .eq("plant_id", plantId)
      .maybeSingle(),
  ]);

  if (bondResult.error && !isMissingTableError(bondResult.error)) {
    console.error("collection-unlocked bond_state query failed:", bondResult.error.message);
  }

  const unlockedIds = new Set<string>();
  for (const mood of moods) {
    const id = MOOD_TO_ID[mood];
    if (id) unlockedIds.add(id);
  }
  for (const badge of badges) {
    const id = BADGE_TO_ID[badge.badge_key];
    if (id) unlockedIds.add(id);
  }
  if (plantResult.status === "ok") {
    unlockedIds.add("story_1"); // chapter 1 is always unlocked once the plant exists
    if (badges.length >= 1) unlockedIds.add("wisdom_1");
  }

  const level = bondResult.data?.bond_level ?? 1;
  const totalXp = bondResult.data?.total_xp ?? 0;
  const currentStreak = bondResult.data?.current_streak ?? 0;

  return Response.json({
    unlockedIds: Array.from(unlockedIds),
    level,
    totalXp,
    currentStreak,
  });
}
