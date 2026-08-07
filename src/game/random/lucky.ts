// Lucky Sprout ×2 — a deterministic "did this quest sprout a lucky bonus?"
// roll (dopamine spec D2, plan Task 7).
//
// The roll is a pure function of the quest's primary key via the same FNV-1a
// hash the daily-events system uses: ~1-in-8 quests are lucky, and the SAME
// quest is lucky on every server, every replay, every restart (handoff §28 —
// no Math.random, no server state). That makes the bonus precomputable for
// demos and replay-stable for the settle sweep.
//
// §4 ethics guardrails: the bonus is strictly additive (never a loss, never a
// near-miss), the odds are disclosed honestly in the Collection help ("1 in 8
// quests sprouts a lucky bonus!"), and the award is idempotent — the ledger
// key below dedupes through the xp_rewards reward_key ledger exactly like the
// base quest award.

import { hashDailyKey } from "@/game/random/daily-events";

/** True when `questId` rolls a Lucky Sprout ×2 bonus (~1/8, deterministic). */
export function isLuckyQuest(questId: string): boolean {
  return hashDailyKey(`lucky:${questId}`) % 8 === 0;
}

/**
 * e.g. "lucky:abc" — the xp_rewards ledger key for the bonus award. Keyed on
 * the quest's primary key (like `quest:<id>:completion`), so a replayed
 * settle can never double-grant the bonus.
 */
export function luckyRewardKey(questId: string): string {
  return `lucky:${questId}`;
}
