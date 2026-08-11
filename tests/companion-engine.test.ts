import { describe, expect, it } from "vitest";
import { evaluateCompanion, syncCompanionForLevel } from "@/game/companion/companion-engine";
import { COMPANION_STAGES, companionStageForLevel, levelForCompanionStage } from "@/types/game";

type DbError = { code?: string; message: string };

function clientFor(options: {
  level?: number;
  state?: Record<string, unknown> | null;
  stateError?: DbError | null;
  upsertError?: (table: string, payload: Record<string, unknown>) => DbError | null;
}) {
  const upserts: Record<string, Record<string, unknown>[]> = {};
  const reads: string[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              reads.push(table);
              if (table === "bond_state") return { data: { bond_level: options.level ?? 1 }, error: null };
              return { data: options.state ?? null, error: options.stateError ?? null };
            },
          }),
        }),
        upsert: async (payload: Record<string, unknown>) => {
          (upserts[table] ??= []).push(payload);
          return { error: options.upsertError?.(table, payload) ?? null };
        },
      };
    },
  };
  return { client: client as never, upserts, reads };
}

describe("level-only companion mapping", () => {
  it("maps one stage per level and keeps Lv.10+ at Legend", () => {
    expect(COMPANION_STAGES.map((_, index) => companionStageForLevel(index + 1)))
      .toEqual([...COMPANION_STAGES]);
    expect(companionStageForLevel(0)).toBe("Seed");
    expect(companionStageForLevel(99)).toBe("Legend");
    expect(levelForCompanionStage("Radiant")).toBe(9);
  });

  it("never reads quests or care counters", async () => {
    const { client, reads } = clientFor({
      level: 4,
      state: { plant_id: "p1", cycle: 1, stage: "Bud", form_key: "steady" },
    });
    const result = await evaluateCompanion(client, "p1");
    expect(result).toMatchObject({ stage: "Bud" });
    expect(reads).toEqual(["bond_state", "companion_state"]);
    expect(reads).not.toContain("quests");
  });

  it("records every crossed level on a multi-level jump", async () => {
    const { client, upserts } = clientFor({
      state: { plant_id: "p1", cycle: 1, stage: "Seed", form_key: "balanced" },
    });
    const result = await syncCompanionForLevel(client, "p1", 6, new Date("2026-08-11T12:00:00Z"));
    expect(upserts.companion_evolutions.map((row) => row.stage))
      .toEqual(["Sprout", "Seedling", "Bud", "Bloom", "Fruit"]);
    expect(upserts.companion_evolutions.every((row) =>
      (row.care_snapshot as { rule?: string }).rule === "bond-level",
    )).toBe(true);
    expect(upserts.companion_state.at(-1)).toMatchObject({ stage: "Fruit" });
    expect(result).toMatchObject({ stage: "Fruit" });
  });

  it("normalizes a legacy care-ahead row to its exact level stage", async () => {
    const { client, upserts } = clientFor({
      state: { plant_id: "p1", cycle: 1, stage: "Guardian", form_key: "cool" },
    });
    const result = await syncCompanionForLevel(client, "p1", 3);
    expect(upserts.companion_state).toHaveLength(1);
    expect(upserts.companion_state[0]).toMatchObject({ stage: "Seedling", form_key: "cool" });
    expect(upserts.companion_evolutions).toBeUndefined();
    expect(upserts.bond_events).toBeUndefined();
    expect(result).toMatchObject({ stage: "Seedling" });
  });

  it("does not write when the persisted stage already matches the level", async () => {
    const { client, upserts } = clientFor({
      state: { plant_id: "p1", cycle: 1, stage: "Elder", form_key: "steady" },
    });
    const result = await syncCompanionForLevel(client, "p1", 8);
    expect(result).toMatchObject({ stage: "Elder" });
    expect(upserts).toEqual({});
  });

  it("gracefully no-ops when the companion migration is missing", async () => {
    const { client, upserts } = clientFor({
      state: null,
      stateError: { code: "PGRST205", message: "companion_state missing" },
    });
    await expect(syncCompanionForLevel(client, "p1", 4)).resolves.toBeNull();
    expect(upserts).toEqual({});
  });
});
