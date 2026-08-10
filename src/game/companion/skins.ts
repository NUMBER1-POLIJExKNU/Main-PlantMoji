// Cosmetic companion skins (milestone20). Pure helpers — no server-only
// imports, usable from API routes, client components, and vitest alike.
//
// Skins are DISPLAY-ONLY: they change how Jamkachu is drawn and nothing
// else. Nothing in this module (or downstream of it) may grant or gate XP,
// seeds, quests, evolution, or sensors. Unlocks read bond level; they never
// write it.

import { COMPANION_SKINS } from "@/types/game";
import type { CompanionSkinKey } from "@/types/game";

export type CompanionSkin = (typeof COMPANION_SKINS)[number];

/** The catalog row for `key`, or null for anything outside the catalog. */
export function skinForKey(key: unknown): CompanionSkin | null {
  const compact = typeof key === "string" ? key.trim() : "";
  return COMPANION_SKINS.find((skin) => skin.key === compact) ?? null;
}

/** True when `bondLevel` has reached the skin's unlock level. The default
 *  "jamkachu" is always unlocked; a missing/NaN bondLevel counts as level 1
 *  (a fresh bond_state starts there). Unknown keys are never unlocked. */
export function skinUnlocked(key: CompanionSkinKey | string, bondLevel: unknown): boolean {
  const skin = skinForKey(key);
  if (!skin) return false;
  if (skin.key === "jamkachu") return true;
  const level =
    typeof bondLevel === "number" && Number.isFinite(bondLevel) ? bondLevel : 1;
  return level >= skin.unlockLevel;
}

export type SelectSkinResult =
  | { ok: true; skin: CompanionSkin }
  | { ok: false; error: "unknown_skin" | "locked" };

/** Validates a skin selection against the catalog and the given bond level.
 *  Pure decision only — persistence (and its schema-drift tolerance) lives in
 *  the /api/companion-skin route. */
export function selectSkin(skinKey: unknown, bondLevel: unknown): SelectSkinResult {
  const skin = skinForKey(skinKey);
  if (!skin) return { ok: false, error: "unknown_skin" };
  if (!skinUnlocked(skin.key, bondLevel)) return { ok: false, error: "locked" };
  return { ok: true, skin };
}
