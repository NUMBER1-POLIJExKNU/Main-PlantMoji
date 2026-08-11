import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_CATALOG, shopCategoryArt, shopItemArt } from "@/game/economy/shop-catalog";

// A decoration has to exist in four places at once: the catalog sells it,
// live.js turns ownership into a class, index.html has a picture for that
// class, and style.css shows it. Three items were missing from the last three,
// so buying them wrote a row and changed nothing on the farm — the money went
// somewhere invisible. next.config.ts rewrites "/" to public/farm/index.html,
// which never runs React, so the farm copy cannot import the catalog and this
// test is the only thing holding them together.

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");

const DECOR = SHOP_CATALOG.filter((item) => item.category === "decor");
/** decor_coffee_sign → shop-decor-coffee-sign */
const cssName = (key: string) => `shop-decor-${key.replace(/^decor_/, "").replace(/_/g, "-")}`;

describe("farm decorations", () => {
  it("sells at least one decoration, and every one of them has art on disk", () => {
    expect(DECOR.length).toBeGreaterThan(0);
    for (const item of DECOR) {
      const art = shopItemArt(item.key);
      expect(art, `${item.key} should have art`).toBe(`/icons/shop/${item.key}.png`);
      expect(existsSync(resolve(process.cwd(), `public${art}`)), `public${art}`).toBe(true);
    }
  });

  it("gives every catalog item art, and nothing else", () => {
    // Pots and accessories have drawings now too. On the farm a pot still
    // recolors the plant sprite and an accessory still overlays it — that is
    // the honest preview of what you get — but the shop card has to show the
    // object, because a recolored pot cannot be read in a 52px box.
    for (const item of SHOP_CATALOG) {
      const art = shopItemArt(item.key);
      expect(art, item.key).toBe(`/icons/shop/${item.key}.png`);
      expect(existsSync(resolve(process.cwd(), `public${art}`)), `public${art}`).toBe(true);
    }
    expect(shopItemArt("pot_does_not_exist")).toBeNull();
  });

  it("draws every category tab with the designer's icon", () => {
    for (const category of ["pot", "decor", "accessory"] as const) {
      const art = shopCategoryArt(category);
      expect(art).toBe(`/icons/shop/category-${category}.png`);
      expect(existsSync(resolve(process.cwd(), `public${art}`)), `public${art}`).toBe(true);
    }
  });

  it("prices everything in the same drawn seed, on both shells", () => {
    // An emoji chestnut in one place and a drawn seed in another read as two
    // different currencies.
    expect(existsSync(resolve(process.cwd(), "public/icons/seed.png"))).toBe(true);
    const grid = readFileSync(resolve(process.cwd(), "src/components/shop-grid.tsx"), "utf8");
    const stage = readFileSync(resolve(process.cwd(), "src/components/shop-preview.tsx"), "utf8");
    for (const [name, source] of [["shop grid", grid], ["try-on stage", stage]] as const) {
      expect(source, `${name} should price in the drawn seed`).toContain('src="/icons/seed.png"');
    }
    expect(html).toContain('class="icon seed-icon" src="/icons/seed.png"');
  });

  it("lists every catalog decoration in the farm shell's key list", () => {
    const line = live.match(/const SHOP_DECOR_KEYS = \[[^\]]*\]/)?.[0] ?? "";
    expect(line).toBeTruthy();
    for (const item of DECOR) {
      expect(line, `SHOP_DECOR_KEYS is missing ${item.key}`).toContain(`"${item.key}"`);
    }
    expect(line.match(/"decor_[a-z_]+"/g) ?? []).toHaveLength(DECOR.length);
  });

  it("draws every decoration on the farm, and shows it when owned", () => {
    for (const item of DECOR) {
      const klass = cssName(item.key);
      expect(html, `${item.key} needs an <img> in the decor layer`).toContain(`class="shop-decor ${klass}" src="/icons/shop/${item.key}.png"`);
      expect(css, `${item.key} needs an ownership rule`).toContain(`.shop-decor-layer.own-${item.key} .${klass} { display: block; }`);
      // A sprite with no placement stacks on top of the previous one at the
      // layer's origin, which reads as a single garbled decoration.
      expect(css.match(new RegExp(`\\.${klass}\\s*\\{[^}]*left:`)), `${item.key} needs a position`).toBeTruthy();
    }
  });

  it("keeps decorations hidden until they are owned", () => {
    expect(css).toContain(".shop-decor-layer .shop-decor { display: none; }");
  });
});
