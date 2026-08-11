import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Two defects found by walking the DEPLOYED site at night, both invisible to
// tsc, lint and the build — the recurring shape of bugs in this project.
//
// 1. A blanket "every heading in --color-text !important" bridge rule reached
//    into .pm-play-map, a card that keeps a light background in every theme.
//    After dark that painted near-white on near-white: measured contrast 1.05,
//    and the "HOW TO PLAY" heading was simply not there.
// 2. `.pm-mood-dex-slot > span` (meant for the icon well) also matched the
//    "NEW" ribbon, the slot's other direct span, and outranked the ribbon's
//    own rule — forcing a 48x48 box at 28px, which wrapped the word one
//    letter per line and spilled it across the artwork.

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("night theme legibility", () => {
  it("lets a light-surfaced card keep a dark heading", () => {
    const rule = ".reno-route-content > main:not(.pm-scene) .pm-play-map h2 { color: #243421 !important; }";
    expect(css).toContain(rule);
    // Order matters: the bridge rule is also !important and equally weighted
    // without the extra class, so the exception has to come after it.
    expect(css.indexOf(rule)).toBeGreaterThan(
      css.indexOf(".reno-route-content > main:not(.pm-scene) h2 {"),
    );
  });

  it("keeps the card's own light background, which is what the fix assumes", () => {
    // If this card ever goes dark at night the override becomes wrong, not
    // just unnecessary — the heading would then be dark on dark.
    expect(css).toMatch(/\.pm-play-map\{[^}]*background:#f5fae9/);
  });
});

describe("mood dex tiles", () => {
  it("sizes the icon well by its class, never by `> span`", () => {
    // The ribbon is the slot's other direct span. A `> span` selector here
    // outranks `.pm-mood-dex-ribbon` and drags the badge into the well's box.
    expect(css).toContain(".pm-mood-dex-slot > .pm-mood-dex-well {");
    expect(css).toContain(".pm-mood-dex-slot.active > .pm-mood-dex-well {");
    expect(css).not.toContain(".pm-mood-dex-slot > span");
    expect(css).not.toContain(".pm-mood-dex-slot.active > span");
  });

  it("keeps the NEW ribbon small enough for its own word", () => {
    // 7px pixel-font "NEW" fits one line in the ribbon's padding box; 28px
    // (the well's size) does not, and it wraps per character.
    expect(css).toMatch(/\.pm-mood-dex-ribbon\s*\{[^}]*font-size:7px/);
  });
});
