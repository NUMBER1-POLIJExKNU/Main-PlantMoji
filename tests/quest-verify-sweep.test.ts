// BUG A regression: the lazy timestamp sweep (evaluateQuests) must not
// complete a VERIFYING recovery quest on elapsed time alone. Mood hysteresis
// (e.g. Overheating enter >=28 / recover <=26) is wider than a quest's own
// verify threshold (COOL_ME_DOWN's verifyTemperatureMax 26), so the sensor
// can sit in the dead zone (27°C: below "enter Overheating" but above the
// quest's own recovery bound) for the whole verification window without any
// PLANT_STATE_CHANGED event ever firing to re-check it. The completion
// decision point must consult the latest persisted sensor reading itself.
//
// Pure test against the real quest-engine module — no server-only imports in
// its dependency graph (crop-profile-data.ts, crop-profiles.ts are plain
// modules), so a lightweight table-aware Supabase stub is enough, same style
// as tests/settle-sweep.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateQuests } from "@/game/quests/quest-engine";

const PLANT = "plant-01";
const QUEST_ID = "q-cool-down";

interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

type Responder = (calls: RecordedCall[]) => { data: unknown; error: unknown };

const CHAIN_METHODS = ["select", "eq", "in", "order", "limit", "update", "maybeSingle", "upsert"];

function makeSupabase(responders: Record<string, Responder>, log: RecordedCall[]) {
  return {
    from(table: string) {
      const calls: RecordedCall[] = [];
      const chain: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        chain[method] = (...args: unknown[]) => {
          const call = { table, method, args };
          calls.push(call);
          log.push(call);
          return chain;
        };
      }
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          (responders[table] ?? (() => ({ data: [], error: null })))(calls),
        ).then(resolve, reject);
      return chain;
    },
  };
}

/** COOL_ME_DOWN: recovery, requiredSeconds 300, verifyTemperatureMax 26
 *  (matches the default strawberry profile's overheating.recoverAtOrBelow,
 *  same value the handoff repro uses). */
function questRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: QUEST_ID,
    plant_id: PLANT,
    quest_key: "COOL_ME_DOWN",
    status: "VERIFYING",
    xp_reward: 30,
    started_at: "2026-08-09T00:00:00.000Z",
    verifying_since: "2026-08-09T00:00:00.000Z",
    completed_at: null,
    expired_at: null,
    created_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

// verifying_since + 300s exactly — the sweep's doneMs <= nowMs boundary.
const NOW = new Date("2026-08-09T00:05:00.000Z");

function baseResponders(overrides: Partial<Record<string, Responder>> = {}): Record<string, Responder> {
  return {
    quests: (calls) => {
      const updateCall = calls.find((c) => c.method === "update");
      if (updateCall) {
        const patch = updateCall.args[0] as Record<string, unknown>;
        return { data: [{ ...questRow(), ...patch }], error: null };
      }
      return { data: [questRow()], error: null };
    },
    // One fixed row answers both the current_state/state_changed_at read and
    // getPlantCropProfile's id/crop_profile_key read — consumers only look at
    // the keys they need, and a missing crop_profile_key defaults to the
    // strawberry profile via getCropProfile(undefined).
    plants: () => ({
      data: {
        id: PLANT,
        current_state: "Happy",
        state_changed_at: "2026-08-09T00:00:00.000Z",
        crop_profile_key: null,
      },
      error: null,
    }),
    sensor_readings: () => ({ data: null, error: null }),
    bond_events: () => ({ data: null, error: null }),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("evaluateQuests VERIFYING completion re-checks the latest sensor reading", () => {
  it("does NOT complete when the window elapsed but the latest sensor reading is still above verifyTemperatureMax (dead zone: 27°C vs threshold 26°C)", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      baseResponders({
        sensor_readings: () => ({
          data: {
            temperature: 27,
            humidity: null,
            soil_ph: null,
            light: null,
            recorded_at: "2026-08-09T00:04:30.000Z",
          },
          error: null,
        }),
      }),
      log,
    );

    const result = await evaluateQuests(supabase as never, PLANT, NOW);

    expect(result.completed).toHaveLength(0);

    // Consistent with the existing relapse path: restart verification rather
    // than stranding the quest or silently completing it.
    const updates = log.filter((c) => c.table === "quests" && c.method === "update");
    expect(updates).toHaveLength(1);
    const patch = updates[0].args[0] as Record<string, unknown>;
    expect(patch.status).toBe("ACTIVE");
    expect(patch.verifying_since).toBeNull();

    // No completion event must have been emitted for a quest that didn't
    // actually complete.
    const bondEventUpserts = log.filter((c) => c.table === "bond_events");
    expect(bondEventUpserts).toHaveLength(0);
  });

  it("completes once the latest sensor reading satisfies the threshold (25°C <= 26°C)", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      baseResponders({
        sensor_readings: () => ({
          data: {
            temperature: 25,
            humidity: null,
            soil_ph: null,
            light: null,
            recorded_at: "2026-08-09T00:04:30.000Z",
          },
          error: null,
        }),
      }),
      log,
    );

    const result = await evaluateQuests(supabase as never, PLANT, NOW);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].id).toBe(QUEST_ID);
    const bondEventUpserts = log.filter((c) => c.table === "bond_events");
    expect(bondEventUpserts).toHaveLength(1);
  });

  it("completes exactly at the threshold boundary (26°C, the verify bound itself)", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      baseResponders({
        sensor_readings: () => ({
          data: {
            temperature: 26,
            humidity: null,
            soil_ph: null,
            light: null,
            recorded_at: "2026-08-09T00:04:30.000Z",
          },
          error: null,
        }),
      }),
      log,
    );

    const result = await evaluateQuests(supabase as never, PLANT, NOW);
    expect(result.completed).toHaveLength(1);
  });

  it("degrades gracefully and still completes when sensor_readings has no data (missing migration / no reading yet)", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(baseResponders(), log);

    const result = await evaluateQuests(supabase as never, PLANT, NOW);

    expect(result.completed).toHaveLength(1);
  });

  it("degrades gracefully when sensor_readings table is missing entirely (PGRST205)", async () => {
    const log: RecordedCall[] = [];
    const supabase = makeSupabase(
      baseResponders({
        sensor_readings: () => ({
          data: null,
          error: { code: "PGRST205", message: "Could not find the table 'sensor_readings' in the schema cache" },
        }),
      }),
      log,
    );

    const result = await evaluateQuests(supabase as never, PLANT, NOW);

    expect(result.completed).toHaveLength(1);
  });
});
