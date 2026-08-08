import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateBadges } from "@/game/badges/badge-engine";
import { PLANT_MOODS } from "@/types/events";

// ── Behavior lock for the badge engine's read fan-out ────────────────────
// The engine's ~7 independent reads are being parallelized; these tests pin
// the OBSERVABLE contract — which badges come out of a given DB state, what
// gets upserted, and which rows count as "newly unlocked" — so the refactor
// cannot silently change a condition. The stub routes multiple distinct
// queries against the same table (device_events serves two head:true counts
// AND a mood-row select) by inspecting the recorded builder chain.

interface StubResponse {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

type Responder = (chainCalls: RecordedCall[]) => StubResponse;

const CHAIN_METHODS = [
  "select",
  "eq",
  "neq",
  "in",
  "gte",
  "lt",
  "order",
  "limit",
  "upsert",
  "maybeSingle",
];

function makeSupabase(responders: Record<string, Responder>, log: RecordedCall[] = []) {
  return {
    from(table: string) {
      const chainCalls: RecordedCall[] = [];
      const stub: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        stub[method] = (...args: unknown[]) => {
          const call = { table, method, args };
          chainCalls.push(call);
          log.push(call);
          return stub;
        };
      }
      stub.then = (resolve: (value: StubResponse) => unknown) => {
        const responder = responders[table] ?? (() => ({ data: [], error: null }));
        return Promise.resolve(responder(chainCalls)).then(resolve);
      };
      return stub;
    },
  } as unknown as SupabaseClient;
}

const isHeadCount = (calls: RecordedCall[]) =>
  calls.some(
    (c) => c.method === "select" && (c.args[1] as { head?: boolean } | undefined)?.head,
  );

const PLANT = "plant-01";

interface Fixture {
  completedQuestKeys: string[];
  bond: { bond_level: number; longest_streak: number } | null;
  recentEventCount: number;
  soilEventCount: number;
  seenMoods: string[];
  liveMood: string | null;
  growthRecordCount: number;
  /** plant_badges upsert result — the rows "actually inserted". */
  inserted: string[];
}

function responders(fixture: Fixture): Record<string, Responder> {
  return {
    quests: () => ({
      data: fixture.completedQuestKeys.map((quest_key) => ({ quest_key })),
      error: null,
    }),
    bond_state: () => ({ data: fixture.bond, error: null }),
    device_events: (calls) => {
      if (isHeadCount(calls)) {
        // The soil-mood count is the one filtered with .in(); the plain
        // recent-events count has no .in() step.
        const soil = calls.some((c) => c.method === "in");
        return {
          data: null,
          count: soil ? fixture.soilEventCount : fixture.recentEventCount,
          error: null,
        };
      }
      return {
        data: fixture.seenMoods.map((currentState) => ({ currentState })),
        error: null,
      };
    },
    plants: () => ({
      data: fixture.liveMood ? { current_state: fixture.liveMood } : null,
      error: null,
    }),
    growth_records: () => ({ data: null, count: fixture.growthRecordCount, error: null }),
    plant_badges: () => ({
      data: fixture.inserted.map((badge_key) => ({ badge_key })),
      error: null,
    }),
    bond_events: () => ({ data: null, error: null }),
  };
}

