// Story engine — Phase 12 (handoff §19).
//
// Chapters unlock strictly in order and `bond_state.current_chapter` is
// MONOTONIC — it never decreases, even if the underlying condition later
// stops holding (e.g. a broken streak). Replay-safety (handoff §28):
// CHAPTER_UNLOCKED events are deduplicated by deterministic event_id, and
// the returned "newly reached" list is derived from the event rows this
// call actually inserted, so a retried request returns [].

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableError } from "@/lib/supabase-errors";
import { normalizeMood, PLANT_MOODS } from "@/types/events";
import type { BondEventRow, QuestKey } from "@/types/game";
import { RECOVERY_QUEST_KEYS } from "../badges/badge-definitions";
import { CHAPTER_DEFINITIONS, chapterTitle } from "./story-definitions";

/**
 * Distinct canonical moods ever observed: every `data->>currentState` in the
 * PLANT_STATE_CHANGED history, normalized via normalizeMood so label variants
 * ("Dry Air", "dryair") count as one discovery. State ENTRIES only — a
 * demo-scale history sits far below the cap, and 6 possible moods saturate
 * long before it (same reasoning as lib/queries.ts getSeenMoods).
 */
async function countDiscoveredMoods(
  supabase: SupabaseClient,
  plantId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("device_events")
    // Alias the jsonb text extraction so rows come back as { currentState }.
    .select("currentState:data->>currentState")
    .eq("plant_id", plantId)
    .eq("type", "PLANT_STATE_CHANGED")
    .limit(5000);
  if (error) {
    throw new Error(`story-engine: failed to read device_events: ${error.message}`);
  }
  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<{ currentState: string | null }>) {
    const mood = normalizeMood(row.currentState);
    if (mood) seen.add(mood);
  }
  return seen.size;
}

/** Manual growth records logged for this plant. A not-yet-migrated schema
 *  (supabase/milestone5-growth-records.sql not run) counts as zero rather
 *  than failing the whole evaluation. */
async function countGrowthRecords(
  supabase: SupabaseClient,
  plantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("growth_records")
    .select("id", { count: "exact", head: true })
    .eq("plant_id", plantId);
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw new Error(`story-engine: failed to count growth_records: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Computes the highest reachable chapter from live bond/quest state, advances
 * `bond_state.current_chapter` if it grew, and emits a CHAPTER_UNLOCKED bond
 * event per newly reached chapter.
 *
 * @returns the chapter numbers newly reached by this call (empty on replays).
 */
export async function evaluateChapters(
  supabase: SupabaseClient,
  plantId: string,
): Promise<number[]> {
  const { data: bond, error: bondError } = await supabase
    .from("bond_state")
    .select("bond_level, longest_streak, current_chapter")
    .eq("plant_id", plantId)
    .maybeSingle();
  if (bondError) {
    throw new Error(`story-engine: failed to read bond_state: ${bondError.message}`);
  }
  // Row may not exist before the first XP award — treat as fresh defaults.
  const bondLevel: number = bond?.bond_level ?? 1;
  const longestStreak: number = bond?.longest_streak ?? 0;
  const currentChapter: number = bond?.current_chapter ?? 1;

  const { data: questRows, error: questError } = await supabase
    .from("quests")
    .select("quest_key")
    .eq("plant_id", plantId)
    .eq("status", "COMPLETED");
  if (questError) {
    throw new Error(`story-engine: failed to read quests: ${questError.message}`);
  }
  const completed = (questRows ?? []) as Array<{ quest_key: QuestKey }>;
  const completedCount = completed.length;
  const recoveryCount = completed.filter((row) =>
    RECOVERY_QUEST_KEYS.includes(row.quest_key),
  ).length;

  // §19 unlock conditions, evaluated in order — a chapter is reachable only
  // when every earlier chapter is too. The "3-day streak" uses longest_streak
  // so the condition itself is monotonic: a later streak break can never
  // block a chapter the caretaker already earned. Mood discoveries, quest
  // completions, and growth records only ever accumulate, so chapters 5–6
  // are monotonic by construction.
  let reachable = 1; // Chapter 1 — First Meeting: registration / first launch.
  if (completedCount >= 1) reachable = 2;
  if (reachable >= 2 && bondLevel >= 3 && longestStreak >= 3) reachable = 3;
  if (reachable >= 3 && bondLevel >= 5 && completedCount >= 10 && recoveryCount >= 1) {
    reachable = 4;
  }
  // Chapters 5–6 need extra queries — only run them once the cheap-to-check
  // parts of their conditions (and every earlier chapter) already hold.
  if (reachable >= 4 && bondLevel >= 7 && completedCount >= 15) {
    const moodsDiscovered = await countDiscoveredMoods(supabase, plantId);
    if (moodsDiscovered >= PLANT_MOODS.length) reachable = 5; // Full Bloom
  }
  if (reachable >= 5 && bondLevel >= 10 && completedCount >= 30) {
    const growthRecordCount = await countGrowthRecords(supabase, plantId);
    if (growthRecordCount >= 5) reachable = 6; // Harvest of Wisdom
  }
  const finalChapter = CHAPTER_DEFINITIONS[CHAPTER_DEFINITIONS.length - 1].chapter;
  reachable = Math.min(reachable, finalChapter);

  if (reachable <= currentChapter) return []; // monotonic — never decrease

  // Ensure the row exists so the guarded update below has something to hit
  // (idempotent seed, mirrors award_xp()).
  if (!bond) {
    const { error: seedError } = await supabase
      .from("bond_state")
      .upsert({ plant_id: plantId }, { onConflict: "plant_id", ignoreDuplicates: true });
    if (seedError) {
      throw new Error(`story-engine: failed to seed bond_state: ${seedError.message}`);
    }
  }

  const pending: number[] = [];
  for (let n = currentChapter + 1; n <= reachable; n += 1) pending.push(n);

  // Emit before updating state: if we crash in between, a replay re-runs this
  // block (deduped by event_id) and then repairs current_chapter. The rows
  // actually inserted are the chapters newly reached by this call.
  const occurredAt = new Date().toISOString();
  const events: Array<Omit<BondEventRow, "created_at">> = pending.map((n) => ({
    event_id: `chapter:${plantId}:${n}`,
    plant_id: plantId,
    type: "CHAPTER_UNLOCKED",
    occurred_at: occurredAt,
    data: { chapter: n, title: chapterTitle(n) },
  }));
  const { data: insertedEvents, error: eventError } = await supabase
    .from("bond_events")
    .upsert(events, { onConflict: "event_id", ignoreDuplicates: true })
    .select("data");
  if (eventError) {
    throw new Error(`story-engine: failed to emit bond_events: ${eventError.message}`);
  }

  // Guarded update keeps current_chapter monotonic even under concurrent
  // evaluations — lt() means we can only ever raise it.
  const { error: updateError } = await supabase
    .from("bond_state")
    .update({ current_chapter: reachable, updated_at: occurredAt })
    .eq("plant_id", plantId)
    .lt("current_chapter", reachable);
  if (updateError) {
    throw new Error(`story-engine: failed to update bond_state: ${updateError.message}`);
  }

  return ((insertedEvents ?? []) as Array<{ data: { chapter: number } }>)
    .map((row) => row.data.chapter)
    .sort((a, b) => a - b);
}
