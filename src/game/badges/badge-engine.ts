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
import { isMissingTableError } from "@/lib/supabase-errors";
import type { BadgeKey, BondEventRow, PlantBadgeRow, QuestKey } from "@/types/game";
import { normalizeMood, PLANT_MOODS, type PlantMood } from "@/types/events";
import { BADGE_DEFINITIONS, RECOVERY_QUEST_KEYS } from "./badge-definitions";

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
  // All seven reads below are independent of each other (each depends only on
  // plantId), so they are issued in ONE parallel batch — a single round-trip
  // time instead of six sequential ones. Results are validated in the same
  // order the old sequential code checked them, with identical messages.
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    questsResult,
    bondResult,
    recentEventsResult,
    soilEventsResult,
    moodEventsResult,
    moodPlantResult,
    growthRecordsResult,
  ] = await Promise.all([
    // One read covers every quest-based condition (recovery, light, cool,
    // humidity, and the total-completed count) — fetch quest_key of every
    // COMPLETED row once and count each condition in TS instead of adding a
    // query per badge.
    supabase.from("quests").select("quest_key").eq("plant_id", plantId).eq("status", "COMPLETED"),
    // bond_level covers LEVEL_5_BOND; longest_streak (not current_streak)
    // covers STREAK_7 so a later broken streak can never un-earn an
    // already-earned badge — same reasoning as the story engine's chapter 3
    // (handoff §19).
    supabase
      .from("bond_state")
      .select("bond_level, longest_streak")
      .eq("plant_id", plantId)
      .maybeSingle(),
    // PH_GUARDIAN inputs: sustained healthy soil, not repeated repair
    // (handoff §18) — at least one device event in the last 7 days, and none
    // of them a PLANT_STATE_CHANGED entry into SoilAcidic/SoilAlkaline. Two
    // cheap head:true counts instead of fetching rows.
    supabase
      .from("device_events")
      .select("event_id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .gte("occurred_at", sevenDaysAgoIso),
    supabase
      .from("device_events")
      .select("event_id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .eq("type", "PLANT_STATE_CHANGED")
      .in("data->>currentState", ["SoilAcidic", "SoilAlkaline"])
      .gte("occurred_at", sevenDaysAgoIso),
    // MOOD_SCHOLAR inputs: every distinct mood ever observed, mirroring
    // lib/queries.ts's getSeenMoods (query duplicated here rather than
    // imported so this engine stays self-contained) — every distinct
    // PLANT_STATE_CHANGED data->>currentState, plus
    // the live plants.current_state (covers a fresh seed row predating any
    // event).
    supabase
      .from("device_events")
      .select("currentState:data->>currentState")
      .eq("plant_id", plantId)
      .eq("type", "PLANT_STATE_CHANGED")
      .limit(5000),
    supabase.from("plants").select("current_state").eq("id", plantId).maybeSingle(),
    // CHRONICLER input: growth records logged for this plant. head:true
    // count; a not-yet-migrated schema (growth_records table missing) is
    // tolerated below by treating it as zero, same as lib/growth.ts's
    // fetchGrowthRecords.
    supabase
      .from("growth_records")
      .select("id", { count: "exact", head: true })
      .eq("plant_id", plantId),
  ]);

  if (questsResult.error) {
    throw new Error(`badge-engine: failed to read quests: ${questsResult.error.message}`);
  }
  const completedQuests = (questsResult.data ?? []) as Array<{ quest_key: QuestKey }>;
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

  if (bondResult.error) {
    throw new Error(`badge-engine: failed to read bond_state: ${bondResult.error.message}`);
  }
  const bond = bondResult.data as { bond_level?: number; longest_streak?: number } | null;
  const bondLevel: number = bond?.bond_level ?? 1;
  const longestStreak: number = bond?.longest_streak ?? 0;

  if (recentEventsResult.error) {
    throw new Error(
      `badge-engine: failed to count recent device_events: ${recentEventsResult.error.message}`,
    );
  }
  if (soilEventsResult.error) {
    throw new Error(
      `badge-engine: failed to count recent soil device_events: ${soilEventsResult.error.message}`,
    );
  }
  const phGuardian =
    (recentEventsResult.count ?? 0) >= 1 && (soilEventsResult.count ?? 0) === 0;

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

  if (growthRecordsResult.error && !isMissingTableError(growthRecordsResult.error)) {
    throw new Error(
      `badge-engine: failed to count growth_records: ${growthRecordsResult.error.message}`,
    );
  }
  const growthRecordsTotal = growthRecordsResult.error ? 0 : (growthRecordsResult.count ?? 0);

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
