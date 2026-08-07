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
import { dayString, recordQualifyingCare } from "@/game/progression/streak-engine";
import { evaluateBadges } from "@/game/badges/badge-engine";
import { evaluateChapters } from "@/game/story/story-engine";
import { applySeasonalMultiplier } from "@/game/seasonal/seasonal-events";
import {
  dailyBoostMultiplier,
  dailyChallengeRewardKey,
  getDailyEvent,
  wibHour,
} from "@/game/random/daily-events";
import { isLuckyQuest, luckyRewardKey } from "@/game/random/lucky";

/**
 * Game Event Processor (handoff §25): the single orchestration point where a
 * validated device event becomes game progression. Every step is idempotent
 * (rewardKey ledger, status-guarded transitions, monotonic chapters,
 * PK-guarded badges), so replays and Node-RED retries are safe.
 */

const rewardKeyFor = (quest: QuestRow) => `quest:${quest.id}:completion`;

const DAY_MS = 86_400_000;

/** PostgREST's "table missing from schema cache" — the migration hasn't been
 *  run in this Supabase project yet. Duplicated from badge-engine.ts (which
 *  duplicates lib/plants.ts) for the same reason: this router stays
 *  self-contained rather than importing server-only helpers. */
function isMissingTableError(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

/**
 * Verifies today's daily challenge (if today IS a challenge day for this
 * plant) against PERSISTED data and awards its XP when the condition holds.
 *
 * Same design as every other sweep in this router — idempotent AND
 * self-healing: it re-checks on every settle, and the deterministic
 * dailyChallengeRewardKey makes repeat awards no-ops (§28). §23 discipline:
 * every condition below is a verified outcome read from the database — no
 * award is ever based on an assumed or fabricated plant state.
 */
async function settleDailyChallenge(supabase: SupabaseClient, plantId: string): Promise<void> {
  const now = new Date();
  const event = getDailyEvent(plantId, now);
  if (event.kind !== "daily_challenge" || !event.challengeXp) return;

  // Today's WIB calendar day as a half-open UTC instant range
  // [00:00, next 00:00) — WIB is fixed-offset (no DST), so +24h is exact.
  const today = dayString(now);
  const dayStartMs = Date.parse(`${today}T00:00:00+07:00`);
  const dayStartIso = new Date(dayStartMs).toISOString();
  const dayEndIso = new Date(dayStartMs + DAY_MS).toISOString();

  let satisfied = false;

  if (event.id === "JOURNAL_DAY") {
    // A growth record logged on today's WIB date. Tolerate a not-yet-migrated
    // schema (growth_records table missing) by skipping — no data, no claim.
    const { count, error } = await supabase
      .from("growth_records")
      .select("id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .gte("recorded_at", dayStartIso)
      .lt("recorded_at", dayEndIso);
    if (error) {
      if (isMissingTableError(error)) return;
      throw new Error(`event-router: daily challenge growth_records failed: ${error.message}`);
    }
    satisfied = (count ?? 0) >= 1;
  } else if (event.id === "QUEST_FINISHER") {
    // Any quest completed on today's WIB date.
    const { count, error } = await supabase
      .from("quests")
      .select("id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .eq("status", "COMPLETED")
      .gte("completed_at", dayStartIso)
      .lt("completed_at", dayEndIso);
    if (error) {
      throw new Error(`event-router: daily challenge quests failed: ${error.message}`);
    }
    satisfied = (count ?? 0) >= 1;
  } else if (event.id === "STEADY_DAY") {
    // Award only after the daytime window (WIB 06:00–18:00) is fully over —
    // never claim "you stayed steady all day" while the day could still sour.
    if (wibHour(now) < 18) return;

    // No data, no claim (§23): require at least one device event today so a
    // dead pipeline can't masquerade as a perfectly steady plant...
    const { count: anyToday, error: anyError } = await supabase
      .from("device_events")
      .select("event_id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .gte("occurred_at", dayStartIso)
      .lt("occurred_at", dayEndIso);
    if (anyError) {
      throw new Error(`event-router: daily challenge device_events failed: ${anyError.message}`);
    }

    // ...and zero PLANT_STATE_CHANGED entries into a non-Happy mood during
    // the daytime window. currentState is normalized to canonical casing at
    // the trust boundary (parseDeviceEvent), so an exact 'Happy' compare is
    // safe — same convention as badge-engine's soil-event count.
    const windowStartIso = new Date(Date.parse(`${today}T06:00:00+07:00`)).toISOString();
    const windowEndIso = new Date(Date.parse(`${today}T18:00:00+07:00`)).toISOString();
    const { count: problemCount, error: problemError } = await supabase
      .from("device_events")
      .select("event_id", { count: "exact", head: true })
      .eq("plant_id", plantId)
      .eq("type", "PLANT_STATE_CHANGED")
      .neq("data->>currentState", "Happy")
      .gte("occurred_at", windowStartIso)
      .lt("occurred_at", windowEndIso);
    if (problemError) {
      throw new Error(
        `event-router: daily challenge problem-mood count failed: ${problemError.message}`,
      );
    }
    satisfied = (anyToday ?? 0) >= 1 && (problemCount ?? 0) === 0;
  }

  if (!satisfied) return;

  await awardXp(
    supabase,
    plantId,
    dailyChallengeRewardKey(plantId, today, event.id),
    event.challengeXp,
    `daily:${event.id}`,
  );
}

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

      // Seasonal XP bonus (§23) and daily-event boost: the HIGHER of the two
      // amounts wins, never the product — the same no-stacking rationale as
      // overlapping seasonal events (a weekend inside Hot Weather month is
      // ×1.2, not ×1.32): bonuses stay predictable and can't compound into
      // runaway XP. Both are pure functions of completedAt (persisted on the
      // quest row), so a replayed settle recomputes the identical amount and
      // the reward_key ledger keeps it single-award.
      const { amount: seasonalAmount } = applySeasonalMultiplier(quest.xp_reward, completedAt);
      const boostedAmount = Math.round(
        quest.xp_reward * dailyBoostMultiplier(getDailyEvent(plantId, completedAt)),
      );
      const amount = Math.max(seasonalAmount, boostedAmount);
      // rewardKey per handoff §28 — a replay can never double-award.
      await awardXp(supabase, plantId, rewardKeyFor(quest), amount, quest.quest_key);

      // Lucky Sprout ×2 (spec D2): a deterministic ~1/8 roll on the quest's
      // primary key grants a second award of the SAME final composed amount
      // (net ×2 including whichever seasonal/daily bonus won above — both
      // inputs are pure functions of completedAt, so a replay recomputes the
      // identical amount). Strictly additive, odds disclosed in Collection
      // help, and idempotent via its own reward_key, so a replayed settle of
      // an unsettled quest can never double-grant the bonus.
      if (isLuckyQuest(quest.id)) {
        await awardXp(
          supabase,
          plantId,
          luckyRewardKey(quest.id),
          amount,
          `lucky-bonus:${quest.quest_key}`,
        );
      }
    }
  }

  // Daily challenge sweep — runs on every settle (device events AND page-load
  // ticks) so a challenge earned without any quest activity still pays out.
  await settleDailyChallenge(supabase, plantId);

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
