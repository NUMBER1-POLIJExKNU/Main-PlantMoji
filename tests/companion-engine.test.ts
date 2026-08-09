import { describe, expect, it } from "vitest";
import { affinityForQuest, careForm, eligibleCompanionStage, evaluateCompanion, type VerifiedCare } from "@/game/companion/companion-engine";
import type { QuestKey } from "@/types/game";

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

type StateUpsertError = { code?: string; message: string };

/** Fake Supabase client for evaluateCompanion sweeps: seeded companion_state row,
 *  completed-quest rows, and an optional queue of companion_state upsert errors
 *  (each shifted once, in order) to simulate missing milestone16 columns. */
function sweepClient(options: {
  state: Record<string, unknown> | null;
  care?: { quest_key: string; completed_at: string }[];
  stateUpsertErrors?: StateUpsertError[];
}) {
  const upserts: Record<string, unknown[]> = {};
  const pendingStateErrors = [...(options.stateUpsertErrors ?? [])];
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
        upsert: async (payload: unknown) => {
          (upserts[table] ??= []).push(payload);
          return { error: table === "companion_state" ? pendingStateErrors.shift() ?? null : null };
        },
      };
    },
  };
  return { client: client as never, upserts };
}

const questRows = (items: { questKey: string; completedAt: string }[]) =>
  items.map((item) => ({ quest_key: item.questKey, completed_at: item.completedAt }));

describe("progress counters (display-only)", () => {
  it("writes progress counters on a non-evolving sweep", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady" },
      care: questRows(ladderCare(1, 1, 1)),
    });
    const result = await evaluateCompanion(client, "p1");
    expect(upserts.companion_state.at(-1)).toMatchObject({
      care_count: 1, affinity_count: 1, day_count: 1, stage: "Sprout",
    });
    expect(upserts.companion_evolutions).toBeUndefined();
    expect(result).toMatchObject({ stage: "Sprout", care_count: 1, affinity_count: 1, day_count: 1 });
  });

  it("skips the write when stored counters already match (no churn)", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady", care_count: 1, affinity_count: 1, day_count: 1 },
      care: questRows(ladderCare(1, 1, 1)),
    });
    const result = await evaluateCompanion(client, "p1");
    expect(upserts.companion_state).toBeUndefined();
    expect(result).toMatchObject({ stage: "Sprout" });
  });

  it("skips counters when milestone16 is missing", async () => {
    const { client, upserts } = sweepClient({
      state: { plant_id: "p1", cycle: 1, stage: "Sprout", form_key: "steady" },
      care: questRows(ladderCare(1, 1, 1)),
      stateUpsertErrors: [{ code: "PGRST204", message: "Could not find the 'care_count' column of 'companion_state' in the schema cache" }],
    });
    const result = await evaluateCompanion(client, "p1");
    expect(upserts.companion_state).toHaveLength(2);
    expect(upserts.companion_state.at(-1)).not.toHaveProperty("care_count");
    expect(upserts.companion_state.at(-1)).not.toHaveProperty("affinity_count");
    expect(upserts.companion_state.at(-1)).not.toHaveProperty("day_count");
    expect(upserts.companion_state.at(-1)).toMatchObject({ stage: "Sprout" });
    expect(result).toMatchObject({ stage: "Sprout" });
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

describe("no-demotion invariant", () => {
  it("keeps a persisted stage that sits above current eligibility", async () => {
    const upserts: Record<string, unknown[]> = {};
    const client = {
      from(table: string) {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
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
