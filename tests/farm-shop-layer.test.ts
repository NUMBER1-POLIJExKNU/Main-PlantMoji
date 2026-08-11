import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { SHOP_CATALOG } from "@/game/economy/shop-catalog";

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
    expect(html).toContain('class="badge seeds status-help"');
  });

  it("overlay art lands on the drawn head and eyes at every growth phase", () => {
    // Hats and lenses hang off two SEPARATE anchors, because the drawn head
    // top and the drawn eye line are far apart (measured from the committed
    // 4x PNGs: head top y78/97/134/158, eye centre y118/132/162/190 for
    // p4/p3/p2/p1). One shared anchor put lenses on the forehead and hats
    // through the face. Each smaller phase also SCALES the art about the
    // head centre — the p1 head is 60px wide against the p4 head's 149px,
    // so an unscaled hat would be twice the seed's width.
    expect(html).toContain('<g class="acc-anchor-crown" transform="translate(0 60)">');
    expect(html).toContain('<g class="acc-anchor-eyes" transform="translate(0 113)">');
    expect(spriteJs).toContain('stageBox.classList.toggle("sprite-phase-" + p, p === phase)');
    for (const [phase, crown, eyes, scale] of [[3, 84, 128, "0.81"], [2, 125, 159, "0.62"], [1, 154, 188, "0.4"]] as const) {
      expect(css).toContain(`.mascot-svg.sprite-phase-${phase} .acc-anchor-crown { transform: translate(150px, ${crown}px) scale(${scale}) translate(-150px, 0px); }`);
      expect(css).toContain(`.mascot-svg.sprite-phase-${phase} .acc-anchor-eyes { transform: translate(150px, ${eyes}px) scale(${scale}) translate(-150px, 0px); }`);
    }
    // Lenses ride the eye anchor, hats the crown anchor.
    const eyesIdx = html.indexOf('class="acc-anchor-eyes"');
    expect(html.indexOf("shop-g-acc_glasses")).toBeGreaterThan(eyesIdx);
    expect(html.indexOf("shop-g-acc_goggles")).toBeGreaterThan(eyesIdx);
    expect(html.indexOf("shop-g-acc_strawhat")).toBeLessThan(eyesIdx);
  });

  it("retires the Lv.7 ribbon the designer art already awards", () => {
    // Bond 4 draws a head bow and bond 8 a prize ribbon INTO the sprite
    // (jamkachu-sprite.js tiers), so the old SVG bow was a second ribbon
    // fighting the drawn one. The whole promise chain goes with it — no
    // level announces a decoration the character cannot show.
    expect(html).not.toContain("decor-ribbon");
    expect(css).not.toContain("decor-lv7");
    expect(live).not.toContain('ribbon: ".decor-ribbon"');
    expect(live).toContain("const DECOR_LEVELS = [2, 3, 5, 10];");
    for (const strings of [live, readFileSync(resolve(process.cwd(), "public/farm/strings.js"), "utf8")]) {
      expect(strings).not.toContain("Head ribbon");
      expect(strings).not.toContain("Pita di kepala");
    }
    // Lv.10 recolors the sprite's own pot instead of laying a band over it.
    expect(html).not.toContain("decor-goldpot");
    expect(spriteJs).toContain("GOLDPOT_RAMP");
    expect(css).toContain(".mascot-svg.decor-lv10 .decor-token { display: block; }");
    expect(live).toContain('goldpot: ".decor-token"');
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

  it("keeps every catalog item wired to farm art and the live key registry", () => {
    for (const item of SHOP_CATALOG) {
      expect(live, `${item.key} missing from live.js`).toContain(`"${item.key}"`);
      if (item.category === "decor") {
        const artClass = item.key.replace("decor_", "shop-decor-").replaceAll("_", "-");
        expect(html, `${item.key} missing decor markup`).toContain(artClass);
        expect(css, `${item.key} missing decor selector`).toContain(`own-${item.key}`);
      } else {
        expect(html, `${item.key} missing SVG group`).toContain(`shop-g-${item.key}`);
        expect(css, `${item.key} missing equip selector`).toContain(`.mascot-svg.shop-${item.key}`);
      }
    }
  });
});
