// Seed coin economy — grant amounts + deterministic reward-key builders.
// Mirrors src/game/progression/bonus-xp.ts: everything here is PURE. All
// actual granting goes through the atomic `award_seeds` RPC (milestone18),
// whose seed_rewards ledger turns replays into no-ops, so callers may
// re-grant every earned Seed on every sweep — idempotent AND self-healing.
//
// Spec (2026-08-09-seed-shop-design.md): earning is deterministic and
// sensor-truth-derived ONLY — never AI-judged. This table is the ONE place
// amounts live.

/** Seed amounts per verified event. */
export const SEED_GRANTS = {
  /** Quest completed (sensor-verified COMPLETED row). */
  questCompleted: 3,
  /** Badge unlocked (plant_badges row). */
  badgeUnlocked: 5,
  /** Story chapter unlocked (monotonic bond_state.current_chapter). */
  chapterUnlocked: 10,
  /** Daily-quiz question answered correctly (answer_daily_quiz non-duplicate). */
  quizCorrect: 1,
  /** A calendar day that qualified for the care streak. */
  streakDay: 1,
} as const;

// ── Reward-key builders ─────────────────────────────────────────────────
// The "seed:" namespace keeps these keys disjoint from every xp_rewards key
// (quest:/badge:/chapter:/mood:/streak-milestone:/growth:/daily_quiz:).

/** e.g. "seed:quest:8f14e45f-..." — keyed by the quest primary key. */
export function seedQuestRewardKey(questId: string): string {
  return `seed:quest:${questId}`;
}

/** e.g. "seed:badge:plant-01:FIRST_RESCUE" */
export function seedBadgeRewardKey(plantId: string, badgeKey: string): string {
  return `seed:badge:${plantId}:${badgeKey}`;
}

/** e.g. "seed:chapter:plant-01:2" */
export function seedChapterRewardKey(plantId: string, chapter: number): string {
  return `seed:chapter:${plantId}:${chapter}`;
}

/** e.g. "seed:day:plant-01:2026-08-09" — pass a dayString() value. */
export function seedStreakDayRewardKey(plantId: string, day: string): string {
  return `seed:day:${plantId}:${day}`;
}

/** e.g. "seed:quiz:plant-01:2026-08-09:0:temp-basics" */
export function seedQuizRewardKey(
  plantId: string,
  quizDate: string,
  round: number,
  questionKey: string,
): string {
  return `seed:quiz:${plantId}:${quizDate}:${round}:${questionKey}`;
}
