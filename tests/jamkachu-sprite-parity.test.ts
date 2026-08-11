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
import { GOLDPOT_RAMP, POT_ITEM_RAMPS, POT_RAMP, POT_TOP_FRACTION, SKIN_RAMPS } from "@/lib/sprite-palette";

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
      TooCold: "sleepy",
      DryAir: "unwell",
      HumidAir: "unwell",
      Sleepy: "sleepy",
      SoilAcidic: "unwell",
      SoilAlkaline: "unwell",
    });
  });

  it("never renders the faceless decorative body for a mood", () => {
    // The pack's "plain" file draws leaf veins where the face goes — it is
    // the designer's decorative body, not a neutral expression. Mapping a
    // mood onto it once shipped a faceless plant on off-pH and cold days.
    for (const mood of PLANT_MOODS) {
      expect(spriteMood(mood), `${mood} renders the faceless body`).not.toBe("plain");
      expect(spriteMood(mood, true)).not.toBe("plain");
    }
  });

  it("keeps moods that share a drawn face distinguishable via status chips", () => {
    expect(MOOD_STATUS_CHIP).toEqual({
      TooCold: "🥶",
      Sleepy: "🌙",
      DryAir: "🌬️",
      HumidAir: "💦",
      SoilAcidic: "🧪",
      SoilAlkaline: "🧪",
    });
    // Any mood sharing its body with another mood needs a chip to tell it
    // apart; a mood with its own face does not.
    const bodyCounts = new Map<string, number>();
    for (const mood of PLANT_MOODS) bodyCounts.set(MOOD_SPRITE[mood], (bodyCounts.get(MOOD_SPRITE[mood]) ?? 0) + 1);
    for (const mood of PLANT_MOODS) {
      if ((bodyCounts.get(MOOD_SPRITE[mood]) ?? 0) > 1) {
        expect(MOOD_STATUS_CHIP[mood], `${mood} shares a face but has no chip`).toBeTruthy();
      }
    }
  });

  it("night sleep overrides any live mood with the sleepy sprite", () => {
    for (const mood of PLANT_MOODS) {
      expect(spriteMood(mood, true)).toBe("sleepy");
    }
  });

  it("awards accessory tiers at the band thresholds with phase clamps", () => {
    // The two thresholds ARE the `from` levels of the bands that introduce an
    // ornament (LEVEL_BANDS 4 and 6); tests/level-bands.test.ts owns the table.
    expect(TIER_THRESHOLDS).toEqual({ bow: 9, ribbon: 24 });
    expect(PHASE_TIER_CAP).toEqual({ 1: "", 2: "", 3: "bow", 4: "ribbon" });

    // Thresholds on the uncapped phase.
    expect(accessoryTier(0, 4)).toBe("");
    expect(accessoryTier(8, 4)).toBe("");
    expect(accessoryTier(9, 4)).toBe("bow");
    expect(accessoryTier(23, 4)).toBe("bow");
    expect(accessoryTier(24, 4)).toBe("ribbon");
    expect(accessoryTier(30, 4)).toBe("ribbon");

    // Phase clamps: p1/p2 always bare, p3 caps at bow.
    expect(accessoryTier(30, 1)).toBe("");
    expect(accessoryTier(30, 2)).toBe("");
    expect(accessoryTier(30, 3)).toBe("bow");
    expect(accessoryTier(9, 3)).toBe("bow");
    expect(accessoryTier(8, 3)).toBe("");

    // Garbage bond levels degrade to bare, never throw.
    expect(accessoryTier(Number.NaN, 4)).toBe("");
    expect(accessoryTier(-3, 4)).toBe("");
  });

  it("builds sprite paths matching the committed asset naming", () => {
    // Bond level picks the look now — `stage` is passed by some callers and
    // deliberately ignored, so these cases vary the level, not the stage.
    expect(spriteSrc({ stage: "Seedling", mood: "DryAir", bondLevel: 3 })).toBe(
      "/farm/assets/jamkachu/4x/plant-p2-sprout-unwell.png",
    );
    expect(spriteSrc({ stage: "Legend", mood: "Happy", bondLevel: 24 })).toBe(
      "/farm/assets/jamkachu/4x/plant-p4-fruit-happy-ribbon.png",
    );
    // Lv.9 is band 4 (p3 + bow); TooCold draws the sleepy body — the pack's
    // "plain" file is the faceless decorative body and never renders a mood.
    expect(spriteSrc({ stage: "Bud", mood: "TooCold", bondLevel: 9, scale: "2x" })).toBe(
      "/farm/assets/jamkachu/2x/plant-p3-flower-sleepy-bow.png",
    );
    expect(spriteSrc({ stage: "Seed", mood: "Overheating", bondLevel: 1 })).toBe(
      "/farm/assets/jamkachu/4x/plant-p1-seed-overheat.png",
    );
    // No bondLevel at all reads as Lv.0 → clamped to the first band.
    expect(spriteSrc({ mood: "Happy", sleeping: true })).toBe(
      "/farm/assets/jamkachu/4x/plant-p1-seed-sleepy.png",
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

  // Pot palette ramps (seed-shop try-on preview, Phase 1): src/lib/
  // sprite-palette.ts ports the farm's canvas swap algorithm client-side —
  // this pins its POT_RAMP/SKIN_RAMPS/POT_ITEM_RAMPS tables byte-identical
  // to public/farm/jamkachu-sprite.js's, same guard as every other table in
  // this file, so a recolored pot in the shop preview always matches what
  // the farm would show once the item is actually equipped.
  it("pot ramp tables (React sprite-palette mirror) are byte-identical to the farm's", () => {
    const farm = loadFarmSprite();
    const tables = (farm.pmSprite.tables ?? farm.pmSprite.TABLES) as AnyRecord;
    expect(tables.POT_RAMP, "PMSprite.tables must expose POT_RAMP").toEqual(POT_RAMP);
    expect(tables.SKIN_RAMPS, "PMSprite.tables must expose SKIN_RAMPS").toEqual(SKIN_RAMPS);
    expect(tables.POT_ITEM_RAMPS, "PMSprite.tables must expose POT_ITEM_RAMPS").toEqual(POT_ITEM_RAMPS);
  });

  it("the React swap constrains to the same pot-row fraction the farm layer uses (row 40 of 64)", () => {
    const source = readFileSync(farmSpritePath, "utf8");
    expect(source).toContain("var POT_TOP_FRACTION = 40 / 64;");
    expect(POT_TOP_FRACTION).toBe(40 / 64);
  });

  // Bond Lv.10 keepsake (docs/superpowers/specs/2026-08-07-dopamine-ux-
  // reframe-design.md: "Lv.10 special pot"): GOLDPOT_RAMP is a closure-
  // private var in the farm script — never exposed on PMSprite.tables, same
  // as activeRamp() itself — so it can't be read through the vm sandbox like
  // POT_RAMP/SKIN_RAMPS/POT_ITEM_RAMPS above. Pinned as a literal source
  // string instead, same pattern as the POT_TOP_FRACTION line just above:
  // any edit to the farm's Lv.10 keepsake colors breaks this test and the
  // src/lib/sprite-palette.ts mirror (+ tests/shop-preview.test.ts) must be
  // updated together.
  it("GOLDPOT_RAMP is pinned byte-identical to the farm's Lv.10 keepsake literal", () => {
    const source = readFileSync(farmSpritePath, "utf8");
    expect(source).toContain(
      'var GOLDPOT_RAMP = { body: "#D9A63C", shade: "#B0801F", rim: "#F2D268", rimLight: "#FBEBB4", rimHighlight: "#FFF6D8", glint: "#FFE79A" };',
    );
    // buildSwapMap() only ever reads ramp.body/ramp.rim/ramp.dark (never
    // ramp.shade/rimLight/rimHighlight/glint) on EITHER side — so the React
    // mirror only needs to carry body/rim to be pixel-identical.
    expect(GOLDPOT_RAMP.body).toBe("#D9A63C");
    expect(GOLDPOT_RAMP.rim).toBe("#F2D268");
  });

  it("lets the equipped pot beat the Lv.10 keepsake, on the farm and on the shop stage", () => {
    // The keepsake used to win outright, which killed the whole Pots category
    // past Lv.10: you spent seeds, equipped a pot, and nothing changed. It is
    // now what you wear when you have chosen nothing — take the pot off and
    // the gold comes back.
    const source = readFileSync(farmSpritePath, "utf8");
    expect(source).toMatch(
      /function activeRamp\(\) \{\s*if \(state\.potItemKey && POT_ITEM_RAMPS\[state\.potItemKey\]\)/,
    );
    // …and the keepsake still applies, just later, and still ahead of a skin.
    const body = source.slice(source.indexOf("function activeRamp()"));
    const potAt = body.indexOf("state.potItemKey");
    const goldAt = body.indexOf("GOLD_POT_LEVEL");
    const skinAt = body.indexOf("SKIN_RAMPS");
    expect(potAt).toBeGreaterThanOrEqual(0);
    expect(goldAt).toBeGreaterThan(potAt);
    expect(skinAt).toBeGreaterThan(goldAt);

    // The stage mirrors it, or a Lv.10+ player previewing a pot sees gold.
    const preview = readFileSync(path.resolve(repoRoot, "src/components/shop-preview.tsx"), "utf8");
    expect(preview).toContain("const goldPot = !previewPotRamp && mascot.bondLevel >= GOLD_POT_LEVEL;");
    expect(preview).toContain("const potRamp = previewPotRamp ?? (goldPot ? GOLDPOT_RAMP : null);");
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
