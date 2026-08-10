// Shared contracts for the game engine (handoff §11–§22, §26–§29).
//
// Ownership note (Correction 1): Node-RED v5 still writes its legacy
// healthy-time XP to `game_state` / `game_events`. The game backend NEVER
// touches those tables — it owns the new `bond_state` / `bond_events` /
// `quests` / `plant_badges` / `xp_rewards` tables. Node-RED's XP branch is
// disabled only after this backend engine is proven (handoff §15).

import type { PlantMood } from "./events";

// ── Personality (handoff §13) ───────────────────────────────────────────

export const PERSONALITIES = ["cute", "calm", "funny", "energetic", "shy"] as const;
export type PersonalityId = (typeof PERSONALITIES)[number];

export function normalizePersonality(value: unknown): PersonalityId {
  const compact = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PERSONALITIES as readonly string[]).includes(compact)
    ? (compact as PersonalityId)
    : "cute";
}

// ── Quests (handoff §16–§17) ────────────────────────────────────────────

export const QUEST_KEYS = [
  "KEEP_ME_HAPPY",
  "COOL_ME_DOWN",
  "GIVE_ME_MORE_LIGHT",
  "BALANCE_SOIL_ACIDIC",
  "BALANCE_SOIL_ALKALINE",
  "HUMIDIFY_MY_AIR",
  "STAY_COMFY",
] as const;
export type QuestKey = (typeof QUEST_KEYS)[number];

export const QUEST_STATUSES = [
  "AVAILABLE",
  "ACTIVE",
  "VERIFYING",
  "COMPLETED",
  "EXPIRED",
  "FAILED",
] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

/** Row shape of the `quests` table. All timing is timestamp-based — never
 *  server setTimeout (handoff Correction 4). */
export interface QuestRow {
  id: string;
  plant_id: string;
  quest_key: QuestKey;
  status: QuestStatus;
  xp_reward: number;
  started_at: string;
  verifying_since: string | null;
  completed_at: string | null;
  expired_at: string | null;
  created_at: string;
}

export interface QuestEngineResult {
  created: QuestRow[];
  completed: QuestRow[];
  expired: QuestRow[];
}

// ── Bond progression (handoff §14–§15, §37) ─────────────────────────────

export const XP_PER_LEVEL = 30;

