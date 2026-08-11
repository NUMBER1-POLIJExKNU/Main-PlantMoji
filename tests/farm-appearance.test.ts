import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_SKIN_COOKIE, APP_THEME_COOKIE, APP_THEMES, FARM_SKIN_CATALOG } from "@/lib/appearance";

// Theme and world skin exist twice on purpose: AppearanceControls renders them
// on the React routes, and the static farm shell has to render its own because
// next.config.ts rewrites "/" to public/farm/index.html and that page never
// runs React. My Garden — the one screen the skin is actually about — had
// neither the controls nor the effect until this was added.
//
// Two copies means two ways to drift, so the keys, the theme list and the skin
// catalog are pinned against src/lib/appearance.ts here.

const html = readFileSync("public/farm/index.html", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");

describe("farm shell appearance controls", () => {
  it("renders a theme and a skin control in the sidebar", () => {
    expect(html).toContain('<select id="farm-theme">');
    expect(html).toContain('<select id="farm-skin">');
    // Inside the sidebar, after the language switch — not loose in the world.
    expect(html.indexOf('class="locale-switch"')).toBeLessThan(html.indexOf('class="farm-appearance"'));
    expect(html.indexOf('class="farm-appearance"')).toBeLessThan(html.indexOf("</aside>"));
    expect(css).toContain(".farm-appearance select");
  });

  it("writes the very keys the React side reads", () => {
    // A choice made on My Garden must hold on /settings and the other way
    // round; different keys would silently split the setting in two.
    expect(live).toContain(`const THEME_KEY = "${APP_THEME_COOKIE}";`);
    expect(live).toContain(`const SKIN_KEY = "${APP_SKIN_COOKIE}";`);
    expect(live).toContain("document.cookie = `${key}=${value}; path=/; max-age=${APPEARANCE_MAX_AGE}; samesite=lax`;");
    expect(live).toContain("window.localStorage.setItem(key, value)");
  });

  it("offers the same themes the app defines", () => {
    expect(live).toContain(`const FARM_THEMES = [${APP_THEMES.map((t) => `"${t}"`).join(", ")}];`);
  });

  it("offers every skin in the catalog, in catalog order", () => {
    const start = live.indexOf("const FARM_SKIN_CATALOG = [");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = live.slice(start, live.indexOf("];", start));
    const keys = [...block.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(FARM_SKIN_CATALOG.map((skin) => skin.key));
  });

  it("gives every non-default skin a real palette, not just an attribute", () => {
    // A control that changes nothing would be worse than no control. The
    // catalog's three colours ARE this stylesheet's sky / grass / soil.
    for (const skin of FARM_SKIN_CATALOG) {
      if (skin.key === "jember-farm") {
        // The default palette is :root itself; a block would be duplication.
        expect(css).not.toContain(`html[data-farm-skin="jember-farm"] {`);
        continue;
      }
      const rule = css.match(new RegExp(`html\\[data-farm-skin="${skin.key}"\\] \\{[^}]*\\}`))?.[0];
      expect(rule, `${skin.key} needs a palette block`).toBeTruthy();
      for (const [token, colour] of [["--color-sky", skin.colors[0]], ["--color-grass", skin.colors[1]], ["--color-soil", skin.colors[2]]] as const) {
        expect(rule!.toLowerCase()).toContain(`${token}:${colour.toLowerCase()}`);
      }
    }
  });

  it("lets an explicit theme override the WIB clock", () => {
    // "auto" keeps the honest time-of-day sky; Day/Night is a real choice, so
    // it has to beat the clock rather than be repainted by the next tick.
    expect(live).toContain('const theme = readFarmTheme();');
    expect(live).toMatch(/const night = theme === "night" \? true\s*\n\s*: theme === "day" \? false/);
  });

  it("paints the choice where the stylesheet can see it", () => {
    expect(live).toContain("root.dataset.themePreference = readFarmTheme();");
    expect(live).toContain("root.dataset.farmSkin = readFarmSkin();");
    expect(live).toContain("initFarmAppearance();");
  });

  it("initialises only after the consts applyNightUi reads exist", () => {
    // Called next to applyLocale() this threw a temporal-dead-zone
    // ReferenceError on SLEEP_START_HOUR, which killed the whole module and
    // left every panel on My Garden showing its markup defaults. It has to run
    // at the bottom of the file, and nothing may move it back up.
    expect(live.indexOf("initFarmAppearance();")).toBeGreaterThan(live.indexOf("const SLEEP_START_HOUR"));
    expect(live.indexOf("initFarmAppearance();")).toBeGreaterThan(live.indexOf("function applyNightUi"));
    expect(live).toMatch(/initFarmAppearance\(\);\s*\n\s*\n?main\(\)\.catch/);
  });

  it("writes its own row captions instead of a missing string key", () => {
    // data-i18n here printed the raw "appearance.theme" on screen: strings.js
    // has no appearance group, and applyLocale falls back to the key.
    expect(html).not.toContain('data-i18n="appearance.');
    expect(html).toContain('data-appearance-label="theme"');
    expect(html).toContain('data-appearance-label="skin"');
    expect(live).toContain("const APPEARANCE_LABELS = {");
    expect(live).toContain('document.querySelectorAll("[data-appearance-label]")');
  });
});
