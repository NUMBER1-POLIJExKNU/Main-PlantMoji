import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { PLANT_MOODS, type PlantMood } from "@/types/events";
import { COMPANION_STAGES } from "@/types/game";
import {
  MOOD_SPRITE,
  MOOD_STATUS_CHIP,
  PHASE_SLUG,
  PHASE_TIER_CAP,
  SPRITE_MOODS,
  SPRITE_PHASES,
  STAGE_PHASE,
  TIER_THRESHOLDS,
  accessoryTier,
  spriteAssetPath,
  spriteMood,
  spriteSrc,
  stagePhase,
  type SpritePhase,
  type SpriteTier,
} from "@/lib/jamkachu-sprite";

// Guards the two halves of the Jamkachu sprite mapping against drift:
// public/farm/jamkachu-sprite.js drives the production farm layer while
// src/lib/jamkachu-sprite.ts drives the React surfaces. If the tables
// disagree, the same plant would wear a different face (or accessory) on
// different routes. Same pattern as tests/companion-ladder-parity.test.ts:
// read the plain script, evaluate it in a node:vm sandbox, then compare.
//
// The plan's decided tables (docs/superpowers/plans/
// 2026-08-11-kiki-design-integration.md) are also pinned literally below so
// neither side can "agree" on a rewrite of the design decision.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const farmSpritePath = path.resolve(repoRoot, "public/farm/jamkachu-sprite.js");

