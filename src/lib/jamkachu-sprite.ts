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
// The band table imports only TYPES from here, so there is no runtime cycle.
import { bandForLevel } from "@/game/progression/level-bands";

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

/** Mood→sprite. The pack draws FOUR faces — happy, thirsty, sleepy,
 * overheat. The fifth file, "plain", is the designer's faceless decorative
 * body (their sheet-plain.png), NOT a neutral expression: leaf veins sit
 * where the face goes. No mood may map to it — a cold or off-pH plant must
 * still have a face. Care-needed moods share the softer sleepy face and are
 * told apart by the status badge (MOOD_STATUS_CHIP) and the mood text. */
export const MOOD_SPRITE: Record<PlantMood, SpriteMood> = {
  Happy: "happy",
  Overheating: "overheat",
  TooCold: "sleepy",
  DryAir: "sleepy",
  HumidAir: "sleepy",
  Sleepy: "sleepy",
  SoilAcidic: "sleepy",
  SoilAlkaline: "sleepy",
};

/** Chip floated near the sprite head for the moods that SHARE a drawn body
 * with another mood (aria-hidden; the mood label text remains the accessible
 * signal — the 8 moods must stay distinguishable). */
export const MOOD_STATUS_CHIP: Partial<Record<PlantMood, string>> = {
  TooCold: "🥶",
  Sleepy: "🌙",
  DryAir: "🌬️",
  HumidAir: "💦",
  SoilAcidic: "🧪",
  SoilAlkaline: "🧪",
};

/**
 * Bond→tier thresholds. These are the `from` levels of the two bands that
 * introduce an ornament (LEVEL_BANDS 4 and 6) — kept as named constants because
 * the farm shell mirrors them and several tests read them, but the band table
 * in @/game/progression/level-bands is the source of truth.
 */
export const TIER_THRESHOLDS = { bow: 9, ribbon: 24 } as const;

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

/** Picks the drawn expression; night sleep uses the peaceful smiling frame. */
export function spriteMood(mood: PlantMood, sleeping = false): SpriteMood {
  if (sleeping) return "happy";
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
  // Bond level alone decides how grown Jamkachu looks. The companion ladder
  // (care count / affinities / days) still runs and still shows its own
  // "STAGE 7/10" line, but it no longer drives the body: one visible ladder is
  // easier to read in a 20-minute lesson than two that can disagree.
  // `stage` stays in the signature for the callers that pass it; it is ignored.
  void stage;
  const band = bandForLevel(bondLevel);
  return spriteAssetPath(band.phase, spriteMood(mood, sleeping), band.tier, scale);
}