/** 0–29 → Lv.1, 30–59 → Lv.2, ... Must match award_xp() in SQL. */
export function levelForXp(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

/** Row shape of the backend-owned `bond_state` table. */
export interface BondState {
  plant_id: string;
  total_xp: number;
  bond_level: number;
  current_streak: number;
  longest_streak: number;
  /** YYYY-MM-DD in STREAK_TIMEZONE, or null if no day ever qualified. */
  last_qualified_date: string | null;
  current_chapter: number;
  /** Seed coin balance (milestone18); absent until the migration runs. */
  seeds?: number;
  updated_at: string;
}

export interface AwardXpResult {
  duplicate: boolean;
  totalXp: number;
  bondLevel: number;
  leveledUp: boolean;
}

// Companion evolution is deliberately separate from the real plant's
// manually recorded growth_stage.
export const COMPANION_STAGES = [
  "Seed", "Sprout", "Seedling", "Bud", "Bloom",
  "Fruit", "Guardian", "Elder", "Radiant", "Legend",
] as const;
export type CompanionStage = (typeof COMPANION_STAGES)[number];

/** Evolution requirements — care count / distinct affinities / distinct WIB days.
 *  Mirrored (display-only) in public/farm/companion-ladder.js; a parity vitest
 *  keeps the two identical. */
export const COMPANION_LADDER: readonly {
  stage: CompanionStage; care: number; affinities: number; days: number;
}[] = [
  { stage: "Seed", care: 0, affinities: 0, days: 0 },
  { stage: "Sprout", care: 1, affinities: 0, days: 0 },
  { stage: "Seedling", care: 2, affinities: 0, days: 2 },
  { stage: "Bud", care: 3, affinities: 2, days: 0 },
  { stage: "Bloom", care: 7, affinities: 3, days: 2 },
  { stage: "Fruit", care: 11, affinities: 3, days: 4 },
  { stage: "Guardian", care: 15, affinities: 4, days: 5 },
  { stage: "Elder", care: 25, affinities: 4, days: 8 },
  { stage: "Radiant", care: 40, affinities: 4, days: 12 },
  { stage: "Legend", care: 60, affinities: 4, days: 20 },
];
export const CARE_AFFINITIES = ["cool", "air", "light", "soil", "steady", "balanced"] as const;
export type CareAffinity = (typeof CARE_AFFINITIES)[number];

export interface CompanionState {
  plant_id: string;
  cycle: number;
  stage: CompanionStage;
  form_key: CareAffinity;
  last_evolved_at: string | null;
  updated_at: string;
}

export interface CompanionEvolution {
  plant_id: string;
  cycle: number;
  stage: CompanionStage;
  from_stage: CompanionStage;
  form_key: CareAffinity;
  care_snapshot: Record<string, number>;
  evolved_at: string;
}

// ── Companion skins (milestone20) ───────────────────────────────────────

export const COMPANION_SKIN_KEYS = [
  "jamkachu", "edamame", "padi", "jagung", "kopi", "kakao", "buah_naga",
] as const;
export type CompanionSkinKey = (typeof COMPANION_SKIN_KEYS)[number];

/** Cosmetic Jember-crop skins for Jamkachu, unlocked by bond level.
 *  DISPLAY-ONLY: a skin changes how the companion is drawn and nothing else —
 *  it never grants or gates XP, seeds, quests, evolution, or sensors.
 *  Mirrored in supabase/milestone20-companion-skins.sql's CHECK constraint.
 *  Ordered by ascending unlockLevel; "jamkachu" is the always-unlocked default. */
export const COMPANION_SKINS: readonly {
  key: CompanionSkinKey; unlockLevel: number; nameEn: string; nameId: string; accent: string;
}[] = [
  { key: "jamkachu", unlockLevel: 1, nameEn: "Classic Jamkachu", nameId: "Jamkachu Klasik", accent: "#89D974" },
  { key: "edamame", unlockLevel: 2, nameEn: "Edamame Buddy", nameId: "Sobat Edamame", accent: "#9CCB5D" },
  { key: "padi", unlockLevel: 4, nameEn: "Golden Rice", nameId: "Padi Emas", accent: "#E8C95A" },
  { key: "jagung", unlockLevel: 6, nameEn: "Sweet Corn", nameId: "Jagung Manis", accent: "#F5B93F" },
  { key: "kopi", unlockLevel: 8, nameEn: "Robusta Coffee", nameId: "Kopi Robusta", accent: "#8A5A3B" },
  { key: "kakao", unlockLevel: 10, nameEn: "Cacao Pod", nameId: "Buah Kakao", accent: "#B0693C" },
  { key: "buah_naga", unlockLevel: 12, nameEn: "Dragon Fruit", nameId: "Buah Naga", accent: "#E85FA2" },
];

export function normalizeCompanionSkin(value: unknown): CompanionSkinKey {
  const compact = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (COMPANION_SKIN_KEYS as readonly string[]).includes(compact)
    ? (compact as CompanionSkinKey)
    : "jamkachu";
}

// ── Streak (handoff §21) ────────────────────────────────────────────────

/** Calendar days are counted in the demo location's timezone (Jember, WIB). */
export const STREAK_TIMEZONE = "Asia/Jakarta";

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  /** True when this call made today count (first qualifying quest today). */
  qualifiedToday: boolean;
}

// ── Badges (handoff §18) ────────────────────────────────────────────────

export const BADGE_KEYS = [
  "FIRST_RESCUE",
  "LIGHT_MASTER",
  "LEVEL_5_BOND",
  "COOL_KEEPER",
  "PH_GUARDIAN",
  "STREAK_7",
  "HUMIDITY_HERO",
  "MOOD_SCHOLAR",
  "CARE_VETERAN",
  "CHRONICLER",
  "STREAK_30",
  "LEVEL_10_BOND",
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export interface BadgeDefinition {
  key: BadgeKey;
  name: string;
  description: string;
  emoji: string;
}

export interface PlantBadgeRow {
  plant_id: string;
  badge_key: BadgeKey;
  unlocked_at: string;
}

// ── Story (handoff §19) ─────────────────────────────────────────────────

export interface ChapterDefinition {
  chapter: number;
  title: string;
  description: string;
}

// ── Backend-emitted game events → `bond_events` table (handoff §27) ─────

export const BOND_EVENT_TYPES = [
  "QUEST_CREATED",
  "QUEST_COMPLETED",
  "QUEST_EXPIRED",
  "XP_AWARDED",
  "LEVEL_UP",
  "STREAK_UPDATED",
  "BADGE_UNLOCKED",
  "CHAPTER_UNLOCKED",
  "COMPANION_EVOLVED",
] as const;
export type BondEventType = (typeof BOND_EVENT_TYPES)[number];

export interface BondEventRow {
  event_id: string;
  plant_id: string;
  type: BondEventType;
  occurred_at: string;
  data: Record<string, unknown>;
  created_at: string;
}

// ── Weekly report (handoff §22) ─────────────────────────────────────────

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  healthySeconds: number;
  questsCompleted: number;
  overheatingEvents: number;
  bondLevel: number;
  totalXp: number;
  currentStreak: number;
}

// Re-export for engine modules that work with moods.
export type { PlantMood };
