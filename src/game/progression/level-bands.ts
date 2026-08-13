// The bond level → what Jamkachu looks like. Thirty levels form fifteen
// two-level growth bands: 1–2, 3–4, …, 29–30. The designer's four body phases
// and three ornament tiers stay the source artwork; `scale` supplies the small
// in-between growth steps, and the last four stages progressively reveal the
// lush strawberry canopy on the farm. Every odd level starts a visibly new
// form, while the even level completes that form's two-level interval.

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
  /**
   * Intended as a subtle in-phase size step. Nothing draws it today:
   * jamkachu-sprite.js writes it to --jamkachu-growth-scale (and stamps
   * visual-stage-N alongside) but no stylesheet reads either. So two bands
   * that share `phase` and `tier` are the SAME picture — `scale` alone is not
   * a growth the player can see. TRIAL_GATE_LEVEL was mis-placed on that
   * assumption once; check phase/tier, not the band index.
   */
  scale: number;
  /** Short label, used in the level-up toast and the status card. */
  name: { en: string; id: string };
}

export const LEVEL_BANDS: readonly LevelBand[] = [
  { band: 1, from: 1, phase: 1, tier: "", scale: 0.9, name: { en: "Seed", id: "Benih" } },
  { band: 2, from: 3, phase: 1, tier: "", scale: 1, name: { en: "Rooted Seed", id: "Benih Berakar" } },
  { band: 3, from: 5, phase: 2, tier: "", scale: 0.9, name: { en: "Tiny Sprout", id: "Tunas Kecil" } },
  { band: 4, from: 7, phase: 2, tier: "", scale: 0.95, name: { en: "Bright Sprout", id: "Tunas Cerah" } },
  { band: 5, from: 9, phase: 2, tier: "", scale: 1, name: { en: "Young Leaves", id: "Daun Muda" } },
  { band: 6, from: 11, phase: 3, tier: "", scale: 0.9, name: { en: "Leafy Stem", id: "Batang Berdaun" } },
  { band: 7, from: 13, phase: 3, tier: "", scale: 0.95, name: { en: "First Bud", id: "Kuncup Pertama" } },
  { band: 8, from: 15, phase: 3, tier: "bow", scale: 0.96, name: { en: "Strawberry Bloom", id: "Bunga Stroberi" } },
  { band: 9, from: 17, phase: 3, tier: "bow", scale: 1, name: { en: "Flower Crown", id: "Mahkota Bunga" } },
  { band: 10, from: 19, phase: 4, tier: "", scale: 0.9, name: { en: "First Berry", id: "Buah Pertama" } },
  { band: 11, from: 21, phase: 4, tier: "", scale: 0.95, name: { en: "Berry Cluster", id: "Rumpun Buah" } },
  { band: 12, from: 23, phase: 4, tier: "bow", scale: 0.96, name: { en: "Strawberry Plant", id: "Tanaman Stroberi" } },
  { band: 13, from: 25, phase: 4, tier: "bow", scale: 1, name: { en: "Abundant Harvest", id: "Panen Melimpah" } },
  { band: 14, from: 27, phase: 4, tier: "ribbon", scale: 1, name: { en: "Flourishing Strawberry", id: "Stroberi Subur" } },
  { band: 15, from: 29, phase: 4, tier: "ribbon", scale: 1, name: { en: "Strawberry Legend", id: "Legenda Stroberi" } },
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
