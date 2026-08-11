import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/milestone21-level-evolution.sql", "utf8");

describe("milestone21 level-only evolution", () => {
  it("maps Lv.1 through Lv.10 and caps the visual stage at Legend", () => {
    for (const stage of ["Seed", "Sprout", "Seedling", "Bud", "Bloom", "Fruit", "Guardian", "Elder", "Radiant", "Legend"]) {
      expect(sql).toContain(`'${stage}'`);
    }
    expect(sql).toContain("least(10, greatest(1, coalesce(p_level, 1)))");
  });

  it("synchronizes every bond-level write and backfills existing rows", () => {
    expect(sql).toContain("after insert or update of bond_level on public.bond_state");
    expect(sql).toContain("for v_bond in select plant_id, bond_level from public.bond_state loop");
    expect(sql).toContain("set stage = v_target");
  });

  it("records crossed stages with a level-only audit reason", () => {
    expect(sql).toContain("'rule', 'bond-level'");
    expect(sql).toContain("'COMPANION_EVOLVED'");
    expect(sql).not.toMatch(/affinity_count|day_count|care_count\s*>|completed.*quest/i);
  });
});
