import { describe, expect, it } from "vitest";
import { COMPANION_SKINS, COMPANION_SKIN_KEYS, normalizeCompanionSkin } from "@/types/game";
import { selectSkin, skinForKey, skinUnlocked } from "@/game/companion/skins";

// Milestone 20 — cosmetic Jember-crop companion skins. The catalog in
// src/types/game.ts is the single source of truth (the SQL CHECK constraint
// and the farm layer both mirror it), so its shape is pinned here exactly.
// Skins are display-only: nothing in these helpers grants or gates anything.

describe("COMPANION_SKINS catalog integrity", () => {
  it("has exactly the 7 catalog keys, in order, with no duplicates", () => {
    const keys = COMPANION_SKINS.map((skin) => skin.key);
    expect(keys).toEqual(["jamkachu", "edamame", "padi", "jagung", "kopi", "kakao", "buah_naga"]);
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual([...COMPANION_SKIN_KEYS]);
  });

  it("is ordered by strictly ascending unlockLevel", () => {
    for (let i = 1; i < COMPANION_SKINS.length; i++) {
      expect(COMPANION_SKINS[i].unlockLevel).toBeGreaterThan(COMPANION_SKINS[i - 1].unlockLevel);
    }
  });

  it("starts with the default jamkachu at level 1", () => {
    expect(COMPANION_SKINS[0]).toMatchObject({ key: "jamkachu", unlockLevel: 1 });
  });

  it("gives every skin both en and id names plus a hex accent", () => {
    for (const skin of COMPANION_SKINS) {
      expect(skin.nameEn.trim().length, skin.key).toBeGreaterThan(0);
      expect(skin.nameId.trim().length, skin.key).toBeGreaterThan(0);
      expect(skin.accent, skin.key).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("pins the exact unlock ladder", () => {
    expect(COMPANION_SKINS.map(({ key, unlockLevel }) => [key, unlockLevel])).toEqual([
      ["jamkachu", 1], ["edamame", 2], ["padi", 4], ["jagung", 6],
      ["kopi", 8], ["kakao", 10], ["buah_naga", 12],
    ]);
  });
});

describe("normalizeCompanionSkin", () => {
  it("passes every catalog key through unchanged", () => {
    for (const skin of COMPANION_SKINS) {
      expect(normalizeCompanionSkin(skin.key)).toBe(skin.key);
    }
  });

  it("coerces case and surrounding whitespace", () => {
    expect(normalizeCompanionSkin("  PADI ")).toBe("padi");
    expect(normalizeCompanionSkin("Buah_Naga")).toBe("buah_naga");
  });

  it("maps anything unknown to the default jamkachu", () => {
    for (const value of ["durian", "", "jamkachu2", null, undefined, 4, {}, ["padi"], true]) {
      expect(normalizeCompanionSkin(value)).toBe("jamkachu");
    }
  });
});

describe("skinForKey", () => {
  it("returns the catalog row for a known key", () => {
    expect(skinForKey("kopi")).toMatchObject({ key: "kopi", unlockLevel: 8, nameEn: "Robusta Coffee" });
  });

  it("returns null for unknown keys and non-strings", () => {
    expect(skinForKey("durian")).toBeNull();
    expect(skinForKey(undefined)).toBeNull();
    expect(skinForKey(7)).toBeNull();
  });
});

describe("skinUnlocked", () => {
  it("unlocks exactly at the skin's level, not below", () => {
    for (const skin of COMPANION_SKINS) {
      expect(skinUnlocked(skin.key, skin.unlockLevel), skin.key).toBe(true);
      if (skin.key !== "jamkachu") {
        expect(skinUnlocked(skin.key, skin.unlockLevel - 1), skin.key).toBe(false);
      }
    }
  });

  it("keeps jamkachu unlocked no matter what the bond level is", () => {
    for (const level of [1, 0, -5, Number.NaN, undefined, null, "3"]) {
      expect(skinUnlocked("jamkachu", level)).toBe(true);
    }
  });

  it("treats a missing or NaN bond level as level 1", () => {
    for (const level of [undefined, null, Number.NaN, "12", Number.POSITIVE_INFINITY]) {
      expect(skinUnlocked("edamame", level)).toBe(false);
    }
  });

  it("never unlocks a key outside the catalog", () => {
    expect(skinUnlocked("durian", 99)).toBe(false);
  });
});

describe("selectSkin", () => {
  it("accepts an unlocked skin and returns its catalog row", () => {
    const result = selectSkin("padi", 4);
    expect(result).toEqual({ ok: true, skin: COMPANION_SKINS[2] });
  });

  it("rejects keys outside the catalog as unknown_skin", () => {
    for (const value of ["durian", "", null, undefined, 3, { key: "padi" }]) {
      expect(selectSkin(value, 99)).toEqual({ ok: false, error: "unknown_skin" });
    }
  });

  it("rejects a not-yet-reached skin as locked", () => {
    expect(selectSkin("buah_naga", 11)).toEqual({ ok: false, error: "locked" });
    expect(selectSkin("edamame", undefined)).toEqual({ ok: false, error: "locked" });
  });

  it("always accepts the default jamkachu", () => {
    expect(selectSkin("jamkachu", undefined)).toEqual({ ok: true, skin: COMPANION_SKINS[0] });
  });
});
