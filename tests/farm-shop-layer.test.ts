import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Farm shop layer, re-seated on the kiki designer sprites (2026-08-11):
// equipped ACCESSORIES stay overlay-SVG groups above the sprite img
// (repositioned onto the sprite head/stem inside .mascot-overlay), while
// equipped POTS became pot-pixel palette ramps in jamkachu-sprite.js
// (POT_ITEM_RAMPS — the old shop-g-pot_* overlay groups retired). Decor
// props on the grass are unchanged. Display-only, as ever.

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const spriteJs = readFileSync(resolve(process.cwd(), "public/farm/jamkachu-sprite.js"), "utf8");

const ACC_KEYS = ["acc_strawhat", "acc_ribbon", "acc_glasses", "acc_coffee_crown", "acc_bandana", "acc_goggles"];
const POT_KEYS = ["pot_terracotta", "pot_batik", "pot_tincan", "pot_coffee_sack", "pot_bamboo", "pot_jember_mosaic"];

interface Ramp {
  body: string;
  rim: string;
  dark?: string;
}

function loadPotItemRamps(): Record<string, Ramp> {
  const stubWindow: { PMSprite?: { tables: { POT_ITEM_RAMPS: Record<string, Ramp> } } } = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(spriteJs, context, { filename: "jamkachu-sprite.js" });
  if (!stubWindow.PMSprite) throw new Error("jamkachu-sprite.js did not assign window.PMSprite");
  return stubWindow.PMSprite.tables.POT_ITEM_RAMPS;
}

describe("farm shop layer (display-only)", () => {
  it("index.html keeps the accessory groups in the thin overlay; pot groups retired", () => {
    for (const key of ACC_KEYS) {
      expect(html).toContain(`shop-g-${key}`);
    }
    // Accessories live INSIDE the overlay SVG, above the sprite img.
    const overlayIdx = html.indexOf('class="mascot-overlay"');
    const imgIdx = html.indexOf('id="jamkachu-sprite"');
    expect(overlayIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeLessThan(overlayIdx); // overlay paints over the img
    for (const key of ACC_KEYS) {
      expect(html.indexOf(`shop-g-${key}`)).toBeGreaterThan(overlayIdx);
    }
    // The old pot overlay groups are gone — pots are palette ramps now.
    for (const key of POT_KEYS) {
      expect(html, `stale shop-g-${key} group`).not.toContain(`shop-g-${key}`);
    }
    expect(html).toContain('class="shop-decor-layer"');
    for (const cls of ["shop-decor-scarecrow", "shop-decor-fence", "shop-decor-lantern", "shop-decor-pond", "shop-decor-coffee-sign", "shop-decor-greenhouse", "shop-decor-rain-barrel", "shop-decor-compost", "shop-decor-tobacco-barn", "shop-decor-puger-pinwheel"]) {
      expect(html).toContain(cls);
    }
    expect(html).toContain('class="badge seeds"');
  });

  it("head-anchored overlay art tracks the drawn phase down to the small sprites", () => {
    // The shared crown anchor (shop hats/glasses/crown/bandana/goggles PLUS
    // the Lv.7 ribbon keepsake) is calibrated to the p3/p4 head in the
    // markup; the p1/p2 sprites start ~60-85px lower in the 300×350 box, so
    // the sprite driver stamps .sprite-phase-N on every repaint and
    // style.css pulls the anchor down to the measured head tops — a hat
    // bought at Seed/Sprout sits ON the head, never floating in the air.
    expect(html).toContain('<g class="acc-anchor" transform="translate(0 72)">');
    expect(spriteJs).toContain('stageBox.classList.toggle("sprite-phase-" + p, p === phase)');
    expect(css).toContain(".mascot-svg.sprite-phase-1 .acc-anchor { transform: translate(0px, 133px); }");
    expect(css).toContain(".mascot-svg.sprite-phase-2 .acc-anchor { transform: translate(0px, 109px); }");
    // The Lv.7 head-ribbon decoration survived the overlay trim and shares
    // the anchor: element present inside the anchor group, CSS reveal rule
    // alive, and live.js still targeting it — the bond reward stays visible.
    const anchorIdx = html.indexOf('class="acc-anchor"');
    const ribbonIdx = html.indexOf('class="decor decor-ribbon"');
    expect(anchorIdx).toBeGreaterThan(-1);
    expect(ribbonIdx).toBeGreaterThan(anchorIdx);
    expect(css).toContain(".mascot-svg.decor-lv7 .decor-ribbon { display: block; }");
    expect(live).toContain('ribbon: ".decor-ribbon"');
  });

  it("style.css hides accessory art until live.js applies ownership classes", () => {
    expect(css).toContain(".mascot-svg .shop-item { display: none; }");
    for (const key of ACC_KEYS) {
      expect(css).toContain(`.mascot-svg.shop-${key} .shop-g-${key} { display: block; }`);
    }
    // No stale pot display rules survive.
    for (const key of POT_KEYS) {
      expect(css).not.toContain(`.shop-g-${key} { display: block; }`);
    }
    expect(css).toContain(".shop-decor-layer .shop-decor { display: none; }");
    expect(css).toContain(".shop-decor-layer.own-decor_pond .shop-decor-pond { display: block; }");
    expect(css).toContain(".shop-decor-layer.own-decor_greenhouse .shop-decor-greenhouse { display: block; }");
  });

  it("every shop pot has a palette ramp derived from its old SVG hexes", () => {
    const ramps = loadPotItemRamps();
    expect(Object.keys(ramps).sort()).toEqual([...POT_KEYS].sort());
    for (const key of POT_KEYS) {
      const ramp = ramps[key];
      expect(ramp.body, `${key} body`).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ramp.rim, `${key} rim`).toMatch(/^#[0-9A-F]{6}$/i);
      if (ramp.dark) expect(ramp.dark, `${key} dark`).toMatch(/^#[0-9A-F]{6}$/i);
    }
    // Spot-pin the recorded legacy fills so the derivation stays honest.
    expect(ramps.pot_terracotta).toEqual({ body: "#C86B4A", rim: "#E08B5F", dark: "#9A4E33" });
    expect(ramps.pot_jember_mosaic.body).toBe("#3C8C75");
  });

  it("an equipped shop pot outranks the cosmetic skin ramp", () => {
    // Precedence: pot item ramp > skin ramp > designer pot (none).
    const activeRamp = spriteJs.slice(spriteJs.indexOf("function activeRamp"), spriteJs.indexOf("// ── Preload"));
    const potIdx = activeRamp.indexOf("POT_ITEM_RAMPS[state.potItemKey]");
    const skinIdx = activeRamp.indexOf("SKIN_RAMPS[state.skinKey]");
    expect(potIdx).toBeGreaterThan(-1);
    expect(skinIdx).toBeGreaterThan(potIdx);
    expect(activeRamp).toContain("return null");
  });

  it("live.js renders purchases idempotently, feeds the sprite, and never computes a balance", () => {
    expect(live).toContain("function renderShopPurchases(");
    expect(live).toContain('table: "shop_purchases"');
    // The equipped pot flows into the sprite driver's pot recolor.
    expect(live).toContain("window.PMSprite?.set({ potItemKey: equippedPot })");
    // The chip must show bond_state.seeds verbatim — no arithmetic on it.
    expect(live).toMatch(/bond\.seeds/);
    expect(live).not.toMatch(/bond\.seeds\s*[-+]/);
  });
});
