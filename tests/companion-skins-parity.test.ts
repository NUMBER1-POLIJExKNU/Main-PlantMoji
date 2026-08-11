import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { COMPANION_SKIN_KEYS, COMPANION_SKINS } from "@/types/game";

// Guards against drift between the app's skin catalog (src/types/game.ts
// COMPANION_SKINS — the single source of truth) and its display-only farm
// mirror (public/farm/companion-skins.js). The farm layer renders skin names
// and accent tints from the mirror; if the two tables disagree, students
// would see skins or unlock levels the app never honors. Same pattern as
// tests/companion-ladder-parity.test.ts: read the plain script, evaluate it
// in a node:vm sandbox whose only global is a stub `window`, then compare.
// Skins are cosmetic ONLY — this test also pins the invariants that make
// that safe to render: "jamkachu" is first and always unlocked (level 1),
// and unlock levels strictly ascend.

const here = path.dirname(fileURLToPath(import.meta.url));
const skinsPath = path.resolve(here, "../public/farm/companion-skins.js");
const source = readFileSync(skinsPath, "utf8");

interface SkinRow {
  key: string;
  unlockLevel: number;
  nameEn: string;
  nameId: string;
  accent: string;
}

type StubWindow = {
  PM_SKINS?: { skins?: SkinRow[] };
};

function loadFarmSkins(): SkinRow[] {
  const stubWindow: StubWindow = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(source, context, { filename: skinsPath });
  if (!Array.isArray(stubWindow.PM_SKINS?.skins)) {
    throw new Error("companion-skins.js did not assign window.PM_SKINS.skins");
  }
  return stubWindow.PM_SKINS.skins;
}

const farmSkins = loadFarmSkins();

// Only the five parity fields — the src export may carry extra display
// metadata, but keys, order, unlock levels, names, and accents must match.
function parityRow({ key, unlockLevel, nameEn, nameId, accent }: SkinRow): SkinRow {
  return { key, unlockLevel, nameEn, nameId, accent };
}

