import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the milestone19 invariants: additive + re-runnable, exactly two
// presentation kinds, text/jsonb rows only (the guardian NEVER persists
// what it sees), zero reward surface, browser read-only, realtime on.

const sql = readFileSync(
  resolve(process.cwd(), "supabase/milestone19-camera-guardian.sql"),
  "utf8",
).toLowerCase();

describe("milestone19-camera-guardian.sql", () => {
  it("is additive and re-runnable", () => {
    expect(sql).toContain("create table if not exists public.camera_events");
    expect(sql).toContain("create index if not exists camera_events_plant_time_idx");
    expect(sql).not.toContain("drop table");
  });

  it("allows exactly the two presentation kinds", () => {
    expect(sql).toContain("check (kind in ('touch', 'pest_advice'))");
  });

  it("creates NO storage bucket and no binary columns (nothing visual persists)", () => {
    expect(sql).not.toContain("storage.buckets");
    expect(sql).not.toContain("bytea");
    expect(sql).not.toContain("photo_url");
  });

  it("never touches XP, Bond Level, or the spendable currency (camera grants nothing)", () => {
    expect(sql).not.toMatch(/total_xp/);
    expect(sql).not.toMatch(/bond_level/);
    expect(sql).not.toMatch(/seeds/);
    expect(sql).not.toMatch(/xp_rewards/);
  });

  it("is read-only for browsers: public read policy, no anon write policy, RLS on", () => {
    expect(sql).toContain("alter table public.camera_events enable row level security");
    expect(sql).toContain('create policy "public read camera_events"');
    expect(sql).not.toMatch(/create policy [^;]*(insert|update|delete)/);
  });

  it("adds camera_events to realtime with the guarded pattern", () => {
    expect(sql).toContain("alter publication supabase_realtime add table public.camera_events");
    expect(sql).toContain("exception when duplicate_object then null");
  });
});
