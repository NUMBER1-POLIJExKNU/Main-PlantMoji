import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizeMood, type DeviceEvent, type PlantMood } from "@/types/events";
import type { QuestRow } from "@/types/game";
import { evaluateQuests, handleStateChange } from "@/game/quests/quest-engine";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { awardXp } from "@/game/progression/xp-engine";
import { recordQualifyingCare } from "@/game/progression/streak-engine";
import { evaluateBadges } from "@/game/badges/badge-engine";
import { evaluateChapters } from "@/game/story/story-engine";
import { applySeasonalMultiplier } from "@/game/seasonal/seasonal-events";

/**
 * Game Event Processor (handoff §25): the single orchestration point where a
 * validated device event becomes game progression. Every step is idempotent
 * (rewardKey ledger, status-guarded transitions, monotonic chapters,
 * PK-guarded badges), so replays and Node-RED retries are safe.
 */

const rewardKeyFor = (quest: QuestRow) => `quest:${quest.id}:completion`;

/**
 * Settlement is derived from PERSISTED state, not from the in-memory list of
 * quests completed by this invocation: every COMPLETED quest whose rewardKey
 * is missing from the xp_rewards ledger gets settled. A crash after the
 * COMPLETED transition but before the XP award therefore heals on the next
 * event or tick instead of losing the reward forever.
 *
 * Write order per quest — the xp_rewards insert (inside award_xp) is the
 * LAST step and acts as the settlement marker:
 *   1. heal the QUEST_COMPLETED bond event (idempotent upsert)
 *   2. streak credit (idempotent per calendar day)
 *   3. awardXp (idempotent by rewardKey; marks the quest settled)
 */
async function settleCompletions(supabase: SupabaseClient, plantId: string): Promise<void> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("plant_id", plantId)
    .eq("status", "COMPLETED")
    .order("completed_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(`event-router: fetch completed quests failed: ${error.message}`);
  }

  // Oldest first so a batch spanning midnight extends the streak in
  // chronological order.
  const completed = ((data as QuestRow[]) ?? []).reverse();

  if (completed.length > 0) {
    const keys = completed.map(rewardKeyFor);
    const { data: rewardRows, error: rewardsError } = await supabase
      .from("xp_rewards")
      .select("reward_key")
      .in("reward_key", keys);
    if (rewardsError) {
      throw new Error(`event-router: fetch xp_rewards failed: ${rewardsError.message}`);
    }
    const settled = new Set((rewardRows ?? []).map((row) => row.reward_key as string));

    for (const quest of completed) {
      if (settled.has(rewardKeyFor(quest))) continue;
      const completedAt = quest.completed_at ? new Date(quest.completed_at) : new Date();
      const def = QUEST_DEFINITIONS[quest.quest_key];

      const { error: eventError } = await supabase.from("bond_events").upsert(
        {
          event_id: `quest:${quest.id}:completed`,
          plant_id: plantId,
          type: "QUEST_COMPLETED",
          occurred_at: completedAt.toISOString(),
          data: {
            questKey: quest.quest_key,
            title: def?.title ?? quest.quest_key,
            xpReward: quest.xp_reward,
          },
        },
        { onConflict: "event_id", ignoreDuplicates: true },
      );
      if (eventError) {
        throw new Error(`event-router: heal QUEST_COMPLETED failed: ${eventError.message}`);
      }

      // Streak counts days with at least one qualifying care quest (§21).
      await recordQualifyingCare(supabase, plantId, completedAt.toISOString());

      // Seasonal XP bonus (§23) — highest active multiplier, no stacking.
      const { amount } = applySeasonalMultiplier(quest.xp_reward, completedAt);
      // rewardKey per handoff §28 — a replay can never double-award.
      await awardXp(supabase, plantId, rewardKeyFor(quest), amount, quest.quest_key);
    }
  }

  // Badges and story react to the new progression state; cheap enough to
  // evaluate on every settle, and both are replay-safe.
  await evaluateBadges(supabase, plantId);
  await evaluateChapters(supabase, plantId);
}

export interface ProcessOptions {
  /**
   * Whether the route's guarded plants update accepted this event as fresh.
   * A stale PLANT_STATE_CHANGED (out-of-order retry superseded by a newer
   * state) must NOT drive the quest state machine with its outdated mood —
   * only the lazy sweep runs for it.
   */
  stateApplied?: boolean;
}

/** Processes one persisted device event through the game engine. */
export async function processDeviceEvent(
  event: DeviceEvent,
  options: ProcessOptions = {},
): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  if (event.type === "PLANT_STATE_CHANGED" && options.stateApplied !== false) {
    const currentState = normalizeMood(event.data.currentState) as PlantMood;
    const previousState = normalizeMood(event.data.previousState);
    await handleStateChange(
      supabase,
      event.plantId,
      previousState,
      currentState,
      event.occurredAt,
      event.data,
    );
  } else {
    // Stale state events and SENSOR_*/PLANT_RECOVERED still get the lazy
    // sweep so time-based completions land.
    await evaluateQuests(supabase, event.plantId);
  }

  await settleCompletions(supabase, event.plantId);
}

/**
 * Lazy timestamp sweep without a device event — called from page loads and
 * the periodic browser tick so "stay stable for N minutes" quests complete
 * even when no new sensor event arrives (handoff Correction 4: timestamps,
 * never server timers).
 */
export async function runGameTick(plantId: string): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  await evaluateQuests(supabase, plantId);
  await settleCompletions(supabase, plantId);
}
