import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/milestone10-jember-crop-catalog.sql"),
  "utf8",
);

const JEMBER_PROFILE_KEYS = [
  "rice",
  "maize",
  "tobacco",
  "coconut",
  "robusta-coffee",
  "sugarcane",
  "soybean",
  "cayenne-pepper",
  "watermelon",
  "red-chili",
] as const;

function between(start: string, end: string) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return migration.slice(startIndex, endIndex);
}

function tupleFor(block: string, key: string) {
  const start = block.indexOf(`  ('${key}',`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = block.indexOf("\n  ('", start + 4);
  return block.slice(start, next === -1 ? block.length : next);
}

describe("Jember crop profile database catalog", () => {
  const profileSeed = between(
    "insert into public.crop_profiles (",
    "on conflict (key) do update set",
  );
  const versionSeed = between(
    "insert into public.crop_profile_versions (",
    "on conflict (crop_profile_key, version) do update set",
  );

  it("creates normalized version and provenance tables", () => {
    expect(migration).toContain("create table if not exists public.crop_profiles");
    expect(migration).toContain("create table if not exists public.crop_profile_versions");
    expect(migration).toContain("create table if not exists public.crop_profile_sources");
    expect(migration).toContain("foreign key (crop_profile_key) references public.crop_profiles (key)");
    expect(migration).toContain("check (quantitative_light_claim = false)");
  });

  it("seeds the existing strawberry plus exactly ten Jember additions", () => {
    const profileKeys = [...profileSeed.matchAll(/^  \('([^']+)'/gm)].map((match) => match[1]);
    const versionKeys = [...versionSeed.matchAll(/^  \('([^']+)', 1,/gm)].map((match) => match[1]);

    expect(profileKeys).toEqual(["strawberry", ...JEMBER_PROFILE_KEYS]);
    expect(versionKeys).toEqual(["strawberry", ...JEMBER_PROFILE_KEYS]);
    expect(new Set(profileKeys).size).toBe(11);
  });

  it("stores BPS Jember 2024 evidence instead of an unsupported global ranking", () => {
    expect(tupleFor(profileSeed, "rice")).toContain('"value":158727');
    expect(tupleFor(profileSeed, "maize")).toContain('"value":68380');
    expect(tupleFor(profileSeed, "tobacco")).toContain('"value":15397.90');
    expect(tupleFor(profileSeed, "cayenne-pepper")).toContain('"value":1581');
    expect(tupleFor(profileSeed, "watermelon")).toContain('"value":1270');
    expect(migration).toContain("'bps-jember-figures-2025'");
    expect(migration).toContain("'kementan-land-evaluation'");
    expect(migration).toContain("'jember-robusta-identity'");
  });

  it("keeps unreviewed field profiles out of automatic mood and quest decisions", () => {
    expect(tupleFor(profileSeed, "strawberry")).toContain("'active', 'supported'");
    for (const key of JEMBER_PROFILE_KEYS) {
      expect(tupleFor(profileSeed, key)).not.toContain("'active'");
      expect(tupleFor(versionSeed, key)).toContain('"approved_for_quests":false');
    }
    expect(tupleFor(profileSeed, "tobacco")).toContain("'reference_only', 'unsupported'");
    expect(tupleFor(versionSeed, "tobacco")).toContain("'reference_only'");
  });

  it("preserves missing and open-ended humidity evidence as null bounds", () => {
    expect(tupleFor(versionSeed, "maize")).toMatch(/16, 32, 42, null, 5\.8, 7\.8/);
    expect(tupleFor(versionSeed, "coconut")).toMatch(/20, 35, 60, null, 5\.2, 7\.5/);
    expect(tupleFor(versionSeed, "sugarcane")).toMatch(/21, 34, null, 70, 5\.5, 7\.5/);
    expect(tupleFor(versionSeed, "red-chili")).toMatch(/14, 30, null, null, 6\.0, 7\.6/);
  });

  it("stores the official cabai rawit cultivation values without inventing a light percentage", () => {
    const cayenne = tupleFor(versionSeed, "cayenne-pepper");
    expect(cayenne).toMatch(/18, 30, 18, 30, 60, 80, 6\.0, 7\.0/);
    expect(cayenne).toContain("binary LDR only");
    expect(cayenne).not.toContain("60-70% sunlight");
  });

  it("replaces the strawberry-only plant check with a catalog foreign key", () => {
    expect(migration).toContain("drop constraint if exists plants_crop_profile_key_check");
    expect(migration).toContain("add constraint plants_crop_profile_key_fkey");
    expect(migration).toContain("on update cascade on delete restrict");
  });
});
