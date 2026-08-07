import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_RESET_TABLES, resetDemoProgress } from "@/game/demo/demo-reset";

function fakeClient(plantExists = true) {
  const deleted: string[] = [];
  let bondPayload: Record<string, unknown> | null = null;
  let plantPayload: Record<string, unknown> | null = null;

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: plantExists ? { id: "plant-01" } : null,
                  error: null,
                }),
              };
            },
          };
        },
        delete() {
          return {
            eq() {
              return {
                select: async () => {
                  deleted.push(table);
                  return { data: [], count: 0, error: null };
                },
              };
            },
          };
        },
        upsert: async (payload: Record<string, unknown>) => {
          bondPayload = payload;
          return { error: null };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq: async () => {
              plantPayload = payload;
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, deleted, getBondPayload: () => bondPayload, getPlantPayload: () => plantPayload };
}

describe("demo reset", () => {
  it("clears game progress but never sensor readings or growth records", async () => {
    const fake = fakeClient();
    await resetDemoProgress(fake.client, "plant-01");

    expect(fake.deleted).toEqual([...DEMO_RESET_TABLES]);
    expect(fake.deleted).not.toContain("sensor_readings");
    expect(fake.deleted).not.toContain("growth_records");
    expect(fake.getBondPayload()).toMatchObject({ bond_level: 1, total_xp: 0, current_chapter: 1 });
    expect(fake.getPlantPayload()).toEqual({
      current_state: "Happy",
      state_changed_at: "1970-01-01T00:00:00Z",
    });
  });

  it("rejects an unknown plant before deleting anything", async () => {
    const fake = fakeClient(false);
    await expect(resetDemoProgress(fake.client, "missing")).rejects.toMatchObject({
      kind: "unknown-plant",
    });
    expect(fake.deleted).toEqual([]);
  });
});
