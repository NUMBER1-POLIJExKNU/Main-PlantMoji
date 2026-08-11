import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { COMPANION_STAGES } from "@/types/game";

// Filesystem + mapping contract for the kiki designer sprite pack
// (2026-08-11 design integration). Every sprite src the farm driver
// (public/farm/jamkachu-sprite.js) can ever build must exist on disk —
// same-origin static files, no CDN, no 404s offline — and the decided
// mapping tables (stage→phase, mood→sprite, bond→tier with phase clamps)
// are pinned here so a driver edit can't silently redesign them.

const spriteJsPath = resolve(process.cwd(), "public/farm/jamkachu-sprite.js");
const spriteJs = readFileSync(spriteJsPath, "utf8");

interface SpriteApi {
  tables: {
    STAGE_PHASE: Record<string, number>;
    PHASE_SLUG: Record<number, string>;
    SPRITE_MOODS: string[];
    MOOD_SPRITE: Record<string, string>;
    MOOD_STATUS_CHIP: Record<string, string>;
    TIER_THRESHOLDS: { bow: number; ribbon: number };
    PHASE_TIER_CAP: Record<number, string>;
    POT_RAMP: Record<string, string>;
  };
  stagePhase: (stage?: string) => number;
  accessoryTier: (bondLevel: number, phase: number) => string;
}

function loadSprite(): SpriteApi {
  const stubWindow: { PMSprite?: SpriteApi } = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(spriteJs, context, { filename: spriteJsPath });
  if (!stubWindow.PMSprite) throw new Error("jamkachu-sprite.js did not assign window.PMSprite");
  return stubWindow.PMSprite;
}

const sprite = loadSprite();
const { tables } = sprite;

const PHASES = [1, 2, 3, 4] as const;
const SCALES = ["1x", "2x", "4x"] as const;
const PLANT_MOODS = ["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"];

/** Valid tiers per phase, straight from the decided clamp table. */
function validTiers(phase: number): string[] {
  const cap = tables.PHASE_TIER_CAP[phase];
  if (cap === "ribbon") return ["", "bow", "ribbon"];
  if (cap === "bow") return ["", "bow"];
  return [""];
}

