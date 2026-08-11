import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Jamkachu homepage portrait", () => {
  it("uses the committed portrait on the deployed farm homepage", () => {
    const home = read("public/farm/index.html");
    expect(home).toContain('class="jamkachu-home-portrait"');
    expect(home).toContain('src="/farm/assets/jamkachu/jamkachu-home-portrait.png"');
    expect(home).toContain('id="jamkachu-sprite"');
    expect(existsSync(resolve(process.cwd(), "public/farm/assets/jamkachu/jamkachu-home-portrait.png"))).toBe(true);
  });

  it("frames the portrait on desktop and preserves the live status sprite", () => {
    const css = read("public/farm/style.css");
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.jamkachu-home-portrait\s*\{/);
    expect(css).toMatch(/\.jamkachu-home-portrait img\s*\{[\s\S]*?object-fit:\s*cover/);
    expect(css).toMatch(/\.mascot-wrapper > \.mascot-svg\s*\{[\s\S]*?position:\s*absolute/);
  });
});
