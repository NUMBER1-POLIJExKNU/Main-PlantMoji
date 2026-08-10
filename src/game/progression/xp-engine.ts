// XP engine — thin, typed wrapper over the atomic `award_xp` RPC
// (handoff §14–§15, §29; supabase/milestone3.sql).
//
// All XP mutation happens inside Postgres in a single transaction: dedup by
// reward_key → increment XP → derive level → record XP_AWARDED / LEVEL_UP
// events. This module never does read-modify-write on XP, so concurrent or
// replayed Node-RED deliveries can never double-grant (handoff §28).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AwardXpResult, BondState } from "@/types/game";

/** jsonb shape returned by public.award_xp (milestone3.sql). */
interface AwardXpRpcResult {
  duplicate: boolean;
  total_xp: number;
  bond_level: number;
  leveled_up: boolean;
}

/**
 * Grants XP atomically and idempotently. Replaying the same `rewardKey`
 * returns `duplicate: true` and changes nothing (handoff §29).
 */
export async function awardXp(
  supabase: SupabaseClient,
  plantId: string,
  rewardKey: string,
  amount: number,
  reason?: string,
): Promise<AwardXpResult> {
  const { data, error } = await supabase.rpc("award_xp", {
    p_plant_id: plantId,
    p_reward_key: rewardKey,
    p_amount: amount,
    p_reason: reason ?? null,
  });

  if (error) {
    throw new Error(
      `award_xp RPC failed for plant "${plantId}", rewardKey "${rewardKey}": ${error.message}`,
    );
  }
  if (data == null) {
    throw new Error(
      `award_xp RPC returned no data for plant "${plantId}", rewardKey "${rewardKey}"`,
    );
  }

  const row = data as AwardXpRpcResult;
  return {
    duplicate: Boolean(row.duplicate),
    totalXp: Number(row.total_xp),
    bondLevel: Number(row.bond_level),
    leveledUp: Boolean(row.leveled_up),
  };
}

/** Reads the plant's bond progression row, or null if none exists yet. */
export async function getBondState(
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
