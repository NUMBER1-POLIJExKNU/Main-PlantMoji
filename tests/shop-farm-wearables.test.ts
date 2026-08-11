import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_CATALOG } from "@/game/economy/shop-catalog";

// The sibling of tests/shop-farm-decor.test.ts, for the two categories you
// WEAR. Decorations were held together by that test after three of them were
// found missing from the farm shell; nothing was holding pots and accessories
// together, and three accessories had drifted the exact same way — the catalog
// sold acc_jfc_headdress, acc_taeguk_ribbon and acc_indonesia_sash, and the
// farm had never heard of any of them, so wearing one cost Seeds and changed
// nothing. next.config.ts rewrites "/" to public/farm/index.html, which never
// runs React and so cannot import the catalog: this test is the only thing
// keeping the two lists honest.

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const stage = readFileSync(resolve(process.cwd(), "src/components/shop-preview.tsx"), "utf8");

const POTS = SHOP_CATALOG.filter((item) => item.category === "pot");
const ACCESSORIES = SHOP_CATALOG.filter((item) => item.category === "accessory");

function keyList(name: string): string {
  const line = live.match(new RegExp(`const ${name} = \\[[^\\]]*\\]`))?.[0] ?? "";
  expect(line, `${name} should exist in live.js`).toBeTruthy();
  return line;
}

describe("farm wearables", () => {
  it("lists every catalog accessory in the farm shell's key list", () => {
    const line = keyList("SHOP_ACC_KEYS");
    for (const item of ACCESSORIES) {
      expect(line, `SHOP_ACC_KEYS is missing ${item.key}`).toContain(`"${item.key}"`);
    }
    expect(line.match(/"acc_[a-z_]+"/g) ?? []).toHaveLength(ACCESSORIES.length);
  });

  it("lists every catalog pot in the farm shell's key list", () => {
    // Pots use their complete catalog image on both surfaces. A key missing
    // from POT_ITEM_ART would equip successfully but leave the default pot.
    const line = keyList("SHOP_POT_KEYS");
    const sprite = readFileSync(resolve(process.cwd(), "public/farm/jamkachu-sprite.js"), "utf8");
    for (const item of POTS) {
      expect(line, `SHOP_POT_KEYS is missing ${item.key}`).toContain(`"${item.key}"`);
      expect(sprite, `POT_ITEM_ART (farm) is missing ${item.key}`).toContain(
        `${item.key}: "/icons/shop/${item.key}.png"`,
      );
      expect(existsSync(resolve(process.cwd(), `public/icons/shop/${item.key}.png`))).toBe(true);
      expect(stage, `shop preview must use catalog art for ${item.key}`).toContain("shopItemArt(shownPotKey)");
    }
    expect(line.match(/"pot_[a-z_]+"/g) ?? []).toHaveLength(POTS.length);
  });

  it("draws every accessory on the farm, and shows it only when equipped", () => {
    expect(css).toContain(".mascot-svg .shop-item { display: none; }");
    for (const item of ACCESSORIES) {
      expect(html, `${item.key} needs an overlay group`).toContain(`class="shop-item shop-g-${item.key}"`);
      expect(css, `${item.key} needs an equipped rule`).toContain(
        `.mascot-svg.shop-${item.key} .shop-g-${item.key} { display: block; }`,
      );
    }
  });

  it("hangs a decoration on the equipped flag, not on merely owning it", () => {
    // Buying a decoration used to bolt it to the farm forever: renderShopPurchases
    // keyed decor off ownership and equip_item refused the category outright, so
    // there was no way back. The row has always had an `equipped` column.
    expect(live).toMatch(/category === "decor" && r\.equipped/);
  });

  it("offers the take-off button for every category, decorations included", () => {
    expect(stage, "the try-on stage should not special-case decor out of equipping").not.toMatch(
      /item\.category !== "decor" &&\s*\(?\s*<button/,
    );
  });

  it("shows the try-on stage what is actually worn, not just what is selected", () => {
    // The stage previewed the SELECTED item's pot ramp and accessory whatever
    // the equipped flag said, so "Take off" changed a label and nothing else —
    // which is what made every category read as "equipping is broken".
    expect(stage).toMatch(/worn/);
  });
});
