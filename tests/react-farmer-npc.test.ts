import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("React My Garden farmer NPC", () => {
  const component = read("src/components/farmer-npc.tsx");
  const home = read("src/components/plant-home.tsx");
  it("renders the farmer on the actual React home and returns him to bed after three seconds", () => {
    expect(home.indexOf("<FarmerNpc")).toBeGreaterThan(home.indexOf('className="pm-grass'));
    expect(component).toContain('"Zzz.."');
    expect(component).toContain("setAwake(true)");
    expect(component).toContain("}, 3000)");
    expect(component).toContain("onPointerMove");
  });
  it("keeps the lawn NPC clickable and separates taps from drags", () => {
    const css = read("src/app/globals.css");
    expect(component).toContain("<FarmerChatDialog");
    expect(component).toContain("Math.hypot(event.clientX - current.startX");
    expect(component).not.toContain("setPosition({ x: rect.left, y: rect.top })");
    expect(css).toMatch(/\.pm-grass \.pm-react-farmer>button\{[^}]*z-index:3[^}]*pointer-events:auto/);
    expect(css).toMatch(/\.pm-grass \.pm-react-farmer-bed\{[^}]*width:104px[^}]*pointer-events:none/);
  });
  it("draws Quests' Farmer Tani with the transparent responsive PNG", () => {
    // The GIF opens opaque, so the home uses transparent PNG art at all four
    // scales and never draws a rectangle around Farmer Tani.
    expect(component).not.toContain("/farm/assets/npc/gif/");
    expect(component).not.toContain("<picture>");
    expect(component).toContain('src="/farm/assets/npc/2x/npc-01-pak-tani.png"');
    expect(component).toContain("/farm/assets/npc/2x/npc-01-pak-tani.png 64w");
    expect(component).toContain("/farm/assets/npc/8x/npc-01-pak-tani.png 256w");
    // Old hand-drawn frame markup is gone; the sprite span stays decorative.
    expect(component).not.toContain("<i /><b /><em />");
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.pm-react-farmer-sprite img\{[^}]*image-rendering:pixelated/);
    expect(css).not.toContain(".pm-react-farmer-sprite i{");
    expect(css).not.toContain(".pm-react-farmer-sprite em{");
  });
});