describe("evaluateBadges", () => {
  it("computes earned badges from live state and returns only newly inserted rows", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      responders({
        completedQuestKeys: [
          ...Array.from({ length: 5 }, () => "GIVE_ME_MORE_LIGHT"),
          "COOL_ME_DOWN",
        ],
        bond: { bond_level: 5, longest_streak: 7 },
        recentEventCount: 3,
        soilEventCount: 0,
        seenMoods: ["Happy"],
        liveMood: "Happy",
        growthRecordCount: 2,
        inserted: ["STREAK_7", "PH_GUARDIAN"],
      }),
      log,
    );

    const newlyUnlocked = await evaluateBadges(supabase, PLANT);

    // Earned: FIRST_RESCUE (recovery ≥1), LIGHT_MASTER (light ≥5),
    // LEVEL_5_BOND, STREAK_7 (longest ≥7), PH_GUARDIAN (events, no soil).
    // NOT: COOL_KEEPER (1 < 5), MOOD_SCHOLAR (1 of 6 moods), CARE_VETERAN
    // (6 < 25), CHRONICLER (2 < 5), STREAK_30, LEVEL_10_BOND.
    const upsert = log.find((c) => c.table === "plant_badges" && c.method === "upsert");
    expect(upsert).toBeDefined();
    expect((upsert?.args[0] as Array<{ badge_key: string }>).map((r) => r.badge_key)).toEqual(
      ["FIRST_RESCUE", "LIGHT_MASTER", "LEVEL_5_BOND", "STREAK_7", "PH_GUARDIAN"],
    );

    // Newly unlocked = rows the upsert actually inserted, not all earned.
    expect(newlyUnlocked).toEqual(["STREAK_7", "PH_GUARDIAN"]);

    // BADGE_UNLOCKED is emitted for EVERY earned badge (self-healing sweep),
    // deduplicated by deterministic event_id.
    const emit = log.find((c) => c.table === "bond_events" && c.method === "upsert");
    expect(emit).toBeDefined();
    expect((emit?.args[0] as Array<{ event_id: string }>).map((r) => r.event_id)).toEqual([
      `badge:${PLANT}:FIRST_RESCUE`,
      `badge:${PLANT}:LIGHT_MASTER`,
      `badge:${PLANT}:LEVEL_5_BOND`,
      `badge:${PLANT}:STREAK_7`,
      `badge:${PLANT}:PH_GUARDIAN`,
    ]);
  });

  it("earns MOOD_SCHOLAR only when every mood has been observed", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      responders({
        completedQuestKeys: [],
        bond: null,
        recentEventCount: 0,
        soilEventCount: 0,
        // All six moods seen in history except the live one on plants.
        seenMoods: PLANT_MOODS.slice(0, -1) as unknown as string[],
        liveMood: PLANT_MOODS[PLANT_MOODS.length - 1],
        growthRecordCount: 0,
        inserted: ["MOOD_SCHOLAR"],
      }),
      log,
    );

    const newlyUnlocked = await evaluateBadges(supabase, PLANT);
    expect(newlyUnlocked).toEqual(["MOOD_SCHOLAR"]);
    const upsert = log.find((c) => c.table === "plant_badges" && c.method === "upsert");
    expect((upsert?.args[0] as Array<{ badge_key: string }>).map((r) => r.badge_key)).toEqual(
      ["MOOD_SCHOLAR"],
    );
  });

  it("writes nothing when no badge condition holds", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      responders({
        completedQuestKeys: [],
        bond: null,
        recentEventCount: 0, // no events → PH_GUARDIAN's "no data, no claim"
        soilEventCount: 0,
        seenMoods: [],
        liveMood: null,
        growthRecordCount: 0,
        inserted: [],
      }),
      log,
    );

    const newlyUnlocked = await evaluateBadges(supabase, PLANT);
    expect(newlyUnlocked).toEqual([]);
    expect(log.some((c) => c.method === "upsert")).toBe(false);
  });

  it("treats a missing growth_records table as zero records", async () => {
    const base = responders({
      completedQuestKeys: ["COOL_ME_DOWN"],
      bond: { bond_level: 1, longest_streak: 0 },
      recentEventCount: 1,
      soilEventCount: 1, // soil trouble → no PH_GUARDIAN
      seenMoods: [],
      liveMood: null,
      growthRecordCount: 999, // ignored — the error path must win
      inserted: ["FIRST_RESCUE"],
    });
    const supabase = makeSupabase({
      ...base,
      growth_records: () => ({
        data: null,
        error: { code: "PGRST205", message: "Could not find the table" },
      }),
    });

    const newlyUnlocked = await evaluateBadges(supabase, PLANT);
    // FIRST_RESCUE still lands; CHRONICLER must not (missing table = 0).
    expect(newlyUnlocked).toEqual(["FIRST_RESCUE"]);
  });
});
