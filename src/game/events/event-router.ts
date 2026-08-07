import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizeMood, type DeviceEvent, type PlantMood } from "@/types/events";
import type { BadgeKey, QuestRow } from "@/types/game";
import { evaluateQuests, handleStateChange } from "@/game/quests/quest-engine";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { awardXp, getBondState } from "@/game/progression/xp-engine";
import {
  BADGE_BONUS_XP,
  CHAPTER_BONUS_XP,
  MOOD_DISCOVERY_XP,
  STREAK_MILESTONE_XP,
  badgeRewardKey,
  chapterRewardKey,
  milestonesReached,
  moodRewardKey,
  streakMilestoneRewardKey,
} from "@/game/progression/bonus-xp";
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
      const streak = await recordQualifyingCare(supabase, plantId, completedAt.toISOString());

      // Streak milestone bonuses: award EVERY milestone at or below the
      // current streak on every settle — milestonesReached(0, n) lists all of
      // them, and the reward_key ledger turns repeats into no-ops. That makes
      // the sweep idempotent AND self-healing: a crash after the streak
      // credit but before an award is repaired by the next settle.
      for (const days of milestonesReached(0, streak.currentStreak)) {
        await awardXp(
          supabase,
          plantId,
          streakMilestoneRewardKey(plantId, days),
          STREAK_MILESTONE_XP,
          `streak-milestone:${days}`,
        );
      }

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

  // Badge bonus XP — driven by PERSISTED unlocks, not by the evaluators'
  // "newly unlocked" return values: a crash between the badge insert and a
  // newness-gated award would orphan that bonus forever. Re-awarding every
  // unlocked badge each settle (≤12 rows) is a no-op via the reward_key
  // ledger and heals any such gap.
  const { data: badgeRows, error: badgeError } = await supabase
    .from("plant_badges")
    .select("badge_key")
    .eq("plant_id", plantId);
  if (badgeError) {
    throw new Error(`event-router: fetch plant_badges failed: ${badgeError.message}`);
  }
  for (const row of (badgeRows ?? []) as Array<{ badge_key: BadgeKey }>) {
    await awardXp(
      supabase,
      plantId,
      badgeRewardKey(plantId, row.badge_key),
      BADGE_BONUS_XP,
      `badge:${row.badge_key}`,
    );
  }

  // Chapter bonus XP — same self-healing sweep, driven by the monotonic
  // bond_state.current_chapter. No bond_state row means no progression has
  // ever been recorded, so there is nothing to reward yet.
  const bondState = await getBondState(supabase, plantId);
  if (bondState) {
    for (let chapter = 1; chapter <= bondState.current_chapter; chapter += 1) {
      await awardXp(
        supabase,
        plantId,
        chapterRewardKey(plantId, chapter),
        CHAPTER_BONUS_XP,
        `chapter:${chapter}`,
      );
    }
  }

  // The bonus XP above can raise bond_level, which can itself unlock LEVEL_*
  // badges and level-gated chapters — but the evaluators ran BEFORE those
  // awards landed. Re-run both (replay-safe) so level-triggered unlocks land
  // in this tick instead of the next one; their own bonus XP is picked up by
  // the next settle's self-healing sweeps, which keeps the cascade bounded.
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

    // Mood discovery bonus: the first time this plant ever shows a mood is a
    // verified device outcome (§17). No seen-mood table or pre-check query —
    // the xp_rewards row written under the deterministic moodRewardKey IS the
    // discovery ledger, so replays and repeat moods are no-ops forever (§28).
    await awardXp(
      supabase,
      event.plantId,
      moodRewardKey(event.plantId, currentState),
      MOOD_DISCOVERY_XP,
      `mood:${currentState}`,
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