describe("farm companion-skins mirror parity", () => {
  it("farm skin mirror matches COMPANION_SKINS exactly (keys, order, levels, names, accents)", () => {
    expect(farmSkins.map(parityRow)).toEqual(
      COMPANION_SKINS.map((skin) => parityRow(skin)),
    );
  });

  it("keeps jamkachu as the always-unlocked default in first position", () => {
    expect(farmSkins[0]?.key).toBe("jamkachu");
    expect(farmSkins[0]?.unlockLevel).toBe(1);
  });

  it("lists skins in strictly ascending unlockLevel order", () => {
    for (let i = 1; i < farmSkins.length; i++) {
      expect(farmSkins[i].unlockLevel).toBeGreaterThan(farmSkins[i - 1].unlockLevel);
    }
  });

  it("names every skin in both en and id with a valid hex accent", () => {
    for (const skin of farmSkins) {
      expect(skin.nameEn.trim().length).toBeGreaterThan(0);
      expect(skin.nameId.trim().length).toBeGreaterThan(0);
      expect(skin.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── The other two skin surfaces beyond the JS mirror ────────────────────
// Same read-the-source style as tests/farm-mobile-nav.test.ts: the DB CHECK
// constraint (supabase/milestone20-companion-skins.sql) and the sprite
// driver's pot-ramp table (public/farm/jamkachu-sprite.js SKIN_RAMPS — the
// kiki design integration replaced the old .skin-* CSS pot-token blocks
// with canvas palette swaps of the designer sprite's pot pixels) must also
// track COMPANION_SKIN_KEYS, or a catalog edit would let the DB reject a
// real skin — or render one with no pot palette.

const sql = readFileSync(
  path.resolve(here, "../supabase/milestone20-companion-skins.sql"),
  "utf8",
);
const spriteJsPath = path.resolve(here, "../public/farm/jamkachu-sprite.js");
const spriteJs = readFileSync(spriteJsPath, "utf8");

interface SkinRamp {
  body: string;
  rim: string;
  dark?: string;
}

function loadSkinRamps(): Record<string, SkinRamp | null> {
  const stubWindow: { PMSprite?: { tables: { SKIN_RAMPS: Record<string, SkinRamp | null> } } } = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(spriteJs, context, { filename: spriteJsPath });
  if (!stubWindow.PMSprite) {
    throw new Error("jamkachu-sprite.js did not assign window.PMSprite");
  }
  return stubWindow.PMSprite.tables.SKIN_RAMPS;
}

describe("milestone20 skin surfaces track COMPANION_SKIN_KEYS", () => {
  it("SQL skin_key CHECK constraint allows exactly the catalog keys", () => {
    const match = sql.match(/check\s*\(\s*skin_key\s+in\s*\(([^)]*)\)/i);
    expect(
      match,
      "milestone20-companion-skins.sql lost its skin_key CHECK constraint",
    ).not.toBeNull();
    const sqlKeys = [...match![1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    // Same members (as a set) AND same count — a missing, extra, or
    // duplicated key in the constraint all fail.
    expect(sqlKeys).toHaveLength(COMPANION_SKIN_KEYS.length);
    expect(new Set(sqlKeys)).toEqual(new Set(COMPANION_SKIN_KEYS));
  });

  it("demo.js keeps the K hotkey that cycles skins for filming (presentation only)", () => {
    const demo = readFileSync(path.resolve(here, "../public/farm/demo.js"), "utf8");
    expect(demo).toContain('case "k":');
    expect(demo).toContain("function cycleSkins()");
    // Presentation-only: the demo cycler must never POST the selection.
    expect(demo).not.toContain("/api/companion-skin");
    // And the presenter help panel must advertise it.
    expect(demo).toMatch(/\["K",\s*"cycle companion skin/);
  });

  it("jamkachu-sprite.js defines a pot ramp entry for every catalog key", () => {
    const ramps = loadSkinRamps();
    // Same members (as a set) AND same count — a missing, extra, or
    // renamed key in the ramp table all fail.
    expect(Object.keys(ramps)).toHaveLength(COMPANION_SKIN_KEYS.length);
    expect(new Set(Object.keys(ramps))).toEqual(new Set(COMPANION_SKIN_KEYS));
  });

  it("keeps the designer's own pot for the default skin, valid ramps elsewhere", () => {
    const ramps = loadSkinRamps();
    // jamkachu is null ON PURPOSE: the designer's drawn pot IS the default
    // look now — no recolor may touch it. If this ever changes, change it
    // deliberately alongside the sprite driver, not silently.
    expect(ramps.jamkachu).toBeNull();
    for (const skin of farmSkins) {
      if (skin.key === "jamkachu") continue;
      const ramp = ramps[skin.key];
      expect(ramp, `skin ${skin.key} lost its pot ramp`).not.toBeNull();
      expect(ramp!.body, `${skin.key} body hex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ramp!.rim, `${skin.key} rim hex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ramp!.dark, `${skin.key} dark hex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      // Pot body = the skin's catalog accent — the wardrobe swatch and the
      // recolored pot must always agree (same contract the old CSS blocks
      // carried: body = accent, rim = white tint, dark = black shade).
      expect(ramp!.body.toUpperCase(), `${skin.key} pot body ≠ catalog accent`).toBe(skin.accent.toUpperCase());
    }
  });

  it("constrains the swap to the designer pot hexes and pot rows only", () => {
    // The palette swap may only rewrite the six sampled designer pot fills,
    // below the sampled pot-top row — leaves/face/outline stay untouched.
    expect(spriteJs).toContain('body: "#B08968"');
    expect(spriteJs).toContain('shade: "#926C4E"');
    expect(spriteJs).toContain('rim: "#DEBA60"');
    expect(spriteJs).toContain("var POT_TOP_FRACTION = 40 / 64");
    expect(spriteJs).toMatch(/if \(!repl\) continue; \/\/ exact ramp hexes only/);
    // Canvas failure falls back to the plain sprite — never a blank mascot.
    expect(spriteJs).toMatch(/resolve\(null\); \/\/ tainted canvas/);
  });
});
