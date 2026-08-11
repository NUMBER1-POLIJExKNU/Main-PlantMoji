import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The designer's mood badge pack (public/farm/assets/moods). Every icon has
// a home in the product: eight name a real PlantMood in the collection dex,
// one is the locked placeholder there, and the two that no mood claims —
// the thirsty drop and the too-bright sun — mark an out-of-range vital on
// the farm's garden board. Nothing from the pack ships unused.
const root = process.cwd();
const live = readFileSync(resolve(root, "public/farm/live.js"), "utf8");
const css = readFileSync(resolve(root, "public/farm/style.css"), "utf8");
const spriteJs = readFileSync(resolve(root, "public/farm/jamkachu-sprite.js"), "utf8");

const ICONS = [
  "mood-01-happy", "mood-02-overheating", "mood-03-dry-air", "mood-04-sleepy",
  "mood-05-soil-acidic", "mood-06-soil-alkaline", "mood-07-locked", "mood-08-thirsty",
  "mood-09-too-wet", "mood-10-too-bright", "mood-11-too-cold",
];
const VARIANTS = ["1x", "2x", "4x", "8x", "badge", "badge4x"];

describe("designer mood badge pack", () => {
  it("ships every icon at every exported scale", () => {
    for (const variant of VARIANTS) {
      for (const icon of ICONS) {
        expect(existsSync(resolve(root, `public/farm/assets/moods/${variant}/${icon}.png`))).toBe(true);
      }
    }
  });

  it("marks an out-of-range vital with the direction, not just a colour", () => {
    for (const icon of ["mood-02-overheating", "mood-11-too-cold", "mood-09-too-wet", "mood-08-thirsty", "mood-10-too-bright", "mood-05-soil-acidic", "mood-06-soil-alkaline"]) {
      expect(live).toContain(`"${icon}"`);
    }
    // In-range readings carry no badge at all.
    expect(live).toContain("function vitalConditionBadge");
    expect(live).toMatch(/if \(!band\) return "";/);
    expect(live).toContain("renderVitalBadge(card, kind, value)");
    // Decorative only — the localized status text stays the real signal.
    expect(live).toContain('badge.setAttribute("aria-hidden", "true")');
    expect(css).toContain(".env-condition-badge");
    expect(css).toMatch(/\.env-condition-badge \{[^}]*image-rendering:pixelated/);
  });

  it("tells the two soil moods apart on the mascot chip", () => {
    // One shared 🧪 emoji made acidic and alkaline identical; the designer
    // drew a red-down tube and a purple-up tube instead.
    expect(spriteJs).toContain('SoilAcidic: "mood-05-soil-acidic"');
    expect(spriteJs).toContain('SoilAlkaline: "mood-06-soil-alkaline"');
    expect(spriteJs).toContain("MOOD_BADGE_BASE");
    // Emoji fallback survives a missing file so the mood keeps a signal.
    expect(spriteJs).toContain("chipImg.onerror");
    expect(spriteJs).toContain("MOOD_STATUS_CHIP");
  });
});
