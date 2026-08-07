import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizeMood, type DeviceEvent, type PlantMood } from "@/types/events";
import type { QuestEngineResult, QuestRow } from "@/types/game";
import { evaluateQuests, handleStateChange } from "@/game/quests/quest-engine";
import { awardXp } from "@/game/progression/xp-engine";
import { recordQualifyingCare } from "@/game/progression/streak-engine";
import { evaluateBadges } from "@/game/badges/badge-engine";
import { evaluateChapters } from "@/game/story/story-engine";
import { applySeasonalMultiplier } from "@/game/seasonal/seasonal-events";

/**
 * Game Event Processor (handoff §25): the single orchestration point where a
 * validated device event becomes game progression. Every step below is
 * idempotent (rewardKey ledger, status-guarded transitions, monotonic
 * chapters, PK-guarded badges), so replays and Node-RED retries are safe.
 */

async function settleCompletions(
  supabase: SupabaseClient,
  plantId: string,
  completed: QuestRow[],
): Promise<void> {
  for (const quest of completed) {
    const completedAt = quest.completed_at ? new Date(quest.completed_at) : new Date();
    // Seasonal XP bonus (§23) — highest active multiplier, no stacking.
    const { amount } = applySeasonalMultiplier(quest.xp_reward, completedAt);
    // rewardKey per handoff §28 — a replayed completion can never double-award.
    await awardXp(supabase, plantId, `quest:${quest.id}:completion`, amount, quest.quest_key);
    // Streak counts days with at least one qualifying care quest (§21).
    await recordQualifyingCare(supabase, plantId, completedAt.toISOString());
  }

  // Badges and story react to the new progression state; cheap enough to
  // evaluate on every settle, and both are replay-safe.
  await evaluateBadges(supabase, plantId);
  await evaluateChapters(supabase, plantId);
}

/** Processes one persisted device event through the game engine. */
export async function processDeviceEvent(event: DeviceEvent): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  let result: QuestEngineResult;
  if (event.type === "PLANT_STATE_CHANGED") {
    const currentState = normalizeMood(event.data.currentState) as PlantMood;
    const previousState = normalizeMood(event.data.previousState);
    result = await handleStateChange(
      supabase,
      event.plantId,
      previousState,
      currentState,
      event.occurredAt,
    );
  } else {
    // SENSOR_* / PLANT_RECOVERED don't drive quests directly in MVP, but the
    // lazy sweep still gets a chance to land time-based completions.
    result = await evaluateQuests(supabase, event.plantId);
  }

  await settleCompletions(supabase, event.plantId, result.completed);
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

  const result = await evaluateQuests(supabase, plantId);
  await settleCompletions(supabase, plantId, result.completed);
}