describe("sprite asset matrix exists on disk (no 404 can ever render)", () => {
  it("every phase × mood × valid-tier frame exists at 1x, 2x, and 4x", () => {
    let checked = 0;
    for (const phase of PHASES) {
      for (const mood of tables.SPRITE_MOODS) {
        for (const tier of validTiers(phase)) {
          for (const scale of SCALES) {
            const file = `plant-p${phase}-${tables.PHASE_SLUG[phase]}-${mood}${tier ? `-${tier}` : ""}.png`;
            const full = resolve(process.cwd(), "public/farm/assets/jamkachu", scale, file);
            expect(existsSync(full), `missing sprite asset: ${scale}/${file}`).toBe(true);
            checked++;
          }
        }
      }
    }
    // 4 phases × 6 moods × (1+1+2+3 tiers summed per phase) × 3 scales.
    expect(checked).toBe((6 + 6 + 12 + 18) * 3);
  });

  it("the driver serves the 4x pack (image-rendering: pixelated does the rest)", () => {
    expect(spriteJs).toContain('var ASSET_BASE = "/farm/assets/jamkachu/4x/"');
    const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
    expect(css).toMatch(/#jamkachu-sprite \{[\s\S]{0,400}?image-rendering: pixelated;/);
  });
});

describe("full designer pack ships (every delivered file reachable — plan contract)", () => {
  // 105 plant PNGs (matrix above) + 9 jamkachu GIFs + 24 NPC PNGs
  // + 7 NPC GIFs = the 145 files the designer delivered, every one asserted
  // on disk. (The 21 "unwell" frames above are ours, derived from their art
  // — see scripts/build-unwell-face.mjs — and are covered by the matrix.)
  const packFile = (rel: string) => resolve(process.cwd(), "public/farm/assets", rel);

  it("ships both growth strips and the moods strip across all three tiers", () => {
    const gifs = ["growth-happy", "growth-plain", "moods-p4"].flatMap((base) =>
      ["", "-bow", "-ribbon"].map((suffix) => `jamkachu/gif/${base}${suffix}.gif`),
    );
    for (const rel of gifs) {
      expect(existsSync(packFile(rel)), `missing ${rel}`).toBe(true);
    }
    expect(gifs).toHaveLength(9);
  });

  it("ships every NPC at all four export scales plus its idle GIF and the cast strip", () => {
    const cast = [
      "npc-01-pak-tani",
      "npc-02-botanis",
      "npc-03-penjelajah",
      "npc-04-pedagang",
      "npc-05-moji-bot",
      "npc-06-mbah-tani",
    ];
    let checked = 0;
    for (const npc of cast) {
      for (const scale of ["1x", "2x", "4x", "8x"]) {
        expect(existsSync(packFile(`npc/${scale}/${npc}.png`)), `missing npc/${scale}/${npc}.png`).toBe(true);
        checked++;
      }
      expect(existsSync(packFile(`npc/gif/${npc}.gif`)), `missing npc/gif/${npc}.gif`).toBe(true);
      checked++;
    }
    expect(existsSync(packFile("npc/gif/npc-cast-idle.gif")), "missing npc/gif/npc-cast-idle.gif").toBe(true);
    checked++;
    expect(checked).toBe(31); // 24 PNGs + 6 idle GIFs + 1 cast strip
  });
});

describe("decided mapping tables (plan 2026-08-11 — do not redesign)", () => {
  it("stage→phase buckets all ten companion stages", () => {
    expect(tables.STAGE_PHASE).toEqual({
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
      expect(sprite.stagePhase(stage), `stagePhase(${stage})`).toBe(tables.STAGE_PHASE[stage]);
    }
    // Missing/unknown stage renders the full-grown plant — the same default
    // the old SVG mascot showed before companion_state existed.
    expect(sprite.stagePhase(undefined)).toBe(4);
    expect(sprite.stagePhase("NotAStage")).toBe(4);
  });

  it("never shows the faceless body for a mood — every mood keeps a face", () => {
    // "plain" is the designer's decorative body with leaf veins where the
    // face goes (their sheet-plain.png), not a neutral expression. Mapping
    // moods onto it once shipped a faceless plant whenever the soil went
    // off-pH or the air turned cold. Only four sprites are drawn with a
    // face, so those four carry all eight moods.
    for (const mood of PLANT_MOODS) {
      expect(tables.MOOD_SPRITE[mood], `${mood} renders the faceless body`).not.toBe("plain");
      expect(tables.SPRITE_MOODS, `MOOD_SPRITE[${mood}] not a drawn mood`).toContain(tables.MOOD_SPRITE[mood]);
    }
    expect(tables.MOOD_SPRITE).toEqual({
      Happy: "happy",
      Overheating: "overheat",
      TooCold: "sleepy",
      DryAir: "unwell",
      HumidAir: "unwell",
      Sleepy: "sleepy",
      SoilAcidic: "unwell",
      SoilAlkaline: "unwell",
    });
    // Moods that share a drawn face stay distinguishable via the chip
    // (aria-hidden; #char-mood text remains the accessible signal).
    expect(tables.MOOD_STATUS_CHIP).toEqual({
      TooCold: "🥶",
      Sleepy: "🌙",
      DryAir: "🌬️",
      HumidAir: "💦",
      SoilAcidic: "🧪",
      SoilAlkaline: "🧪",
    });
    const bodyCounts: Record<string, number> = {};
    for (const mood of PLANT_MOODS) bodyCounts[tables.MOOD_SPRITE[mood]] = (bodyCounts[tables.MOOD_SPRITE[mood]] ?? 0) + 1;
    for (const mood of Object.keys(tables.MOOD_STATUS_CHIP)) {
      expect(bodyCounts[tables.MOOD_SPRITE[mood]], `${mood} chips but has its own face`).toBeGreaterThan(1);
    }
    // Night sleep forces the sleepy body (sleepShown → sleeping: true).
    expect(spriteJs).toMatch(/if \(state\.sleeping\) return "sleepy";/);
  });

  it("bond→tier thresholds sit at the band starts and clamp by phase", () => {
    // The two thresholds ARE the `from` levels of the bands that introduce an
    // ornament (LEVEL_BANDS 4 and 6); tests/level-bands.test.ts owns the table.
    expect(tables.TIER_THRESHOLDS).toEqual({ bow: 9, ribbon: 24 });
    expect(tables.PHASE_TIER_CAP).toEqual({ 1: "", 2: "", 3: "bow", 4: "ribbon" });
    // p1/p2 always bare, whatever the bond.
    expect(sprite.accessoryTier(30, 1)).toBe("");
    expect(sprite.accessoryTier(30, 2)).toBe("");
    // p3 caps at bow even past the ribbon threshold.
    expect(sprite.accessoryTier(24, 3)).toBe("bow");
    expect(sprite.accessoryTier(9, 3)).toBe("bow");
    expect(sprite.accessoryTier(8, 3)).toBe("");
    // p4 walks the full ladder.
    expect(sprite.accessoryTier(8, 4)).toBe("");
    expect(sprite.accessoryTier(9, 4)).toBe("bow");
    expect(sprite.accessoryTier(23, 4)).toBe("bow");
    expect(sprite.accessoryTier(24, 4)).toBe("ribbon");
    // Garbage input degrades to bare, never a broken src.
    expect(sprite.accessoryTier(Number.NaN, 4)).toBe("");
  });

  it("pins the sampled designer pot ramp the palette swap keys on", () => {
    expect(tables.POT_RAMP).toEqual({
      body: "#B08968",
      shade: "#926C4E",
      rim: "#DEBA60",
      rimLight: "#F5D67B",
      rimHi: "#FCECB0",
      glint: "#FAD060",
    });
  });
});

describe("driver wiring (index.html + live.js hooks)", () => {
  const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
  const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");

  it("index.html carries the sprite img + chip and loads the driver before live.js", () => {
    expect(html).toContain('<img id="jamkachu-sprite" alt=""');
    expect(html).toContain('<span id="mood-status-chip" aria-hidden="true">');
    const driverIdx = html.indexOf('<script defer src="/farm/jamkachu-sprite.js">');
    const liveIdx = html.indexOf('<script type="module" src="/farm/live.js">');
    expect(driverIdx).toBeGreaterThan(-1);
    expect(liveIdx).toBeGreaterThan(driverIdx);
  });

  it("every live.js state feed reaches PMSprite, guarded to no-op when absent", () => {
    for (const feed of [
      "window.PMSprite?.set({ mood:",
      "window.PMSprite?.set({ stage })",
      "window.PMSprite?.set({ sleeping: sleepNow })",
      "window.PMSprite?.set({ skinKey: next })",
      "window.PMSprite?.set({ potItemKey: equippedPot })",
      "window.PMSprite?.set({ bondLevel: lv })",
    ]) {
      expect(live, `live.js lost the feed ${feed}`).toContain(feed);
    }
    // No unguarded PMSprite call anywhere in live.js: every touch goes
    // through optional chaining or an explicit existence check.
    const unguarded = live.match(/window\.PMSprite(?!\?|\)|\.set\b)/g) ?? [];
    expect(unguarded.length).toBe(0);
  });

  it("preloads the current band's five moods plus the next band's happy frame", () => {
    // A level-up must never flash a missing image, and at 15 XP a level the
    // next band can be one quest away.
    expect(spriteJs).toMatch(/function preload\(phase, bondLevel\)/);
    expect(spriteJs).toContain("var band = bandForLevel(bondLevel);");
    expect(spriteJs).toContain('wanted.push(spriteFile(band.phase, SPRITE_MOODS[i], band.tier))');
    expect(spriteJs).toContain('if (ahead) wanted.push(spriteFile(ahead.phase, "happy", ahead.tier));');
  });
});
