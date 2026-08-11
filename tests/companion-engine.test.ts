import { beforeEach, describe, expect, it } from "vitest";
import { affinityForQuest, careForm, eligibleCompanionStage, evaluateCompanion, resetCompanionCountersForTests, type VerifiedCare } from "@/game/companion/companion-engine";
import type { QuestKey } from "@/types/game";

// The engine memoizes "milestone16 counters unsupported" per process.
beforeEach(() => resetCompanionCountersForTests());

const care = (keys: QuestKey[], days = 1): VerifiedCare[] => keys.map((questKey, index) => ({
  questKey,
  completedAt: new Date(Date.UTC(2026, 7, 1 + (index % days), 5)).toISOString(),
}));

describe("companion evolution", () => {
  it("maps quest kinds to care affinities", () => {
    expect(affinityForQuest("COOL_ME_DOWN")).toBe("cool");
    expect(affinityForQuest("BALANCE_SOIL_ACIDIC")).toBe("soil");
    expect(affinityForQuest("STAY_COMFY")).toBe("steady");
  });

  it("honors count, diversity, and WIB-day boundaries", () => {
    expect(eligibleCompanionStage([])).toBe("Seed");
    expect(eligibleCompanionStage(care(["COOL_ME_DOWN"]))).toBe("Sprout");
    expect(eligibleCompanionStage(care(["COOL_ME_DOWN", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("Bud");
    const seven = care(["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "COOL_ME_DOWN"], 2);
    expect(eligibleCompanionStage(seven)).toBe("Bloom");
    const fifteen = care(Array.from({ length: 15 }, (_, index) => (["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "BALANCE_SOIL_ACIDIC"] as QuestKey[])[index % 4]), 3);
    // 10-stage ladder: 3 distinct days fails Fruit's 4 and Guardian's 5 — Bloom is the honest ceiling here.
    expect(eligibleCompanionStage(fifteen)).toBe("Bloom");
    const guardian = care(Array.from({ length: 15 }, (_, index) => (["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "BALANCE_SOIL_ACIDIC"] as QuestKey[])[index % 4]), 5);
    expect(eligibleCompanionStage(guardian)).toBe("Guardian");
  });

  it("uses balanced for a tie and the sole leader otherwise", () => {
    expect(careForm(care(["COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("balanced");
    expect(careForm(care(["COOL_ME_DOWN", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("cool");
  });
});

// n care items spread across `days` distinct WIB days and `affinities` distinct
// quest families (order: steady, cool, air, light, soil).
const FAMILY: Record<string, string> = { steady: "KEEP_ME_HAPPY", cool: "COOL_ME_DOWN", air: "HUMIDIFY_MY_AIR", light: "GIVE_ME_MORE_LIGHT", soil: "BALANCE_SOIL_ACIDIC" };
function ladderCare(n: number, affinities: number, days: number) {
  const fams = Object.values(FAMILY).slice(0, affinities);
  return Array.from({ length: n }, (_, i) => ({
    questKey: fams[i % fams.length] as never,
    // 05:00 UTC = 12:00 WIB, +1 day per bucket
    completedAt: new Date(Date.UTC(2026, 0, 1 + (i % days), 5)).toISOString(),
  }));
}

describe("10-stage ladder", () => {
  it("requires two distinct days for Seedling", () => {
    expect(eligibleCompanionStage(ladderCare(2, 1, 1))).toBe("Sprout");
    expect(eligibleCompanionStage(ladderCare(2, 1, 2))).toBe("Seedling");
  });
  it("keeps Bud and Bloom verbatim", () => {
    expect(eligibleCompanionStage(ladderCare(3, 2, 1))).toBe("Bud");
    expect(eligibleCompanionStage(ladderCare(7, 3, 2))).toBe("Bloom");
  });
  it("adds Fruit between Bloom and Guardian", () => {
    expect(eligibleCompanionStage(ladderCare(11, 3, 4))).toBe("Fruit");
    expect(eligibleCompanionStage(ladderCare(11, 3, 3))).toBe("Bloom");
  });
  it("rebalances Guardian to five days", () => {
    expect(eligibleCompanionStage(ladderCare(15, 4, 3))).toBe("Bloom"); // 3 days < Fruit's 4
    expect(eligibleCompanionStage(ladderCare(15, 4, 5))).toBe("Guardian");
  });
  it("extends past the old ceiling", () => {
    expect(eligibleCompanionStage(ladderCare(25, 4, 8))).toBe("Elder");
    expect(eligibleCompanionStage(ladderCare(40, 4, 12))).toBe("Radiant");
    expect(eligibleCompanionStage(ladderCare(60, 4, 20))).toBe("Legend");
    expect(eligibleCompanionStage(ladderCare(60, 4, 19))).toBe("Radiant");
  });
});

type DbError = { code?: string; message: string };
type UpdateCall = { payload: Record<string, unknown>; filters: Record<string, unknown> };

/** Fake Supabase client for evaluateCompanion sweeps: seeded companion_state row,
 *  completed-quest rows, an optional per-upsert error hook (to simulate legacy
 *  CHECK constraints / missing milestone16 columns), and an optional queue of
 *  companion_state update errors (each shifted once, in order). */
function sweepClient(options: {
  state: Record<string, unknown> | null;
  care?: { quest_key: string; completed_at: string }[];
  onUpsert?: (table: string, payload: Record<string, unknown>) => DbError | null;
  stateUpdateErrors?: DbError[];
}) {
  const upserts: Record<string, Record<string, unknown>[]> = {};
  const updates: Record<string, UpdateCall[]> = {};
  const pendingUpdateErrors = [...(options.stateUpdateErrors ?? [])];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: options.care ?? [], error: null }),
            }),
            maybeSingle: async () => ({ data: options.state, error: null }),
          }),
        }),
        upsert: async (payload: Record<string, unknown>) => {
          (upserts[table] ??= []).push(payload);
          return { error: options.onUpsert?.(table, payload) ?? null };
        },
        update: (payload: Record<string, unknown>) => ({
          eq: (column1: string, value1: unknown) => ({
            eq: async (column2: string, value2: unknown) => {
              (updates[table] ??= []).push({ payload, filters: { [column1]: value1, [column2]: value2 } });
              return { error: pendingUpdateErrors.shift() ?? null };
            },
          }),
        }),
      };
    },
  };
  return { client: client as never, upserts, updates };
}

const questRows = (items: { questKey: string; completedAt: string }[]) =>
  items.map((item) => ({ quest_key: item.questKey, completed_at: item.completedAt }));

describe("progress counters (display-only)", () => {
  it("refreshes counters via a stage-guarded update that never sends stage", async () => {
    const { client, upserts, updates } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady" },
      care: questRows(ladderCare(1, 1, 1)),
    });
    const result = await evaluateCompanion(client, "p1");
    // Counters travel by UPDATE guarded on the snapshot stage — a stale sweep
    // can never rewrite the stage column over a concurrent evolution.
    expect(upserts.companion_state).toBeUndefined();
    expect(updates.companion_state).toHaveLength(1);
    const call = updates.companion_state[0];
    expect(call.payload).toMatchObject({ care_count: 1, affinity_count: 1, day_count: 1 });
    expect(call.payload).not.toHaveProperty("stage");
    expect(call.payload).not.toHaveProperty("form_key");
    expect(call.filters).toEqual({ plant_id: "p1", stage: "Sprout" });
    expect(upserts.companion_evolutions).toBeUndefined();
    expect(result).toMatchObject({ stage: "Sprout", care_count: 1, affinity_count: 1, day_count: 1 });
  });

  it("skips the write when stored counters already match (no churn)", async () => {
    const { client, upserts, updates } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady", care_count: 1, affinity_count: 1, day_count: 1 },
      care: questRows(ladderCare(1, 1, 1)),
    });
    const result = await evaluateCompanion(client, "p1");
    expect(upserts.companion_state).toBeUndefined();
    expect(updates.companion_state).toBeUndefined();
    expect(result).toMatchObject({ stage: "Sprout" });
  });

  it("stops writing counters once milestone16 is known to be missing", async () => {
    const missing = { code: "PGRST204", message: "Could not find the 'care_count' column of 'companion_state' in the schema cache" };
    const first = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady" },
      care: questRows(ladderCare(1, 1, 1)),
      stateUpdateErrors: [missing],
    });
    const result = await evaluateCompanion(first.client, "p1");
    // One probing update, no legacy retry, no upsert churn — and no throw.
    expect(first.updates.companion_state).toHaveLength(1);
    expect(first.upserts.companion_state).toBeUndefined();
    expect(result).toMatchObject({ stage: "Sprout" });

    // Second sweep on the same process: zero counter writes of any kind.
    const second = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady" },
      care: questRows(ladderCare(1, 1, 1)),
    });
    const again = await evaluateCompanion(second.client, "p1");
    expect(second.updates.companion_state).toBeUndefined();
    expect(second.upserts.companion_state).toBeUndefined();
    expect(again).toMatchObject({ stage: "Sprout" });
  });

  it("writes one history row per skipped stage on a multi-stage jump", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Seed", form_key: "balanced" },
      care: questRows(ladderCare(11, 3, 4)),
    });
    const result = await evaluateCompanion(client, "p1");
    const rows = (upserts.companion_evolutions ?? []) as { stage: string; from_stage: string }[];
    expect(rows.map((row) => row.stage)).toEqual(["Sprout", "Seedling", "Bud", "Bloom", "Fruit"]);
    expect(rows.map((row) => row.from_stage)).toEqual(["Seed", "Sprout", "Seedling", "Bud", "Bloom"]);
    expect(upserts.companion_state.at(-1)).toMatchObject({
      stage: "Fruit", care_count: 11, affinity_count: 3, day_count: 4,
    });
    expect(result).toMatchObject({ stage: "Fruit", care_count: 11, affinity_count: 3, day_count: 4 });
  });
});

