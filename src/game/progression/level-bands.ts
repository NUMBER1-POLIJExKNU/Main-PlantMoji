// The bond level → what Jamkachu looks like. One table, seven bands.
//
// The designer drew three packs (images/plant-bare, plant-noribbon, plant) of
// four growth phases each. Opening them shows the packs differ by one hair
// ornament, and that p1 (seed) and p2 (sprout) are byte-identical across all
// three — the ornament is only drawn from p3. So there are seven distinct
// looks, not twelve, and the shipped sprite set says the same thing: 35 files
// = 20 bare + 10 bow (p3, p4) + 5 ribbon (p4 only).
//
// The bands ARE those seven looks. Nothing here invents a combination the
// designer did not draw.
//
// Bands are front-loaded on purpose, and steeply: 2, 3, 3, 4, 5, 6, 7 levels
// wide. One class period is 20–30 minutes and buys roughly 150–200 XP, so the
// first change has to land within a single quest (Lv.3 = 30 XP) or a student
// never sees the plant grow at all. A 200-XP session reaches Lv.14 — four
// changes. The wide late bands are the long tail for a garden that runs across
// several sessions.

import { MAX_BOND_LEVEL, XP_PER_LEVEL } from "@/types/game";
import type { SpritePhase, SpriteTier } from "@/lib/jamkachu-sprite";

export interface LevelBand {
  /** 1-based, in ladder order. */
  band: number;
  /** First level in the band. The last is the next band's `from` minus one. */
  from: number;
  /** Drawn growth phase. */
  phase: SpritePhase;
  /** Hair ornament: "" bare · "bow" · "ribbon". */
  tier: SpriteTier;
  /** Short label, used in the level-up toast and the status card. */
  name: { en: string; id: string };
}

export const LEVEL_BANDS: readonly LevelBand[] = [
  { band: 1, from: 1, phase: 1, tier: "", name: { en: "Seed", id: "Benih" } },
  { band: 2, from: 3, phase: 2, tier: "", name: { en: "Sprout", id: "Tunas" } },
  { band: 3, from: 6, phase: 3, tier: "", name: { en: "Flower", id: "Bunga" } },
  { band: 4, from: 9, phase: 3, tier: "bow", name: { en: "Ribboned Flower", id: "Bunga Berpita" } },
  { band: 5, from: 13, phase: 4, tier: "", name: { en: "Fruit", id: "Buah" } },
  { band: 6, from: 18, phase: 4, tier: "bow", name: { en: "Ribboned Fruit", id: "Buah Berpita" } },
  { band: 7, from: 24, phase: 4, tier: "ribbon", name: { en: "Legend", id: "Legenda" } },
] as const;

/** The band a level falls in. Levels below 1 read as 1; above the cap, as the cap. */
export function bandForLevel(level: number): LevelBand {
  const safe = Number.isFinite(level) ? Math.floor(level) : 1;
  const clamped = Math.min(MAX_BOND_LEVEL, Math.max(1, safe));
  let found = LEVEL_BANDS[0];
  for (const band of LEVEL_BANDS) {
    if (clamped >= band.from) found = band;
  }
  return found;
}

/** Last level of a band — the next band's start minus one, or the cap. */
export function bandLastLevel(band: LevelBand): number {
  const next = LEVEL_BANDS.find((entry) => entry.band === band.band + 1);
  return next ? next.from - 1 : MAX_BOND_LEVEL;
}

/** Total XP needed to first reach a level. */
export function xpForLevel(level: number): number {
  return Math.max(0, Math.min(MAX_BOND_LEVEL, level) - 1) * XP_PER_LEVEL;
}

/** The next look ahead, and the level that unlocks it — null at the last band. */
export function nextBand(level: number): { band: LevelBand; atLevel: number } | null {
  const current = bandForLevel(level);
  const next = LEVEL_BANDS.find((entry) => entry.band === current.band + 1);
  return next ? { band: next, atLevel: next.from } : null;
}
