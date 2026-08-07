// Badge engine — Phase 11 (handoff §18).
//
// Evaluates unlock conditions from live DB state and persists newly earned
// badges. Replay-safe: `plant_badges` has PK (plant_id, badge_key), so an
// on-conflict-ignore upsert tells us exactly which rows were inserted by
// THIS call — those are the newly unlocked badges. BADGE_UNLOCKED events
// are emitted for every currently-earned badge and deduplicated by
// deterministic event_id (handoff §28), so a crash between the badge upsert
// and the emission self-heals on the next call.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeKey, BondEventRow, PlantBadgeRow, QuestKey } from "@/types/game";
import { normalizeMood, PLANT_MOODS, type PlantMood } from "@/types/events";
import { BADGE_DEFINITIONS, RECOVERY_QUEST_KEYS } from "./badge-definitions";

/** PostgREST's "table missing from schema cache" — the migration hasn't been
 *  run in this Supabase project yet. Duplicated from lib/plants.ts (same
 *  reasoning as its other duplicates in lib/queries.ts / lib/growth.ts): this
 *  engine stays self-contained rather than importing server-only helpers. */
function isMissingTableError(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

/**
 * Evaluates all badge conditions for a plant, persists any earned badges,
 * and emits a BADGE_UNLOCKED bond event per earned badge (deduplicated by
 * deterministic event_id, so already-emitted events are no-ops).
 *
 * @returns the badge keys newly unlocked by this call (empty on replays).
 */
export async function evaluateBadges(
  supabase: SupabaseClient,
  plantId: string,
): Promise<BadgeKey[]> {
  // One read covers every quest-based condition (recovery, light, cool,
  // humidity, and the total-completed count) — fetch quest_key of every
  // COMPLETED row once and count each condition in TS instead of adding a
  // query per badge.
  const { data: questRows, error: questError } = await supabase
    .from("quests")
    .select("quest_key")
    .eq("plant_id", plantId)
    .eq("status", "COMPLETED");
  if (questError) {
    throw new Error(`badge-engine: failed to read quests: ${questError.message}`);
  }
  const completedQuests = (questRows ?? []) as Array<{ quest_key: QuestKey }>;
  const totalCompletedCount = completedQuests.length;
  const completedRecovery = completedQuests.filter((row) =>
    (RECOVERY_QUEST_KEYS as readonly QuestKey[]).includes(row.quest_key),
  );
  const recoveryCount = completedRecovery.length;
  const lightCount = completedQuests.filter(
    (row) => row.quest_key === "GIVE_ME_MORE_LIGHT",
  ).length;
  const coolCount = completedQuests.filter(
    (row) => row.quest_key === "COOL_ME_DOWN",
  ).length;
  const humidifyCount = completedQuests.filter(
    (row) => row.quest_key === "HUMIDIFY_MY_AIR",
  ).length;

  // bond_level covers LEVEL_5_BOND; longest_streak (not current_streak) covers
  // STREAK_7 so a later broken streak can never un-earn an already-earned
  // badge — same reasoning as the story engine's chapter 3 (handoff §19).
  const { data: bond, error: bondError } = await supabase
    .from("bond_state")
    .select("bond_level, longest_streak")
    .eq("plant_id", plantId)
    .maybeSingle();
  if (bondError) {
    throw new Error(`badge-engine: failed to read bond_state: ${bondError.message}`);
  }
  const bondLevel: number = bond?.bond_level ?? 1;
  const longestStreak: number = bond?.longest_streak ?? 0;

  // PH_GUARDIAN: sustained healthy soil, not repeated repair (handoff §18) —
  // at least one device event in the last 7 days, and none of them are a
  // PLANT_STATE_CHANGED entry into SoilAcidic/SoilAlkaline. Two cheap
  // head:true counts instead of fetching rows.
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentEventCount, error: recentEventsError } = await supabase
    .from("device_events")
    .select("event_id", { count: "exact", head: true })
    .eq("plant_id", plantId)
    .gte("occurred_at", sevenDaysAgoIso);
  if (recentEventsError) {
    throw new Error(
      `badge-engine: failed to count recent device_events: ${recentEventsError.message}`,
    );
  }
  const { count: soilEventCount, error: soilEventsError } = await supabase
    .from("device_events")
    .select("event_id", { count: "exact", head: true })
    .eq("plant_id", plantId)
    .eq("type", "PLANT_STATE_CHANGED")
    .in("data->>currentState", ["SoilAcidic", "SoilAlkaline"])
    .gte("occurred_at", sevenDaysAgoIso);
  if (soilEventsError) {
    throw new Error(
      `badge-engine: failed to count recent soil device_events: ${soilEventsError.message}`,
    );
  }
  const phGuardian = (recentEventCount ?? 0) >= 1 && (soilEventCount ?? 0) === 0;

  // MOOD_SCHOLAR: every distinct mood ever observed, mirroring
  // lib/queries.ts's getSeenMoods (duplicated here rather than imported so
  // this engine stays self-contained — see the isMissingTableError comment
  // above) — every distinct PLANT_STATE_CHANGED data->>currentState, plus the
  // live plants.current_state (covers a fresh seed row predating any event).
  const [moodEventsResult, moodPlantResult] = await Promise.all([
    supabase
      .from("device_events")
      .select("currentState:data->>currentState")
      .eq("plant_id", plantId)
      .eq("type", "PLANT_STATE_CHANGED")
      .limit(5000),
    supabase.from("plants").select("current_state").eq("id", plantId).maybeSingle(),
  ]);
  if (moodEventsResult.error) {
    throw new Error(
      `badge-engine: failed to read device_events for moods: ${moodEventsResult.error.message}`,
    );
  }
  if (moodPlantResult.error) {
    throw new Error(
      `badge-engine: failed to read plants for moods: ${moodPlantResult.error.message}`,
    );
  }
  const seenMoods = new Set<PlantMood>();
  for (const row of (moodEventsResult.data ?? []) as Array<{ currentState: string | null }>) {
    const mood = normalizeMood(row.currentState);
    if (mood) seenMoods.add(mood);
  }
  const liveMood = normalizeMood(
    (moodPlantResult.data as { current_state?: string } | null)?.current_state,
  );
  if (liveMood) seenMoods.add(liveMood);
  const moodScholar = PLANT_MOODS.every((mood) => seenMoods.has(mood));

  // CHRONICLER: growth records logged for this plant. head:true count;
  // tolerate a not-yet-migrated schema (growth_records table missing) by
  // treating it as zero, same as lib/growth.ts's fetchGrowthRecords.
  const { count: growthRecordCount, error: growthRecordsError } = await supabase
    .from("growth_records")
    .select("id", { count: "exact", head: true })
    .eq("plant_id", plantId);
  if (growthRecordsError && !isMissingTableError(growthRecordsError)) {
    throw new Error(
      `badge-engine: failed to count growth_records: ${growthRecordsError.message}`,
    );
  }
  const growthRecordsTotal = growthRecordsError ? 0 : (growthRecordCount ?? 0);

  const earned: BadgeKey[] = [];
  if (recoveryCount >= 1) earned.push("FIRST_RESCUE");
  if (lightCount >= 5) earned.push("LIGHT_MASTER");
  if (bondLevel >= 5) earned.push("LEVEL_5_BOND");
  if (coolCount >= 5) earned.push("COOL_KEEPER");
  if (longestStreak >= 7) earned.push("STREAK_7");
  if (phGuardian) earned.push("PH_GUARDIAN");
  if (humidifyCount >= 5) earned.push("HUMIDITY_HERO");
  if (moodScholar) earned.push("MOOD_SCHOLAR");
  if (totalCompletedCount >= 25) earned.push("CARE_VETERAN");
  if (growthRecordsTotal >= 5) earned.push("CHRONICLER");
  if (longestStreak >= 30) earned.push("STREAK_30");
  if (bondLevel >= 10) earned.push("LEVEL_10_BOND");
  if (earned.length === 0) return [];

  // Ignore-duplicates upsert + select: only rows actually inserted come back,
  // so already-owned badges (replays) drop out here.
  const rows: Array<Pick<PlantBadgeRow, "plant_id" | "badge_key">> = earned.map(
    (key) => ({ plant_id: plantId, badge_key: key }),
  );
  const { data: inserted, error: insertError } = await supabase
    .from("plant_badges")
    .upsert(rows, { onConflict: "plant_id,badge_key", ignoreDuplicates: true })
    .select("badge_key");
  if (insertError) {
    throw new Error(`badge-engine: failed to upsert plant_badges: ${insertError.message}`);
  }

  const newlyUnlocked = ((inserted ?? []) as Array<{ badge_key: BadgeKey }>).map(
    (row) => row.badge_key,
  );

  // Emit for EVERY currently-earned badge, not just newly inserted rows: if a
  // prior call crashed between the badge upsert and this emission, the badge
  // row exists but its event was lost — and a newness-gated emit would never
  // retry it. The deterministic event_id makes repeat emissions no-ops, so
  // re-emitting here heals that gap on the next evaluateBadges call.
  const occurredAt = new Date().toISOString();
  const events: Array<Omit<BondEventRow, "created_at">> = earned.map((key) => ({
    event_id: `badge:${plantId}:${key}`,
    plant_id: plantId,
    type: "BADGE_UNLOCKED",
    occurred_at: occurredAt,
    data: { badgeKey: key, name: BADGE_DEFINITIONS[key].name },
  }));
  const { error: eventError } = await supabase
    .from("bond_events")
    .upsert(events, { onConflict: "event_id", ignoreDuplicates: true });
  if (eventError) {
    throw new Error(`badge-engine: failed to emit bond_events: ${eventError.message}`);
  }

  return newlyUnlocked;
}
