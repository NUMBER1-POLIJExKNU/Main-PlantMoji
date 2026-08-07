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
  // One read covers both quest-based conditions.
  const { data: questRows, error: questError } = await supabase
    .from("quests")
    .select("quest_key")
    .eq("plant_id", plantId)
    .eq("status", "COMPLETED")
    .in("quest_key", [...RECOVERY_QUEST_KEYS]);
  if (questError) {
    throw new Error(`badge-engine: failed to read quests: ${questError.message}`);
  }
  const completedRecovery = (questRows ?? []) as Array<{ quest_key: QuestKey }>;
  const recoveryCount = completedRecovery.length;
  const lightCount = completedRecovery.filter(
    (row) => row.quest_key === "GIVE_ME_MORE_LIGHT",
  ).length;
  const coolCount = completedRecovery.filter(
    (row) => row.quest_key === "COOL_ME_DOWN",
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

  const earned: BadgeKey[] = [];
  if (recoveryCount >= 1) earned.push("FIRST_RESCUE");
  if (lightCount >= 5) earned.push("LIGHT_MASTER");
  if (bondLevel >= 5) earned.push("LEVEL_5_BOND");
  if (coolCount >= 5) earned.push("COOL_KEEPER");
  if (longestStreak >= 7) earned.push("STREAK_7");
  if (phGuardian) earned.push("PH_GUARDIAN");
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
