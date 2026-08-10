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
// constraint (supabase/milestone20-companion-skins.sql) and the farm CSS
// palette blocks (public/farm/style.css) must also track COMPANION_SKIN_KEYS,
// or a catalog edit would let the DB reject a real skin — or render one with
// no palette.

const sql = readFileSync(
  path.resolve(here, "../supabase/milestone20-companion-skins.sql"),
  "utf8",
);
const farmCss = readFileSync(
  path.resolve(here, "../public/farm/style.css"),
  "utf8",
);

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

  it("farm CSS defines a .mascot-svg.skin-<key> palette block for every catalog key", () => {
    // style.css spells the default jamkachu palette out as an explicit
    // .skin-jamkachu block (rather than leaving the default look to the
    // base rules), so ALL catalog keys — not just the non-default six —
    // must have a selector. If that authoring choice ever changes, drop
    // jamkachu from this loop alongside its CSS block, not silently.
    expect(
      farmCss,
      "style.css no longer spells out the default .skin-jamkachu block",
    ).toMatch(/\.mascot-svg\.skin-jamkachu(?![\w-])/);
    for (const key of COMPANION_SKIN_KEYS) {
      expect(
        farmCss,
        `style.css lost its .mascot-svg.skin-${key} palette block`,
      ).toMatch(new RegExp(`\\.mascot-svg\\.skin-${key}(?![\\w-])`));
    }
  });
});
