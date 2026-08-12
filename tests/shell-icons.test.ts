import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The designer's icon set (images/icons) replaced the emoji nav and the old
// logo. It has to land on BOTH shells: next.config.ts rewrites "/" to
// public/farm/index.html, which never runs React, so wiring an icon only in
// reno-app-shell.tsx leaves My Garden — the screen the demo opens on — showing
// the old art. That gap has already caused three separate bugs.

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const shell = source("src/components/reno-app-shell.tsx");
// The destination table moved to lib/nav-destinations.ts so the header of each
// board draws the same icon the rail does — they had drifted into different
// pictures for the same place.
const destinations = source("src/lib/nav-destinations.ts");
const pageHeader = source("src/components/page-header.tsx");
const farmCss = source("public/farm/style.css");
const reactCss = source("src/app/globals.css");

// destination -> shipped file. Every destination has a drawing now; Collection
// was the last one without and got its diamond in the 2026-08-12 icon drop.
const NAV_ICONS = {
  "my-garden": "/",
  quests: "/quests",
  "crop-explorer": "/plants",
  "camera-ai": "/camera",
  "growth-diary": "/diary",
  collection: "/collection",
  shop: "/shop",
  monitoring: "/monitoring",
  reports: "/reports",
  settings: "/settings",
} as const;

const VITAL_ICONS = ["temperature", "humidity", "brightness", "acidity"] as const;

describe("designer icon set", () => {
  it("ships every icon both shells reference", () => {
    for (const name of [...Object.keys(NAV_ICONS), ...VITAL_ICONS]) {
      expect(existsSync(resolve(process.cwd(), `public/icons/${name}.png`)), `public/icons/${name}.png`).toBe(true);
    }
  });

  it("uses the icons on the static farm shell", () => {
    for (const name of [...Object.keys(NAV_ICONS), ...VITAL_ICONS]) {
      expect(html, `farm shell should use ${name}.png`).toContain(`/icons/${name}.png`);
    }
  });

  it("uses the same icons on the React shell, for the same destinations", () => {
    for (const [name, href] of Object.entries(NAV_ICONS)) {
      const item = destinations.match(new RegExp(`href: "${href.replace("/", "\\/")}",[^\\n]*`))?.[0];
      expect(item, `${href} nav entry`).toBeTruthy();
      expect(item, `${href} should use ${name}.png`).toContain(`art: "/icons/${name}.png"`);
    }
    // One <i> renderer for all three nav surfaces (sidebar, tool pocket, More
    // sheet) — three copies is how one of them silently keeps the old emoji.
    expect(shell).toContain("function NavIcon(");
    expect(shell.match(/<NavIcon item=\{item\} \/>/g) ?? []).toHaveLength(3);
    expect(shell).not.toMatch(/<i[^>]*>\{item\.icon\}<\/i>/);
    // next/image, so the nav art is served in the optimised size.
    expect(shell).toContain('<Image src={item.art} alt="" className="reno-nav-art"');
    expect(destinations).toContain('key: "collection", href: "/collection", icon: "💎", art: "/icons/collection.png"');
    // And the board that destination opens onto draws that same entry, instead
    // of an emoji of its own choosing.
    expect(pageHeader).toContain('import { navDestination } from "@/lib/nav-destinations"');
    expect(pageHeader).toContain('className="pm-page-header-art"');
    expect(reactCss).toContain(".pm-page-header-art {");
  });

  it("uses the designer title art as the brand on both shells", () => {
    for (const file of ["title-pot.png", "title-letter.png"]) {
      const path = resolve(process.cwd(), `public/farm/assets/${file}`);
      expect(existsSync(path), path).toBe(true);
      // Derivatives, not the originals: "Entire title.png" is 463KB for a slot
      // 44px tall, and the brand is in the first paint of every route.
      expect(statSync(path).size, `${file} should stay a small derivative`).toBeLessThan(80 * 1024);
    }
    expect(html).toContain('src="/farm/assets/title-pot.png"');
    expect(html).toContain('src="/farm/assets/title-letter.png"');
    expect(shell).toContain('src="/farm/assets/title-pot.png"');
    expect(shell).toContain('src="/farm/assets/title-letter.png"');
    expect(shell).not.toContain('src="/farm/assets/logo.png"');
  });

  it("keeps the Quests icon's real color while separating it from the active pill", () => {
    // The heart and the active pill are both mid-green; on that one row the
    // icon all but vanishes. Keyed off href, not the file name, because
    // next/image rewrites the React side's src into an /_next/image URL.
    for (const [css, selector] of [
      [farmCss, '.nav-item.active[href="/quests"] .icon img'],
      [reactCss, '.reno-nav-item.active[href="/quests"] .reno-nav-art'],
    ] as const) {
      const rule = css.match(new RegExp(`${selector.replace(/[.[\]"/]/g, (c) => `\\${c}`)} \\{[^}]*\\}`))?.[0];
      expect(rule, `${selector} needs a contrast halo`).toBeTruthy();
      expect(rule).toContain("drop-shadow(");
      expect(rule).not.toContain("brightness(");
      expect(rule).not.toContain("saturate(");
    }
  });

  it("stacks the tool links like the rows above, on both shells", () => {
    // TOOLS was a three-across grid of 6px captions while MY WORLD was a
    // stack — two rhythms in one 240px column. Both shells now use one.
    expect(farmCss).toMatch(/\.nav-tool-grid \{[^}]*flex-direction: column/);
    expect(reactCss).toMatch(/\.reno-nav-tool-grid \{[^}]*flex-direction: column/);
    // Nothing may re-add the tiny centred-caption treatment outside the phone
    // dock, where the whole nav legitimately becomes icon-over-caption.
    const farmBase = farmCss.slice(0, farmCss.indexOf("@media (max-width: 800px)"));
    expect(farmBase).not.toMatch(/\.nav-item\.nav-tool \{[^}]*font-size/);
    expect(reactCss.slice(0, reactCss.indexOf("@media (max-width: 800px)"))).not.toMatch(/\.reno-nav-item\.reno-nav-tool \{[^}]*font-size/);
  });

  it("keeps one sidebar rhythm across both shells", () => {
    // Title-to-first-row and row-to-row spacing are two rules each, and they
    // have to agree between the shells or My Garden looks airier than every
    // other route the demo clicks through.
    for (const [css, sidebar, brand, links, item] of [
      [farmCss, ".sidebar", ".brand", ".nav-links", ".nav-item"],
      [reactCss, ".reno-sidebar", ".reno-brand", ".reno-nav-links", ".reno-nav-item"],
    ] as const) {
      const block = (selector: string) => css.match(new RegExp(`\\${selector} \\{[^}]*\\}`))?.[0] ?? "";
      expect(block(sidebar), `${sidebar} gap`).toMatch(/gap: 18px/);
      expect(block(brand), `${brand} padding-bottom`).toMatch(/padding-bottom: 14px/);
      expect(block(links), `${links} gap`).toMatch(/gap: 4px/);
      expect(block(item), `${item} padding`).toMatch(/padding: 9px 12px/);
    }
  });

  it("never forces the title art square", () => {
    // The pot is 434x564. The rules it inherited were the old 1:1 logo's, and
    // a fixed 44x44 squashes it.
    expect(farmCss).toMatch(/\.logo-img \{\s*width: 44px; height: auto;/);
    expect(reactCss).toMatch(/\.reno-logo \{\s*width: 44px;\s*height: auto;/);
    expect(reactCss).not.toMatch(/\.reno-logo \{[^}]*height: 38px/);
  });
});
