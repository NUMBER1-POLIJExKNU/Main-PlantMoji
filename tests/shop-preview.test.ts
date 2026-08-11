// Seed Shop try-on preview — Phase 1 source-contract pins
// (docs/superpowers/plans/2026-08-11-kiki-design-integration.md,
// docs/superpowers/plans/2026-08-11-home-care-focus.md). Same pattern as
// tests/npc-placements.test.ts and tests/shop-route.test.ts: read the plain
// source and pin the strings that make the feature honest and accessible,
// rather than rendering the tree.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_UI_COPY } from "@/game/economy/shop-catalog";
import { GOLDPOT_RAMP, POT_RAMP, POT_TOP_FRACTION, SKIN_RAMPS } from "@/lib/sprite-palette";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const assetExists = (publicPath: string) =>
  existsSync(resolve(process.cwd(), "public", publicPath.replace(/^\//, "")));

const preview = read("src/components/shop-preview.tsx");
const grid = read("src/components/shop-grid.tsx");
const page = read("src/app/shop/page.tsx");
const css = read("src/app/shop/shop.css");

describe("try-on preview strip renders in the shop page markup", () => {
  it("ShopGrid renders the sticky ShopPreviewStage, always (not gated behind a selection)", () => {
    expect(grid).toContain('import ShopPreviewStage from "@/components/shop-preview"');
    expect(grid).toContain("<ShopPreviewStage");
    // Not conditionally rendered behind `previewItem &&` — the diorama (Jamkachu
    // + Pedagang + grass) is baseline chrome, only the item info column changes.
    expect(grid).not.toMatch(/previewItem\s*&&\s*<ShopPreviewStage/);
  });

  it("tapping an item card selects it into the preview stage", () => {
    // One control per card: the whole card is the button, so it is
    // keyboard-operable without a second nested toggle to fight with.
    expect(grid).toMatch(/<button[\s\S]{0,700}onClick=\{\(\) => setPreviewKey\(item\.key\)\}/);
    expect(grid).toContain("aria-pressed={isPreviewed}");
  });

  it("the stage is a sticky strip that sticks below the mobile top bar", () => {
    expect(css).toMatch(/\.pm-shop-stage\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/);
    expect(css).toMatch(/@media \(max-width: 800px\) \{ \.pm-shop-stage \{ top: 70px; \} \}/);
  });

  it("the grass-floor band reuses the shared farm palette tokens, not new hex literals", () => {
    // public/farm/style.css's .grass-floor reads these same custom
    // properties (defined once in globals.css :root) — reusing the tokens
    // here keeps both grass bands pixel-identical without copying hexes.
    expect(css).toMatch(/\.pm-shop-stage-floor\s*\{[^}]*var\(--color-grass\)[^}]*var\(--color-forest\)/);
    expect(css).toContain("var(--color-grass-light)");
  });
});

describe("Pedagang stands beside Jamkachu without an opaque GIF rectangle", () => {
  it("renders the shared transparent still with a responsive srcSet", () => {
    expect(preview).toContain('import { npcStillImgProps } from "@/components/npc-badge"');
    expect(preview).toContain('npcStillImgProps("pedagang", "46px")');
    expect(preview).not.toContain("<picture>");
    // Decorative sprite art stays aria-hidden; the visible NPC name is the
    // accessible signal (same contract as npc-badge.tsx).
    expect(preview).toMatch(/<img \{\.\.\.npcStillImgProps\("pedagang", "46px"\)\} alt="" aria-hidden="true"/);
    expect(preview).toContain("npcNameLabel(locale, \"pedagang\")");
  });

  it("reuses npcNameLabel from the shared i18n module (no duplicated NPC copy)", () => {
    expect(preview).toContain('import { npcNameLabel, type AppLocale } from "@/lib/i18n"');
  });

  it("ships the pedagang sprite files this component points at", () => {
    expect(assetExists("farm/assets/npc/gif/npc-04-pedagang.gif")).toBe(true);
    expect(assetExists("farm/assets/npc/4x/npc-04-pedagang.png")).toBe(true);
  });
});

describe("current Jamkachu is fetched server-side, same pattern as other pages", () => {
  it("shop/page.tsx reads plants.current_state and companion_state.stage (like diary/settings)", () => {
    expect(page).toContain('supabase.from("plants").select("current_state").eq("id", PLANT_ID)');
    expect(page).toContain('supabase.from("companion_state").select("stage").eq("plant_id", PLANT_ID)');
    expect(page).toContain('supabase.from("bond_state").select("seeds, bond_level")');
  });

  it("degrades to the graceful p4 happy bare default when state is unavailable", () => {
    // normalizeMood(undefined) -> null -> "Happy"; an unrecognized/missing
    // companion_state.stage -> undefined -> stagePhase(undefined) = p4;
    // bond_level defaults to 0 -> accessoryTier(0, 4) = bare. Exactly the
    // spriteSrc default the rest of the app already relies on.
    expect(page).toContain('normalizeMood((plantRes.data as { current_state?: string } | null)?.current_state) ?? "Happy"');
    expect(page).toContain("const mascotBondLevel = Number(bondRow?.bond_level ?? 0);");
  });

  it("passes the fetched state down to ShopGrid, which feeds the stage", () => {
    expect(page).toContain("mascotMood={mascotMood}");
    expect(page).toContain("mascotStage={mascotStage}");
    expect(page).toContain("mascotBondLevel={mascotBondLevel}");
    expect(grid).toContain("mascotMood?: PlantMood");
    expect(grid).toContain("mascotStage?: CompanionStage");
    expect(preview).toContain("spriteSrc({ stage: mascot.stage, mood: mascot.mood, bondLevel: mascot.bondLevel })");
  });
});

describe("pot items replace the preview pot with their complete design", () => {
  it("uses the catalog art for the selected or equipped pot", () => {
    expect(preview).toContain('const shownPotKey = item?.category === "pot" ? item.key : wornPotKey ?? null;');
    expect(preview).toContain("const shownPotArt = shownPotKey ? shopItemArt(shownPotKey) : null;");
    expect(preview).toContain('className="pm-shop-stage-pot"');
    expect(preview).toContain("data-pot-key={shownPotKey}");
    expect(preview).not.toContain("potRampFor");
  });

  it("clips the baked-in pot so the design is a replacement, not an overlay", () => {
    expect(css).toContain(".pm-shop-stage-jamkachu.has-shop-pot .pm-shop-stage-sprite { clip-path:inset(0 0 37.5% 0); }");
  });

  it("keeps the canvas fallback only for the automatic gold default pot", () => {
    // Keyed by (baseSrc, ramp): a selection change alone falls back to the
    // plain sprite (no synchronous setState-to-null needed in the effect —
    // react-hooks/set-state-in-effect stays clean) until the new swap
    // resolves and its key still matches the current selection.
    expect(preview).toContain(
      "const spriteImgSrc = recolor && recolor.key === rampKey ? recolor.url : baseSrc;",
    );
    expect(preview).toContain("if (!cancelled && url) setRecolor({ key: rampKey, url });");
  });

  it("swapPotPalette resolves null (never throws) on any failure, and the module is browser-only", () => {
    const palette = read("src/lib/sprite-palette.ts");
    expect(palette).toContain('if (typeof document === "undefined" || typeof Image === "undefined") return null;');
    expect(palette).toMatch(/catch\s*\{\s*\n\s*return null;/);
  });
});

describe("bond Lv.10 keepsake: the baseline look, not an override", () => {
  it("previews the pot you picked, and falls back to gold only when nothing is picked", () => {
    // The keepsake used to win outright, so a Lv.10+ player tapping any pot
    // saw gold — the stage was honestly reporting that buying it would change
    // nothing, because on the farm it changed nothing.
    expect(preview).toContain("const goldPot = !hasShopPot && mascot.bondLevel >= GOLD_POT_LEVEL;");
    expect(preview).toContain("const potRamp = goldPot ? GOLDPOT_RAMP : null;");
    expect(preview).toContain('import { GOLDPOT_RAMP, GOLD_POT_LEVEL, swapPotPalette } from "@/lib/sprite-palette"');
  });

  it("applies even with nothing selected, so a Lv.10 player's baseline preview isn't misleadingly plain", () => {
    // rampKey/the recolor effect are keyed off `potRamp` alone — they don't
    // gate on `item` being non-null, so goldPot=true recolors the stage the
    // instant the page loads, before any card is tapped.
    expect(preview).toContain("const rampKey = potRamp ?");
  });
});

describe("decor renders as a prop on the grass; accessories get an honest try-on note", () => {
  it("decor items render their catalog emoji beside the cast, aria-hidden", () => {
    expect(preview).toMatch(/item && item\.category === "decor" && \(\s*<span className="pm-shop-stage-decor-prop" aria-hidden="true">/);
  });

  it("accessory items show a large icon plus the honest 'arrives when equipped on the farm' note", () => {
    expect(preview).toContain('item.category === "accessory" && (');
    expect(preview).toContain("pm-shop-stage-acc-icon");
    expect(preview).toContain("copy.accessoryPreviewNote");
  });
});

describe("honest, non-gameplay preview copy — en+id parity", () => {
  it("pins the exact honest disclaimer given in the spec, in both locales", () => {
    expect(SHOP_UI_COPY.en.tryOnNote).toBe("Try it on — seeds are only spent when you buy.");
    expect(SHOP_UI_COPY.id.tryOnNote).toBe("Coba dulu — biji hanya terpakai saat membeli.");
  });

  it("carries non-empty en AND id copy for every new try-on string", () => {
    const keys = ["tryOnStage", "tryOnNote", "tryOnHint", "accessoryPreviewNote"] as const;
    for (const key of keys) {
      expect(SHOP_UI_COPY.en[key].trim().length, `en.${key}`).toBeGreaterThan(0);
      expect(SHOP_UI_COPY.id[key].trim().length, `id.${key}`).toBeGreaterThan(0);
    }
  });

  it("the honest note always renders regardless of selection; the preview never calls the purchase actions directly", () => {
    expect(preview).toContain('<p className="pm-shop-stage-honest">{copy.tryOnNote}</p>');
    // Presentation only: buy/equip stay ShopGrid's own handlers, passed in as
    // props — the preview component never imports the server actions.
    expect(preview).not.toContain("@/app/shop/actions");
    expect(preview).not.toContain("purchaseShopItem");
    expect(preview).not.toContain("equipShopItem");
  });
});

describe("mobile: no page overflow, 44px controls, reduced motion respected", () => {
  it("collapses to a single column under 560px (no fixed-width overflow at 360-430px)", () => {
    expect(css).toMatch(/@media \(max-width:560px\) \{[^]*?\.pm-shop-stage \{ grid-template-columns:1fr;/);
  });

  it("keeps the clear button and the buy/equip button at a 44px touch target", () => {
    expect(css).toMatch(/\.pm-shop-stage-clear\s*\{[^}]*width:44px;\s*height:44px;/);
    const action = css.match(/\.pm-shop-stage-action\s*\{[^}]*\}/)?.[0] ?? "";
    const minHeight = Number(action.match(/min-height:(\d+)px/)?.[1] ?? 0);
    expect(minHeight, "buy/equip button touch target").toBeGreaterThanOrEqual(44);
  });

  it("ships no new always-on animation on the stage", () => {
    expect(css).not.toMatch(/\.pm-shop-stage[^{]*\{[^}]*animation:/);
  });
});

describe("every rendered image is pixelated; decorative art is aria-hidden with a visible/labeled signal", () => {
  it("Jamkachu and Pedagang art render pixelated", () => {
    expect(css).toMatch(/\.pm-shop-stage-jamkachu img\s*\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-shop-stage-npc img\s*\{[^}]*image-rendering:pixelated/);
  });

  it("the Jamkachu sprite is aria-hidden with the wrapper carrying the accessible name", () => {
    expect(preview).toMatch(/role="img"\s+aria-label="Jamkachu"/);
    expect(preview).toMatch(/<img className="pm-shop-stage-sprite" src=\{spriteImgSrc\} alt="" aria-hidden="true"/);
  });

  it("the decor prop and accessory icon are decorative (aria-hidden) — the item name text is the signal", () => {
    expect(preview).toMatch(/className="pm-shop-stage-decor-prop" aria-hidden="true"/);
    expect(preview).toMatch(/className=\{`pm-shop-stage-acc-icon\$\{[^}]*\}`\} aria-hidden="true"/);
    expect(preview).toContain("<h2>{item.name}</h2>");
  });
});

describe("sprite-palette.ts mirrors the farm layer's pot algorithm constants", () => {
  it("constrains the swap to rows at/below 40/64 of the sprite height", () => {
    expect(POT_TOP_FRACTION).toBeCloseTo(40 / 64);
  });

  it("exposes the same six designer pot hexes as public/farm/jamkachu-sprite.js", () => {
    expect(POT_RAMP).toEqual({
      body: "#B08968",
      shade: "#926C4E",
      rim: "#DEBA60",
      rimLight: "#F5D67B",
      rimHi: "#FCECB0",
      glint: "#FAD060",
    });
  });

  it("SKIN_RAMPS covers every companion skin", () => {
    expect(Object.keys(SKIN_RAMPS).sort()).toEqual(
      ["jamkachu", "edamame", "padi", "jagung", "kopi", "kakao", "buah_naga"].sort(),
    );
  });

  it("GOLDPOT_RAMP (bond Lv.10 keepsake) matches the farm's body/rim, and omits `dark` like the farm literal does", () => {
    expect(GOLDPOT_RAMP.body).toBe("#D9A63C");
    expect(GOLDPOT_RAMP.rim).toBe("#F2D268");
    expect(GOLDPOT_RAMP.dark).toBeUndefined();
  });
});
