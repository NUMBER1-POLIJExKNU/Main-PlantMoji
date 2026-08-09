// Seed engine — thin wrapper over the atomic `award_seeds` RPC plus the
// self-healing sweep that mirrors settleCompletions' XP bonus sweeps
// (supabase/milestone18-seed-shop.sql).
//
// Seeds are a SECONDARY economy: a seed failure must never break XP
// settlement, so sweepSeedGrants never throws, and a missing milestone18
// migration is a silent, graceful no-op (same contract as milestone11/13).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SEED_GRANTS,
  seedBadgeRewardKey,
  seedChapterRewardKey,
  seedQuestRewardKey,
  seedStreakDayRewardKey,
} from "@/game/economy/seed-grants";

export interface AwardSeedsResult {
  /** True when the grant actually landed in THIS call. */
  granted: boolean;
  /** True when the reward_key was already in the seed_rewards ledger. */
  duplicate: boolean;
  /** Balance after the call, or null when unknown (missing migration). */
  seeds: number | null;
  /** True when milestone18 has not been run in this Supabase project. */
  missingMigration: boolean;
}

/** jsonb shape returned by public.award_seeds (milestone18-seed-shop.sql). */
interface AwardSeedsRpcResult {
  duplicate: boolean;
  seeds: number;
}

/** PostgREST "missing from schema cache": the migration hasn't been run.
 *  PGRST202 = unknown function, PGRST205 = unknown table — the same
 *  detection idea as isMissingTableError in event-router.ts / badge-engine. */
function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

/**
 * Grants Seeds atomically and idempotently. Replaying the same rewardKey
 * returns duplicate: true and changes nothing. A missing milestone18
 * migration returns missingMigration: true instead of throwing.
 */
export async function awardSeeds(
  supabase: SupabaseClient,
  plantId: string,
  rewardKey: string,
  amount: number,
  reason?: string,
): Promise<AwardSeedsResult> {
  const { data, error } = await supabase.rpc("award_seeds", {
    p_plant_id: plantId,
    p_reward_key: rewardKey,
    p_amount: amount,
    p_reason: reason ?? null,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      return { granted: false, duplicate: false, seeds: null, missingMigration: true };
    }
    throw new Error(
      `award_seeds RPC failed for plant "${plantId}", rewardKey "${rewardKey}": ${error.message}`,
    );
  }

  const row = data as AwardSeedsRpcResult;
  return {
    granted: !row.duplicate,
    duplicate: Boolean(row.duplicate),
    seeds: Number(row.seeds),
    missingMigration: false,
  };
}

/**
 * Self-healing Seed sweep, called from settleCompletions after every settle.
 * Derived from PERSISTED state only (COMPLETED quests, plant_badges, the
 * monotonic current_chapter, last_qualified_date) — never from in-memory
 * "newly unlocked" flags — so a crash between any two writes heals on the
 * next sweep, exactly like the XP badge/chapter bonus sweeps it mirrors.
 *
 * The seed_rewards pre-filter keeps the steady state at ONE read and ZERO
 * RPCs; a key racing past the filter still hits award_seeds' own ledger
 * dedup (the pre-filter is an optimization, never the idempotency
 * guarantee).
 */
export async function sweepSeedGrants(supabase: SupabaseClient, plantId: string): Promise<void> {
  try {
    const [questRes, badgeRes, bondRes] = await Promise.all([
      supabase
        .from("quests")
        .select("id, completed_at")
        .eq("plant_id", plantId)
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase.from("plant_badges").select("badge_key").eq("plant_id", plantId),
      supabase
        .from("bond_state")
        .select("current_chapter, last_qualified_date")
        .eq("plant_id", plantId)
        .maybeSingle(),
    ]);
    // Any read failure (missing table, RLS, network) skips this sweep — the
    // next settle retries, and seeds must never break XP settlement.
    if (questRes.error || badgeRes.error || bondRes.error) return;

    const candidates: Array<{ key: string; amount: number; reason: string }> = [];
    for (const quest of (questRes.data ?? []) as Array<{ id: string }>) {
      candidates.push({
        key: seedQuestRewardKey(quest.id),
        amount: SEED_GRANTS.questCompleted,
        reason: "quest",
      });
    }
    for (const row of (badgeRes.data ?? []) as Array<{ badge_key: string }>) {
      candidates.push({
        key: seedBadgeRewardKey(plantId, row.badge_key),
        amount: SEED_GRANTS.badgeUnlocked,
        reason: `badge:${row.badge_key}`,
      });
    }
    const bond = bondRes.data as
      | { current_chapter: number | null; last_qualified_date: string | null }
      | null;
    const chapter = bond?.current_chapter ?? 0;
    for (let c = 1; c <= chapter; c += 1) {
      candidates.push({
        key: seedChapterRewardKey(plantId, c),
        amount: SEED_GRANTS.chapterUnlocked,
        reason: `chapter:${c}`,
      });
    }
    // One Seed per qualifying streak day. Only the LATEST qualified day is
    // derivable from bond_state; each day is granted while it is current,
    // and the ledger keeps history single-award forever.
    if (bond?.last_qualified_date) {
      candidates.push({
        key: seedStreakDayRewardKey(plantId, bond.last_qualified_date),
        amount: SEED_GRANTS.streakDay,
        reason: "streak-day",
      });
    }
    if (candidates.length === 0) return;

    const { data: settledRows, error: settledError } = await supabase
      .from("seed_rewards")
      .select("reward_key")
      .in(
        "reward_key",
        candidates.map((c) => c.key),
      );
    if (settledError) return; // missing migration or transient — retry next settle
    const settled = new Set(
      ((settledRows ?? []) as Array<{ reward_key: string }>).map((r) => r.reward_key),
    );

    for (const candidate of candidates) {
      if (settled.has(candidate.key)) continue;
      const result = await awardSeeds(
        supabase,
        plantId,
        candidate.key,
        candidate.amount,
        candidate.reason,
      );
      if (result.missingMigration) return; // no point retrying the rest
    }
  } catch (error) {
    // Log-and-continue: seeds are presentation-adjacent economy, XP is not.
    console.error(`sweepSeedGrants(${plantId}) failed:`, error);
  }
}
