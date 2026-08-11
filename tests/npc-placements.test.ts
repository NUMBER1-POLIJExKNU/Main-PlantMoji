// NPC cast placements (kiki design integration, Task D) — source-contract
// pins: each React surface references its assigned designer sprite, every
// referenced asset exists on disk, and everywhere a GIF animates there is a
// reduced-motion static fallback. Mapping per
// docs/superpowers/plans/2026-08-11-kiki-design-integration.md §10.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const assetExists = (publicPath: string) =>
  existsSync(resolve(process.cwd(), "public", publicPath.replace(/^\//, "")));

describe("NPC cast placements", () => {
  it("ships all six cast sprites referenced by the shared badge helper", () => {
    const badge = read("src/components/npc-badge.tsx");
    for (const file of [
      "npc-01-pak-tani",
      "npc-02-botanis",
      "npc-03-penjelajah",
      "npc-04-pedagang",
      "npc-05-moji-bot",
      "npc-06-mbah-tani",
    ]) {
      expect(badge).toContain(`"${file}"`);
      expect(assetExists(`farm/assets/npc/4x/${file}.png`)).toBe(true);
    }
    // Badge art is decorative; the visible name label is the accessible signal.
    expect(badge).toContain('aria-hidden="true"');
    expect(badge).toContain("npcNameLabel(locale, npc)");
  });

  it("keeps every committed export scale a live srcSet candidate (no dead scales)", () => {
    // npcSpriteSrcSet enumerates all four designer scales as w-descriptors;
    // paired with a slot-sized `sizes`, device DPR and page zoom pick among
    // them — so 1x/2x/4x/8x are all product-referenced, none dead weight.
    const badge = read("src/components/npc-badge.tsx");
    expect(badge).toContain('export const NPC_SCALES = ["1x", "2x", "4x", "8x"] as const');
    expect(badge).toMatch(/NPC_SCALES\.map\(\(scale, index\) => `\$\{npcSpriteSrc\(npc, scale\)\} \$\{32 \* 2 \*\* index\}w`\)/);
    expect(badge).toContain("srcSet={npcSpriteSrcSet(npc)}");
    // The farm-layer farmer and the camera avatar carry literal multi-scale
    // srcsets of their own (they render outside the badge helper).
    expect(read("src/components/farmer-npc.tsx")).toContain("/farm/assets/npc/8x/npc-06-mbah-tani.png 256w");
    expect(read("src/components/camera-guardian.tsx")).toContain("/farm/assets/npc/1x/npc-05-moji-bot.png 32w");
  });

  it("keeps the cast names en+id via the shared i18n table", () => {
    const i18n = read("src/lib/i18n.ts");
    expect(i18n).toContain("export const npcNames");
    for (const name of ["Pak Tani", "Botanis", "Penjelajah", "Pedagang", "Moji-Bot", "Mbah Tani"]) {
      // Designer names are proper nouns in BOTH locales — en and id entries
      // exist and carry the same string.
      expect(i18n).toContain(`en: "${name}", id: "${name}"`);
    }
    // Taglines shown next to the headers exist in both locales.
    for (const npc of ["pedagang", "pak-tani", "botanis"]) {
      expect(i18n).toMatch(new RegExp(`"?${npc}"?: \\{ en: "[^"]+", id: "[^"]+" \\}`));
    }
  });

  it("puts Pedagang in the shop header, Pak Tani in quests, Botanis in monitoring", () => {
    expect(read("src/app/shop/page.tsx")).toContain('npc="pedagang"');
    expect(read("src/app/quests/page.tsx")).toContain('npc="pak-tani"');
    expect(read("src/app/monitoring/page.tsx")).toContain('npc="botanis"');
  });

  it("makes Moji-Bot the AI-advisory avatar on camera and the demo panel mascot", () => {
    const guardian = read("src/components/camera-guardian.tsx");
    expect(guardian).toContain("/farm/assets/npc/2x/npc-05-moji-bot.png");
    expect(guardian).toContain('npcNameLabel(locale, "moji-bot")');
    expect(assetExists("farm/assets/npc/2x/npc-05-moji-bot.png")).toBe(true);
    expect(read("src/components/demo-control-center.tsx")).toContain('npc="moji-bot"');
  });

  it("hosts Penjelajah inside the crop explorer scan radar", () => {
    const explorer = read("src/components/crop-explorer.tsx");
    expect(explorer).toContain('npcIdleGifSrc("penjelajah")');
    expect(explorer).toContain('npcSpriteSrcSet("penjelajah")');
    expect(explorer).toContain('npcNameLabel(locale, "penjelajah")');
    expect(assetExists("farm/assets/npc/4x/npc-03-penjelajah.png")).toBe(true);
    expect(assetExists("farm/assets/npc/gif/npc-03-penjelajah.gif")).toBe(true);
  });

  it("pairs every animated cast placement with a reduced-motion static source", () => {
    // Idle GIFs are ambient-only (plan constraint): the badge helper, the
    // crop-explorer radar, and the React farmer each render the designer's
    // idle loop inside a <picture> whose reduced-motion source swaps in the
    // static PNG art — nobody ships a loop that can't be stilled.
    for (const file of [
      "src/components/npc-badge.tsx",
      "src/components/crop-explorer.tsx",
      "src/components/farmer-npc.tsx",
    ]) {
      const component = read(file);
      expect(component, `${file} lost its reduced-motion source`).toContain(
        'media="(prefers-reduced-motion: reduce)"',
      );
    }
    const farmer = read("src/components/farmer-npc.tsx");
    expect(farmer).toContain("/farm/assets/npc/gif/npc-06-mbah-tani.gif");
    expect(farmer).toContain("/farm/assets/npc/2x/npc-06-mbah-tani.png");
    // Every idle loop the badge helper can point at ships on disk, so all
    // six cast GIFs are reachable through their assigned placements
    // (pak-tani/quests, botanis/monitoring, pedagang/shop, moji-bot/demo
    // panel, penjelajah/explorer, mbah-tani/farm) — none orphaned.
    for (const file of [
      "npc-01-pak-tani",
      "npc-02-botanis",
      "npc-03-penjelajah",
      "npc-04-pedagang",
      "npc-05-moji-bot",
      "npc-06-mbah-tani",
    ]) {
      expect(assetExists(`farm/assets/npc/gif/${file}.gif`)).toBe(true);
    }
    // The camera event feed avatar stays static (a 32px list marker is no
    // place for an ambient loop) — static PNGs need no fallback source.
    expect(read("src/components/camera-guardian.tsx")).not.toContain("/farm/assets/npc/gif/");
  });

  it("renders every placed sprite pixelated", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.pm-npc-badge img\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-npc-avatar\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-crop-radar img\{[^}]*image-rendering:pixelated/);
    expect(css).toMatch(/\.pm-react-farmer-sprite img\{[^}]*image-rendering:pixelated/);
  });
});
