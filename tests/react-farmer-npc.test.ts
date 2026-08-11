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
    expect(css).toMatch(/\.pm-react-farmer-bed\{[^}]*background:transparent[^}]*box-shadow:none/);
    expect(css).toContain(".pm-react-farmer-bed i,.pm-react-farmer-bed b{display:none}");
  });
  it("draws Grandpa with the transparent responsive Mbah Tani PNG", () => {
    // The GIF's later frames have an opaque background, so the living-world
    // farmer uses the transparent PNG exports at every pixel density.
    expect(component).toContain('src="/farm/assets/npc/2x/npc-06-mbah-tani.png"');
    expect(component).not.toContain('src="/farm/assets/npc/gif/npc-06-mbah-tani.gif"');
    expect(component).toContain("/farm/assets/npc/2x/npc-06-mbah-tani.png 64w");
    expect(component).toContain("/farm/assets/npc/8x/npc-06-mbah-tani.png 256w");
    expect(component).toContain('media="(prefers-reduced-motion: reduce)"');
    // Old hand-drawn frame markup is gone; the sprite span stays decorative.
    expect(component).not.toContain("<i /><b /><em />");
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.pm-react-farmer-sprite img\{[^}]*image-rendering:pixelated/);
    expect(css).not.toContain(".pm-react-farmer-sprite i{");
    expect(css).not.toContain(".pm-react-farmer-sprite em{");
  });
});