describe("React sprite mapping pins the decided design tables", () => {
  it("buckets all 10 companion stages into the 4 drawn phases exactly as planned", () => {
    expect(STAGE_PHASE).toEqual({
      Seed: 1,
      Sprout: 2,
      Seedling: 2,
      Bud: 3,
      Bloom: 3,
      Fruit: 4,
      Guardian: 4,
      Elder: 4,
      Radiant: 4,
      Legend: 4,
    });
    for (const stage of COMPANION_STAGES) {
      expect(SPRITE_PHASES).toContain(stagePhase(stage));
    }
    // No stage (dead-routed plant-home) keeps the old full-grown default.
    expect(stagePhase(undefined)).toBe(4);
  });

  it("maps every PlantMood to a drawn sprite mood — no silent unmapped mood", () => {
    expect(Object.keys(MOOD_SPRITE).sort()).toEqual([...PLANT_MOODS].sort());
    for (const mood of PLANT_MOODS) {
      expect(SPRITE_MOODS).toContain(spriteMood(mood));
    }
    expect(MOOD_SPRITE).toEqual({
      Happy: "happy",
      Overheating: "overheat",
      TooCold: "plain",
      DryAir: "thirsty",
      HumidAir: "plain",
      Sleepy: "sleepy",
      SoilAcidic: "plain",
      SoilAlkaline: "plain",
    });
  });

  it("keeps the plain-body moods distinguishable via status chips", () => {
    expect(MOOD_STATUS_CHIP).toEqual({
      TooCold: "🥶",
      HumidAir: "💦",
      SoilAcidic: "🧪",
      SoilAlkaline: "🧪",
    });
    // Every mood that collapses onto the shared "plain" body needs a chip.
    for (const mood of PLANT_MOODS) {
      if (MOOD_SPRITE[mood] === "plain") {
        expect(MOOD_STATUS_CHIP[mood], `${mood} shares the plain body but has no chip`).toBeTruthy();
      }
    }
  });

  it("night sleep overrides any live mood with the sleepy sprite", () => {
    for (const mood of PLANT_MOODS) {
      expect(spriteMood(mood, true)).toBe("sleepy");
    }
  });

  it("awards accessory tiers at the planned bond thresholds with phase clamps", () => {
    expect(TIER_THRESHOLDS).toEqual({ bow: 4, ribbon: 8 });
    expect(PHASE_TIER_CAP).toEqual({ 1: "", 2: "", 3: "bow", 4: "ribbon" });

    // Thresholds on the uncapped phase.
    expect(accessoryTier(0, 4)).toBe("");
    expect(accessoryTier(3, 4)).toBe("");
    expect(accessoryTier(4, 4)).toBe("bow");
    expect(accessoryTier(7, 4)).toBe("bow");
    expect(accessoryTier(8, 4)).toBe("ribbon");
    expect(accessoryTier(12, 4)).toBe("ribbon");

    // Phase clamps: p1/p2 always bare, p3 caps at bow.
    expect(accessoryTier(12, 1)).toBe("");
    expect(accessoryTier(12, 2)).toBe("");
    expect(accessoryTier(12, 3)).toBe("bow");
    expect(accessoryTier(5, 3)).toBe("bow");
    expect(accessoryTier(3, 3)).toBe("");

    // Garbage bond levels degrade to bare, never throw.
    expect(accessoryTier(Number.NaN, 4)).toBe("");
    expect(accessoryTier(-3, 4)).toBe("");
  });

  it("builds sprite paths matching the committed asset naming", () => {
    expect(spriteSrc({ stage: "Seedling", mood: "DryAir" })).toBe(
      "/farm/assets/jamkachu/4x/plant-p2-sprout-thirsty.png",
    );
    expect(spriteSrc({ stage: "Legend", mood: "Happy", bondLevel: 9 })).toBe(
      "/farm/assets/jamkachu/4x/plant-p4-fruit-happy-ribbon.png",
    );
    expect(spriteSrc({ stage: "Bud", mood: "TooCold", bondLevel: 12, scale: "2x" })).toBe(
      "/farm/assets/jamkachu/2x/plant-p3-flower-plain-bow.png",
    );
    expect(spriteSrc({ stage: "Seed", mood: "Overheating", bondLevel: 12 })).toBe(
      "/farm/assets/jamkachu/4x/plant-p1-seed-overheat.png",
    );
    expect(spriteSrc({ mood: "Happy", sleeping: true })).toBe(
      "/farm/assets/jamkachu/4x/plant-p4-fruit-sleepy.png",
    );
  });

  it("only ever points at sprite files that exist on disk", () => {
    const sources = new Set<string>();
    for (const stage of [undefined, ...COMPANION_STAGES]) {
      for (const mood of PLANT_MOODS) {
        for (const bondLevel of [0, 4, 8, 12]) {
          for (const sleeping of [false, true]) {
            for (const scale of ["1x", "2x", "4x"] as const) {
              sources.add(spriteSrc({ stage, mood, bondLevel, sleeping, scale }));
            }
          }
        }
      }
    }
    expect(sources.size).toBeGreaterThan(0);
    for (const src of sources) {
      const file = path.join(repoRoot, "public", src.replace(/^\//, ""));
      expect(existsSync(file), `missing sprite file for ${src}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Farm mirror parity. public/farm/jamkachu-sprite.js is produced by the farm
// integration task; until it lands this block is skipped (and starts guarding
// the moment the file exists).
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

/** Accepts 1, "1", "p1" — the farm layer may store phases either way. */
function normalizePhase(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replace(/^p/i, ""), 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new Error(`unrecognizable phase value: ${JSON.stringify(value)}`);
}

/** Accepts "", null, undefined, "bare"/"none" as the bare tier. */
function normalizeTier(value: unknown): SpriteTier {
  if (value == null || value === "" || value === "bare" || value === "none") return "";
  if (value === "bow" || value === "ribbon") return value;
  throw new Error(`unrecognizable tier value: ${JSON.stringify(value)}`);
}

function pickTable(hosts: (AnyRecord | undefined)[], names: string[]): AnyRecord | null {
  for (const host of hosts) {
    if (!host) continue;
    for (const name of names) {
      const value = host[name];
      if (value && typeof value === "object") return value as AnyRecord;
    }
  }
  return null;
}

function loadFarmSprite() {
  const source = readFileSync(farmSpritePath, "utf8");
  // Enough DOM surface for a display-only script to load; anything it cannot
  // find must be handled by the script itself (it already has to survive
  // pages without a mascot).
  const noop = () => undefined;
  const element = () => ({
    style: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    getContext: () => null,
  });
  const documentStub = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: element,
    addEventListener: noop,
    removeEventListener: noop,
    documentElement: element(),
    body: element(),
  };
  const stubWindow: AnyRecord = {
    document: documentStub,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    requestAnimationFrame: noop,
    setTimeout: noop,
    clearTimeout: noop,
  };
  const sandbox: AnyRecord = {
    window: stubWindow,
    document: documentStub,
    Image: class {
      src = "";
      onload: unknown = null;
      onerror: unknown = null;
    },
    URL: { createObjectURL: () => "blob:stub", revokeObjectURL: noop },
    console,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: farmSpritePath });
  const pmSprite = (stubWindow.PMSprite ?? null) as AnyRecord | null;
  if (!pmSprite) {
    throw new Error("jamkachu-sprite.js did not assign window.PMSprite");
  }
  const tables = (pmSprite.TABLES ?? undefined) as AnyRecord | undefined;
  const hosts: (AnyRecord | undefined)[] = [tables, pmSprite, stubWindow, sandbox];
  return {
    pmSprite,
    stageTable: pickTable(hosts, ["STAGE_PHASE", "stagePhase", "STAGE_TO_PHASE", "stageToPhase"]),
    moodTable: pickTable(hosts, ["MOOD_SPRITE", "moodSprite", "MOOD_TO_SPRITE", "moodToSprite"]),
    thresholdTable: pickTable(hosts, ["TIER_THRESHOLDS", "tierThresholds", "THRESHOLDS"]),
    capTable: pickTable(hosts, ["PHASE_TIER_CAP", "phaseTierCap", "TIER_CAPS", "tierCaps"]),
    chipTable: pickTable(hosts, ["MOOD_STATUS_CHIP", "moodStatusChip", "STATUS_CHIP", "statusChip"]),
  };
}

describe.skipIf(!existsSync(farmSpritePath))("farm jamkachu-sprite mirror parity", () => {
  it("exposes the mapping tables on window.PMSprite", () => {
    const farm = loadFarmSprite();
    expect(farm.stageTable, "PMSprite must expose the stage→phase table").toBeTruthy();
    expect(farm.moodTable, "PMSprite must expose the mood→sprite table").toBeTruthy();
    expect(farm.thresholdTable, "PMSprite must expose the bond tier thresholds").toBeTruthy();
    expect(farm.capTable, "PMSprite must expose the phase tier clamps").toBeTruthy();
  });

  it("stage→phase table is identical to the React mirror", () => {
    const farm = loadFarmSprite();
    const normalized = Object.fromEntries(
      COMPANION_STAGES.map((stage) => [stage, normalizePhase(farm.stageTable![stage])]),
    );
    expect(normalized).toEqual(STAGE_PHASE);
    expect(Object.keys(farm.stageTable!).sort()).toEqual([...COMPANION_STAGES].sort());
  });

  it("mood→sprite table is identical to the React mirror", () => {
    const farm = loadFarmSprite();
    const normalized = Object.fromEntries(
      PLANT_MOODS.map((mood) => [mood, farm.moodTable![mood]]),
    );
    expect(normalized).toEqual(MOOD_SPRITE);
  });

  it("bond thresholds and phase clamps are identical to the React mirror", () => {
    const farm = loadFarmSprite();
    expect(Number(farm.thresholdTable!.bow)).toBe(TIER_THRESHOLDS.bow);
    expect(Number(farm.thresholdTable!.ribbon)).toBe(TIER_THRESHOLDS.ribbon);

    const caps: Record<number, SpriteTier> = {};
    for (const [key, value] of Object.entries(farm.capTable!)) {
      caps[normalizePhase(key)] = normalizeTier(value);
    }
    expect(caps).toEqual(PHASE_TIER_CAP);
  });

  it("status chips for the plain-body moods match, when the farm exposes them", () => {
    const farm = loadFarmSprite();
    if (!farm.chipTable) return; // chips may live inline in the repaint DOM code
    for (const mood of Object.keys(MOOD_STATUS_CHIP) as PlantMood[]) {
      expect(farm.chipTable[mood]).toBe(MOOD_STATUS_CHIP[mood]);
    }
  });

  it("behaves identically wherever the farm exposes the mapping functions", () => {
    const farm = loadFarmSprite();
    const fileOf = (value: unknown) => String(value).split("/").pop();

    const farmStagePhase = farm.pmSprite.stagePhase;
    if (typeof farmStagePhase === "function") {
      for (const stage of COMPANION_STAGES) {
        expect(normalizePhase(farmStagePhase(stage))).toBe(stagePhase(stage));
      }
    }
    const farmSpriteMood = farm.pmSprite.spriteMood;
    if (typeof farmSpriteMood === "function") {
      for (const mood of PLANT_MOODS) {
        expect(farmSpriteMood(mood, false)).toBe(spriteMood(mood, false));
        expect(farmSpriteMood(mood, true)).toBe(spriteMood(mood, true));
      }
    }
    const farmAccessoryTier = farm.pmSprite.accessoryTier;
    if (typeof farmAccessoryTier === "function") {
      for (const phase of SPRITE_PHASES) {
        for (const bond of [0, 3, 4, 7, 8, 12]) {
          expect(normalizeTier(farmAccessoryTier(bond, phase))).toBe(accessoryTier(bond, phase));
        }
      }
    }
    const farmSpriteSrc = farm.pmSprite.spriteSrc;
    if (typeof farmSpriteSrc === "function") {
      // Compare filenames only: the farm layer resolves relative to /farm/.
      for (const stage of COMPANION_STAGES) {
        for (const mood of PLANT_MOODS) {
          expect(fileOf(farmSpriteSrc({ stage, mood, bondLevel: 8 }))).toBe(
            fileOf(spriteSrc({ stage, mood, bondLevel: 8 })),
          );
        }
      }
    }
  });
});

describe("sprite path helper", () => {
  it("covers all drawn phases with their filename slugs", () => {
    expect(PHASE_SLUG).toEqual({ 1: "seed", 2: "sprout", 3: "flower", 4: "fruit" });
    for (const phase of SPRITE_PHASES) {
      expect(spriteAssetPath(phase as SpritePhase, "happy")).toBe(
        `/farm/assets/jamkachu/4x/plant-p${phase}-${PHASE_SLUG[phase as SpritePhase]}-happy.png`,
      );
    }
  });
});
