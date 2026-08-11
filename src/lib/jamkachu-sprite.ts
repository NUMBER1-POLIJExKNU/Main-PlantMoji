// Jamkachu sprite mapping — React mirror of the farm layer's
// public/farm/jamkachu-sprite.js (parity-tested like companion-ladder, see
// tests/jamkachu-sprite-parity.test.ts). The designer's pixel packs in
// public/farm/assets/jamkachu/ are the one true Jamkachu; this module maps
// game state (companion stage, plant mood, bond level) onto sprite files.
//
// Mapping tables are decided in docs/superpowers/plans/
// 2026-08-11-kiki-design-integration.md — do not redesign them here.

import type { PlantMood } from "@/types/events";
import type { CompanionStage } from "@/types/game";
import type { GrowthStage } from "@/lib/queries";

/** The pack draws 4 growth phases; the 10 companion stages bucket into them. */
export type SpritePhase = 1 | 2 | 3 | 4;
export const SPRITE_PHASES = [1, 2, 3, 4] as const;

/** The 5 expressions the designer drew per phase. */
export const SPRITE_MOODS = ["happy", "plain", "thirsty", "sleepy", "overheat"] as const;
export type SpriteMood = (typeof SPRITE_MOODS)[number];

/** Automatic bond-level accessory rewards ("" = bare). */
export type SpriteTier = "" | "bow" | "ribbon";

/** Stage→phase: Seed→p1 · Sprout,Seedling→p2 · Bud,Bloom→p3 · rest→p4. */
export const STAGE_PHASE: Record<CompanionStage, SpritePhase> = {
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
};

/** Filename fragment for each phase (plant-p3-flower-….png). */
export const PHASE_SLUG: Record<SpritePhase, string> = {
  1: "seed",
  2: "sprout",
  3: "flower",
  4: "fruit",
};

/** Mood→sprite. Four moods share the "plain" body and stay distinguishable
 * via a status emoji chip next to the sprite (MOOD_STATUS_CHIP) plus the
 * accessible mood text supplied by the caller. */
export const MOOD_SPRITE: Record<PlantMood, SpriteMood> = {
  Happy: "happy",
  Overheating: "overheat",
  TooCold: "plain",
  DryAir: "thirsty",
  HumidAir: "plain",
  Sleepy: "sleepy",
  SoilAcidic: "plain",
  SoilAlkaline: "plain",
};

/** Emoji chip floated near the sprite head for the moods that collapse to the
 * "plain" body (aria-hidden; the mood label text remains the accessible
 * signal — the 8 moods must stay distinguishable). */
export const MOOD_STATUS_CHIP: Partial<Record<PlantMood, string>> = {
  TooCold: "🥶",
  HumidAir: "💦",
  SoilAcidic: "🧪",
  SoilAlkaline: "🧪",
};

/** Bond→tier thresholds (ride the skins pacing 1/2/4/6/8/10/12). */
export const TIER_THRESHOLDS = { bow: 4, ribbon: 8 } as const;

/** Clamp by phase: p1/p2 always bare, p3 caps at bow, p4 uncapped. */
export const PHASE_TIER_CAP: Record<SpritePhase, SpriteTier> = {
  1: "",
  2: "",
  3: "bow",
  4: "ribbon",
};

const TIER_RANK: Record<SpriteTier, number> = { "": 0, bow: 1, ribbon: 2 };

/** Buckets a companion stage into its drawn phase. No stage (or a stage this
 * build does not know) renders the full-grown plant — same default the old
 * SVG mascot used. */
export function stagePhase(stage?: CompanionStage): SpritePhase {
  if (!stage) return 4;
  return STAGE_PHASE[stage] ?? 4;
}

/** Picks the drawn expression; night sleep overrides the live mood. */
export function spriteMood(mood: PlantMood, sleeping = false): SpriteMood {
  if (sleeping) return "sleepy";
  return MOOD_SPRITE[mood] ?? "plain";
}

/** Accessory earned by bond level, clamped to what the phase can wear. */
export function accessoryTier(bondLevel: number, phase: SpritePhase): SpriteTier {
  const level = Number.isFinite(bondLevel) ? bondLevel : 0;
  const earned: SpriteTier =
    level >= TIER_THRESHOLDS.ribbon ? "ribbon" : level >= TIER_THRESHOLDS.bow ? "bow" : "";
  const cap = PHASE_TIER_CAP[phase] ?? "";
  return TIER_RANK[earned] <= TIER_RANK[cap] ? earned : cap;
}

/** The diary's 5 manually-recorded growth stages also bucket into the 4
 * drawn phases, so records without a real photo can show a state-matched
 * Jamkachu portrait automatically. */
export const GROWTH_STAGE_PHASE: Record<GrowthStage, SpritePhase> = {
  "New Plant": 1,
  Settled: 2,
  Growing: 3,
  Thriving: 4,
  Mature: 4,
};

export function growthStagePhase(stage: GrowthStage | null | undefined): SpritePhase {
  return (stage && GROWTH_STAGE_PHASE[stage]) || 2;
}

export type SpriteScale = "1x" | "2x" | "4x";

/** Direct file path for a drawn frame — for surfaces that pin one sprite. */
export function spriteAssetPath(
  phase: SpritePhase,
  mood: SpriteMood,
  tier: SpriteTier = "",
  scale: SpriteScale = "4x",
): string {
  const suffix = tier ? `-${tier}` : "";
  return `/farm/assets/jamkachu/${scale}/plant-p${phase}-${PHASE_SLUG[phase]}-${mood}${suffix}.png`;
}

/** Maps live game state to the sprite file to show. */
export function spriteSrc({
  stage,
  mood,
  bondLevel = 0,
  sleeping = false,
  scale = "4x",
}: {
  stage?: CompanionStage;
  mood: PlantMood;
  bondLevel?: number;
  sleeping?: boolean;
  scale?: SpriteScale;
}): string {
  const phase = stagePhase(stage);
  return spriteAssetPath(phase, spriteMood(mood, sleeping), accessoryTier(bondLevel, phase), scale);
}
