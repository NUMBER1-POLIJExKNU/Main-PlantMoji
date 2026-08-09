import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the milestone18 invariants: additive + re-runnable, seeds-only
// mutation (XP/Bond Level must never be touched by shop SQL), engine-only
// RPC execution, and realtime on shop_purchases.

const sql = readFileSync(
  resolve(process.cwd(), "supabase/milestone18-seed-shop.sql"),
  "utf8",
).toLowerCase();

describe("milestone18-seed-shop.sql", () => {
  it("is additive and re-runnable", () => {
    expect(sql).toContain("add column if not exists seeds integer not null default 0");
    expect(sql).toContain("create table if not exists public.seed_rewards");
    expect(sql).toContain("create table if not exists public.shop_purchases");
    expect(sql).toContain("create or replace function public.award_seeds");
    expect(sql).toContain("create or replace function public.purchase_item");
    expect(sql).toContain("create or replace function public.equip_item");
    expect(sql).not.toContain("drop table");
  });

  it("dedupes grants by reward_key exactly like xp_rewards", () => {
    expect(sql).toContain("on conflict (reward_key) do nothing");
  });

  it("never writes XP or Bond Level (seeds are the only spendable value)", () => {
    expect(sql).not.toMatch(/total_xp\s*=/);
    expect(sql).not.toMatch(/bond_level\s*=/);
  });

  it("keeps the RPCs engine-only (service_role) like milestone17", () => {
    for (const fn of ["award_seeds", "purchase_item", "equip_item"]) {
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`));
    }
  });

  it("adds shop_purchases to realtime with the guarded pattern", () => {
    expect(sql).toContain("alter publication supabase_realtime add table public.shop_purchases");
    expect(sql).toContain("exception when duplicate_object then null");
  });

  it("keeps the seed ledger internal (no anon read policy) but shop_purchases public-readable", () => {
    expect(sql).toContain('create policy "public read shop_purchases"');
    expect(sql).not.toContain('create policy "public read seed_rewards"');
  });
});
