import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { awardSeeds, sweepSeedGrants } from "@/game/economy/seed-engine";
import {
  seedBadgeRewardKey,
  seedChapterRewardKey,
  seedQuestRewardKey,
  seedStreakDayRewardKey,
} from "@/game/economy/seed-grants";

// ── Table-aware Supabase stub (mirrors tests/settle-sweep.test.ts) ───────

interface StubResponse {
  data: unknown;
  error: { code?: string; message: string } | null;
}

type Responder = () => StubResponse;

const CHAIN_METHODS = ["select", "eq", "in", "order", "limit", "maybeSingle"];

function makeSupabase(
  responders: Record<string, Responder>,
  rpc: (name: string, args: Record<string, unknown>) => StubResponse,
) {
  return {
    from(table: string) {
      const stub: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        stub[method] = () => stub;
      }
      stub.then = (resolve: (value: StubResponse) => unknown) => {
        const responder = responders[table] ?? (() => ({ data: [], error: null }));
        return Promise.resolve(responder()).then(resolve);
      };
      return stub;
    },
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpc(name, args)),
  } as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> };
}

const PLANT = "plant-01";
const MISSING_FN = { code: "PGRST202", message: "Could not find the function public.award_seeds" };
const MISSING_TABLE = { code: "PGRST205", message: "Could not find the table 'public.seed_rewards'" };

describe("awardSeeds", () => {
  it("reports missingMigration instead of throwing when the RPC does not exist", async () => {
    const supabase = makeSupabase({}, () => ({ data: null, error: MISSING_FN }));
    const result = await awardSeeds(supabase, PLANT, "seed:quest:q-1", 3);
    expect(result).toEqual({ granted: false, duplicate: false, seeds: null, missingMigration: true });
  });

  it("maps a fresh grant and a duplicate correctly", async () => {
    const fresh = makeSupabase({}, () => ({ data: { duplicate: false, seeds: 7 }, error: null }));
    expect(await awardSeeds(fresh, PLANT, "k", 3)).toEqual({
      granted: true, duplicate: false, seeds: 7, missingMigration: false,
    });
    const dup = makeSupabase({}, () => ({ data: { duplicate: true, seeds: 7 }, error: null }));
    expect(await awardSeeds(dup, PLANT, "k", 3)).toEqual({
      granted: false, duplicate: true, seeds: 7, missingMigration: false,
    });
  });

  it("throws on non-migration RPC errors", async () => {
    const supabase = makeSupabase({}, () => ({ data: null, error: { message: "network boom" } }));
    await expect(awardSeeds(supabase, PLANT, "k", 3)).rejects.toThrow(/award_seeds RPC failed/);
  });
});

describe("sweepSeedGrants", () => {
  const responders = (ledger: string[]) => ({
    quests: () => ({ data: [{ id: "q-1", completed_at: "2026-08-09T02:00:00Z" }], error: null }),
    plant_badges: () => ({ data: [{ badge_key: "FIRST_RESCUE" }], error: null }),
    bond_state: () => ({
      data: { current_chapter: 2, last_qualified_date: "2026-08-09" },
      error: null,
    }),
    seed_rewards: () => ({ data: ledger.map((reward_key) => ({ reward_key })), error: null }),
  });

  it("grants every unsettled source exactly the SEED_GRANTS amount", async () => {
    const supabase = makeSupabase(responders([]), () => ({
      data: { duplicate: false, seeds: 1 },
      error: null,
    }));
    await sweepSeedGrants(supabase, PLANT);
    const calls = supabase.rpc.mock.calls.map(([, args]) => args as Record<string, unknown>);
    const byKey = new Map(calls.map((a) => [a.p_reward_key, a.p_amount]));
    expect(byKey.get(seedQuestRewardKey("q-1"))).toBe(3);
    expect(byKey.get(seedBadgeRewardKey(PLANT, "FIRST_RESCUE"))).toBe(5);
    expect(byKey.get(seedChapterRewardKey(PLANT, 1))).toBe(10);
    expect(byKey.get(seedChapterRewardKey(PLANT, 2))).toBe(10);
    expect(byKey.get(seedStreakDayRewardKey(PLANT, "2026-08-09"))).toBe(1);
    expect(calls).toHaveLength(5);
  });

  it("issues ZERO RPCs in the steady state (ledger pre-filter)", async () => {
    const settled = [
      seedQuestRewardKey("q-1"),
      seedBadgeRewardKey(PLANT, "FIRST_RESCUE"),
      seedChapterRewardKey(PLANT, 1),
      seedChapterRewardKey(PLANT, 2),
      seedStreakDayRewardKey(PLANT, "2026-08-09"),
    ];
    const supabase = makeSupabase(responders(settled), () => ({
      data: { duplicate: true, seeds: 20 },
      error: null,
    }));
    await sweepSeedGrants(supabase, PLANT);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("no-ops silently when the migration has not been run", async () => {
    const supabase = makeSupabase(
      { ...responders([]), seed_rewards: () => ({ data: null, error: MISSING_TABLE }) },
      () => ({ data: null, error: MISSING_FN }),
    );
    await expect(sweepSeedGrants(supabase, PLANT)).resolves.toBeUndefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("stops sweeping after the first missingMigration RPC result", async () => {
    const supabase = makeSupabase(responders([]), () => ({ data: null, error: MISSING_FN }));
    await sweepSeedGrants(supabase, PLANT);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
