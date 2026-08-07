// Streak engine — handoff §21 / Phase 14.
//
// MVP rule: a calendar day (in STREAK_TIMEZONE, Asia/Jakarta) counts toward
// the streak when at least one qualifying care quest completes that day.
// No punishment mechanics: XP and bond level are NEVER decreased here — only
// the streak fields on `bond_state` change.

import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_TIMEZONE, type BondState, type StreakResult } from "@/types/game";

const DAY_MS = 86_400_000;

/**
 * Formats a Date as YYYY-MM-DD in the given IANA timezone (defaults to
 * STREAK_TIMEZONE). 'en-CA' is used because its date format is already
 * YYYY-MM-DD — no manual part reassembly needed.
 */
export function dayString(date: Date, timeZone: string = STREAK_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Records that a qualifying care quest completed at `occurredAt` (ISO string).
 *
 * - First qualifying completion of the day extends (yesterday qualified) or
 *   restarts (gap) the streak, then emits a STREAK_UPDATED bond event.
 * - Any later completion the same day is a no-op (`qualifiedToday: false`),
 *   which also makes Node-RED event replays idempotent (handoff §28).
 */
export async function recordQualifyingCare(
  supabase: SupabaseClient,
  plantId: string,
  occurredAt: string,
): Promise<StreakResult> {
  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime())) {
    throw new Error(`recordQualifyingCare: invalid occurredAt timestamp "${occurredAt}"`);
  }

  const today = dayString(occurredAtDate);
  // Subtracting 24h from the instant always lands on the previous calendar
  // day in a fixed-offset zone like Asia/Jakarta (no DST).
  const yesterday = dayString(new Date(occurredAtDate.getTime() - DAY_MS));

  const state = await readBondState(supabase, plantId);

  // Postgres `date` columns arrive as 'YYYY-MM-DD' strings — safe to compare
  // lexicographically. `>= today` (not `=== today`) so an out-of-order settle
  // of an OLDER completion can never move the streak backwards.
  if (state?.last_qualified_date && state.last_qualified_date >= today) {
    if (state.last_qualified_date === today) {
      // Re-emit the (idempotent) day event: heals a crash that landed the
      // bond_state update but lost the emission.
      await emitStreakEvent(
        supabase,
        plantId,
        today,
        occurredAtDate.toISOString(),
        state.current_streak,
        state.longest_streak,
      );
    }
    return {
      currentStreak: state.current_streak,
      longestStreak: state.longest_streak,
      qualifiedToday: false,
    };
  }

  const currentStreak =
    state?.last_qualified_date === yesterday ? state.current_streak + 1 : 1;
  const longestStreak = Math.max(state?.longest_streak ?? 0, currentStreak);
  const nowIso = new Date().toISOString();

  if (state) {
    // Guarded update: only wins if today has not been counted yet, so a
    // concurrent replay of the same completion cannot double-increment.
    const { data: updated, error } = await supabase
      .from("bond_state")
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_qualified_date: today,
        updated_at: nowIso,
      })
      .eq("plant_id", plantId)
      // Forward-only guard: the date may only advance, so replays and
      // out-of-order settles can never reset an earned streak.
      .or(`last_qualified_date.is.null,last_qualified_date.lt.${today}`)
      .select("current_streak, longest_streak");

    if (error) {
      throw new Error(`Failed to update streak for plant "${plantId}": ${error.message}`);
    }
    if (!updated || updated.length === 0) {
      return alreadyCountedToday(supabase, plantId);
    }
  } else {
    // No bond_state row yet — create one with only streak fields set; XP and
    // level columns take their schema defaults. ignoreDuplicates makes a
    // concurrent first-insert race resolve to a no-op instead of an error.
    const { data: inserted, error } = await supabase
      .from("bond_state")
      .upsert(
        {
          plant_id: plantId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_qualified_date: today,
          updated_at: nowIso,
        },
        { onConflict: "plant_id", ignoreDuplicates: true },
      )
      .select("current_streak, longest_streak");

    if (error) {
      throw new Error(`Failed to create bond_state for plant "${plantId}": ${error.message}`);
    }
    if (!inserted || inserted.length === 0) {
      return alreadyCountedToday(supabase, plantId);
    }
  }

  await emitStreakEvent(
    supabase,
    plantId,
    today,
    occurredAtDate.toISOString(),
    currentStreak,
    longestStreak,
  );

  return { currentStreak, longestStreak, qualifiedToday: true };
}

/** Deterministic per-day event id → replay-safe emission (handoff §27–§28). */
async function emitStreakEvent(
  supabase: SupabaseClient,
  plantId: string,
  day: string,
  occurredAtIso: string,
  currentStreak: number,
  longestStreak: number,
): Promise<void> {
  const { error } = await supabase.from("bond_events").upsert(
    {
      event_id: `streak:${plantId}:${day}`,
      plant_id: plantId,
      type: "STREAK_UPDATED",
      occurred_at: occurredAtIso,
      data: { currentStreak, longestStreak, date: day },
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(
      `Failed to emit STREAK_UPDATED event for plant "${plantId}": ${error.message}`,
    );
  }
}

/** Re-reads state after losing a write race: today was counted by another call. */
async function alreadyCountedToday(
  supabase: SupabaseClient,
  plantId: string,
): Promise<StreakResult> {
  const state = await readBondState(supabase, plantId);
  return {
    currentStreak: state?.current_streak ?? 0,
    longestStreak: state?.longest_streak ?? 0,
    qualifiedToday: false,
  };
}

async function readBondState(
  supabase: SupabaseClient,
  plantId: string,
): Promise<BondState | null> {
  const { data, error } = await supabase
    .from("bond_state")
    .select("*")
    .eq("plant_id", plantId)
    .maybeSingle<BondState>();

  if (error) {
    throw new Error(`Failed to read bond_state for plant "${plantId}": ${error.message}`);
  }
  return data ?? null;
}
