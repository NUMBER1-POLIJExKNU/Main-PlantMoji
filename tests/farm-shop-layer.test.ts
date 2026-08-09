import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");

describe("farm shop layer (display-only)", () => {
  it("index.html carries the shop SVG groups, decor layer, and seeds badge", () => {
    for (const cls of ["shop-g-pot_terracotta", "shop-g-pot_batik", "shop-g-pot_tincan",
      "shop-g-pot_coffee_sack", "shop-g-pot_bamboo", "shop-g-pot_jember_mosaic",
      "shop-g-acc_strawhat", "shop-g-acc_ribbon", "shop-g-acc_glasses",
      "shop-g-acc_coffee_crown", "shop-g-acc_bandana", "shop-g-acc_goggles"]) {
      expect(html).toContain(cls);
    }
    expect(html).toContain('class="shop-decor-layer"');
    for (const cls of ["shop-decor-scarecrow", "shop-decor-fence", "shop-decor-lantern", "shop-decor-pond", "shop-decor-coffee-sign", "shop-decor-greenhouse", "shop-decor-rain-barrel", "shop-decor-compost", "shop-decor-tobacco-barn", "shop-decor-puger-pinwheel"]) {
      expect(html).toContain(cls);
    }
    expect(html).toContain('class="badge seeds"');
  });

  it("style.css hides shop art until live.js applies ownership classes", () => {
    expect(css).toContain(".mascot-svg .shop-item { display: none; }");
    expect(css).toContain(".shop-decor-layer .shop-decor { display: none; }");
    expect(css).toContain(".mascot-svg.shop-pot_batik .shop-g-pot_batik { display: block; }");
    expect(css).toContain(".shop-decor-layer.own-decor_pond .shop-decor-pond { display: block; }");
    expect(css).toContain(".mascot-svg.shop-pot_coffee_sack .shop-g-pot_coffee_sack { display: block; }");
    expect(css).toContain(".shop-decor-layer.own-decor_greenhouse .shop-decor-greenhouse { display: block; }");
  });

  it("live.js renders purchases idempotently and never computes a balance", () => {
    expect(live).toContain("function renderShopPurchases(");
    expect(live).toContain('table: "shop_purchases"');
    // The chip must show bond_state.seeds verbatim — no arithmetic on it.
    expect(live).toMatch(/bond\.seeds/);
    expect(live).not.toMatch(/bond\.seeds\s*[-+]/);
  });
});