// milestone11-only DBs: companion_evolutions CHECK allows Sprout/Bud/Bloom/Guardian,
// companion_state CHECK allows Seed/Sprout/Bud/Bloom/Guardian — new milestone16
// names are rejected with Postgres 23514.
const NEW_STAGE_NAMES = ["Seedling", "Fruit", "Elder", "Radiant", "Legend"];
const checkErr = (constraint: string): DbError => ({
  code: "23514",
  message: `new row violates check constraint "${constraint}"`,
});

describe("pre-milestone16 CHECK degradation", () => {
  it("skips rejected rungs mid-walk and lands on the highest legacy-accepted stage", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Seed", form_key: "balanced" },
      care: questRows(ladderCare(15, 4, 5)), // eligible for Guardian
      onUpsert: (table, payload) => {
        if (table === "companion_evolutions" && NEW_STAGE_NAMES.includes(payload.stage as string)) {
          return checkErr("companion_evolutions_stage_check");
        }
        if (table === "companion_state" && "care_count" in payload) {
          return { code: "PGRST204", message: "Could not find the 'care_count' column of 'companion_state' in the schema cache" };
        }
        return null;
      },
    });
    // (a) no throw, even though Seedling and Fruit are rejected mid-walk.
    const result = await evaluateCompanion(client, "p1");
    const attempts = (upserts.companion_evolutions ?? []) as { stage: string; from_stage: string }[];
    expect(attempts.map((row) => row.stage)).toEqual(["Sprout", "Seedling", "Bud", "Bloom", "Fruit", "Guardian"]);
    // Rejected rungs are skipped, not fatal: the from_stage chain only links accepted stages.
    const events = (upserts.bond_events ?? []) as { data: { stage: string; fromStage: string } }[];
    expect(events.map((row) => row.data.stage)).toEqual(["Sprout", "Bud", "Bloom", "Guardian"]);
    expect(events.map((row) => row.data.fromStage)).toEqual(["Seed", "Sprout", "Bud", "Bloom"]);
    // (b) final persisted stage is the highest stage the DB accepted (counters
    // dropped after the missing-column probe on this legacy DB).
    expect(upserts.companion_state.at(-1)).toMatchObject({ stage: "Guardian" });
    expect(upserts.companion_state.at(-1)).not.toHaveProperty("care_count");
    // (c) the sweep result reflects it.
    expect(result).toMatchObject({ stage: "Guardian" });
  });

  it("holds at the legacy stage when only new-name rungs are eligible", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Bloom", form_key: "cool" },
      care: questRows(ladderCare(11, 3, 4)), // eligible for Fruit only
      onUpsert: (table, payload) =>
        table === "companion_evolutions" && NEW_STAGE_NAMES.includes(payload.stage as string)
          ? checkErr("companion_evolutions_stage_check")
          : null,
    });
    const result = await evaluateCompanion(client, "p1");
    expect(result).toMatchObject({ stage: "Bloom" });
    expect(upserts.bond_events).toBeUndefined();
    expect(upserts.companion_state).toBeUndefined();
  });

  it("falls back rung by rung when companion_state's own CHECK rejects a new name", async () => {
    // Partial migration: companion_evolutions accepts the 10-stage ladder but
    // companion_state still carries the milestone11 five-name CHECK.
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Seed", form_key: "balanced" },
      care: questRows(ladderCare(11, 3, 4)), // eligible for Fruit
      onUpsert: (table, payload) =>
        table === "companion_state" && NEW_STAGE_NAMES.includes(payload.stage as string)
          ? checkErr("companion_state_stage_check")
          : null,
    });
    const result = await evaluateCompanion(client, "p1");
    const stateWrites = (upserts.companion_state ?? []) as { stage: string }[];
    expect(stateWrites.map((row) => row.stage)).toEqual(["Fruit", "Bloom"]);
    expect(result).toMatchObject({ stage: "Bloom" });
  });
});

describe("no-demotion invariant", () => {
  it("keeps a persisted stage that sits above current eligibility", async () => {
    const upserts: Record<string, unknown[]> = {};
    const client = {
      from(table: string) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
              maybeSingle: async () => ({
                data: { plant_id: "p1", cycle: 1, stage: "Guardian", form_key: "steady" },
                error: null,
              }),
            }),
          }),
          upsert: async (payload: unknown) => {
            (upserts[table] ??= []).push(payload);
            return { error: null };
          },
        };
      },
    };
    const result = await evaluateCompanion(client as never, "p1");
    expect(result).toMatchObject({ stage: "Guardian" });
    expect(upserts.companion_state).toBeUndefined();
    expect(upserts.companion_evolutions).toBeUndefined();
  });
});
