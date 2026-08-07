// Badge engine — Phase 11 (handoff §18).
//
// Evaluates unlock conditions from live DB state and persists newly earned
// badges. Replay-safe: `plant_badges` has PK (plant_id, badge_key), so an
// on-conflict-ignore upsert tells us exactly which rows were inserted by
// THIS call — those are the newly unlocked badges. BADGE_UNLOCKED events
// are deduplicated by deterministic event_id (handoff §28).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeKey, BondEventRow, PlantBadgeRow, QuestKey } from "@/types/game";
import { BADGE_DEFINITIONS, RECOVERY_QUEST_KEYS } from "./badge-definitions";

/**
 * Evaluates all badge conditions for a plant, persists any earned badges,
 * and emits a BADGE_UNLOCKED bond event per newly unlocked badge.
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

  const { data: bond, error: bondError } = await supabase
    .from("bond_state")
    .select("bond_level")
    .eq("plant_id", plantId)
    .maybeSingle();
  if (bondError) {
    throw new Error(`badge-engine: failed to read bond_state: ${bondError.message}`);
  }
  const bondLevel: number = bond?.bond_level ?? 1;

  const earned: BadgeKey[] = [];
  if (recoveryCount >= 1) earned.push("FIRST_RESCUE");
  if (lightCount >= 5) earned.push("LIGHT_MASTER");
  if (bondLevel >= 5) earned.push("LEVEL_5_BOND");
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
  if (newlyUnlocked.length === 0) return [];

  const occurredAt = new Date().toISOString();
  const events: Array<Omit<BondEventRow, "created_at">> = newlyUnlocked.map((key) => ({
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
