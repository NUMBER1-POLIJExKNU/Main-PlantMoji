// Bonus XP economy — verified-outcome XP sources layered on top of quest
// rewards (handoff §17, §28–§29).
//
// Everything in this module is PURE: constants, deterministic reward-key
// builders, and calendar helpers. All actual granting goes through the atomic
// `award_xp` RPC (see xp-engine.ts), whose reward_key ledger turns replays
// into no-ops. That property shapes the whole design: callers may re-award
// every earned bonus on every pass — idempotent AND self-healing — instead of
// tracking "newness" and risking orphaned rewards after a crash.

import { STREAK_TIMEZONE, type BadgeKey } from "@/types/game";
import type { PlantMood } from "@/types/events";
import { dayString } from "./streak-engine";

// ── Bonus amounts ───────────────────────────────────────────────────────

/** One-time bonus per unlocked badge. */
export const BADGE_BONUS_XP = 15;

/** One-time bonus per story chapter reached. */
export const CHAPTER_BONUS_XP = 25;

/** One-time bonus the first time the plant ever shows a given mood. */
export const MOOD_DISCOVERY_XP = 5;

/** Growth journaling bonus — at most once per ISO week, however many records. */
export const GROWTH_RECORD_XP = 10;

/** Care-streak day counts that each pay a one-time milestone bonus. */
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/** One-time bonus per streak milestone crossed. */
export const STREAK_MILESTONE_XP = 10;

// ── Reward-key builders (handoff §28) ───────────────────────────────────
// Deterministic keys are what make every award idempotent: the xp_rewards
// ledger rejects a repeated reward_key inside the award_xp transaction, so a
// replayed or re-swept award changes nothing.

/** e.g. "badge:plant-01:FIRST_RESCUE" */
export function badgeRewardKey(plantId: string, badgeKey: BadgeKey): string {
  return `badge:${plantId}:${badgeKey}`;
}

/** e.g. "chapter:plant-01:2" */
export function chapterRewardKey(plantId: string, chapter: number): string {
  return `chapter:${plantId}:${chapter}`;
}

/**
 * e.g. "mood:plant-01:Overheating". The xp_rewards row written under this key
 * doubles as the permanent "mood discovered" ledger — no seen-mood table or
 * pre-check query is needed anywhere.
 */
export function moodRewardKey(plantId: string, mood: PlantMood): string {
  return `mood:${plantId}:${mood}`;
}

/** e.g. "streak-milestone:plant-01:7" */
export function streakMilestoneRewardKey(plantId: string, days: number): string {
  return `streak-milestone:${plantId}:${days}`;
}

/** e.g. "growth:plant-01:2026-W32" — pass isoWeekString() output. */
export function growthWeekRewardKey(plantId: string, isoWeek: string): string {
  return `growth:${plantId}:${isoWeek}`;
}

// ── Calendar helpers ────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Formats the ISO 8601 week of `date` as observed in `timeZone` (default
 * STREAK_TIMEZONE, Asia/Jakarta), e.g. "2026-W32".
 *
 * The calendar date is read with the same Intl technique as
 * streak-engine's dayString (WIB is fixed-offset, no DST), then the ISO week
 * is derived with pure UTC arithmetic on that calendar date.
 *
 * Year-boundary behavior (ISO 8601: a week belongs to the year containing
 * its THURSDAY, so weeks never split across labels):
 * - Late-December Mondays–Wednesdays can belong to week 1 of the NEXT year
 *   (e.g. 2024-12-30, a Monday, → "2025-W01").
 * - January 1st–3rd can belong to week 52/53 of the PREVIOUS year
 *   (e.g. 2027-01-01, a Friday, → "2026-W53").
 * The prefix is therefore the ISO week-numbering year, which may differ from
 * the calendar year of the date — exactly what keeps weekly reward keys
 * stable across New Year instead of splitting one week into two.
 */
export function isoWeekString(date: Date, timeZone: string = STREAK_TIMEZONE): string {
  const [year, month, day] = dayString(date, timeZone).split("-").map(Number);
  // Re-anchor the wall-clock calendar date at UTC midnight so all week math
  // below is offset-free.
  const anchor = new Date(Date.UTC(year, month - 1, day));
  const isoDow = anchor.getUTCDay() || 7; // Mon=1 … Sun=7
  // Jump to the Thursday of the same ISO week — its calendar year IS the ISO
  // week-numbering year.
  anchor.setUTCDate(anchor.getUTCDate() + 4 - isoDow);
  const isoYear = anchor.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((anchor.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Milestones newly crossed when a streak moves previous → current.
 * `milestonesReached(0, n)` lists every milestone at or below n, which is
 * what the self-healing "award everything reached" sweep in the event router
 * uses — the reward_key ledger turns already-paid milestones into no-ops.
 */
export function milestonesReached(previousStreak: number, currentStreak: number): number[] {
  return STREAK_MILESTONES.filter((m) => previousStreak < m && currentStreak >= m);
}
