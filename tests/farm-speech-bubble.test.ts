import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");

describe("Jamkachu speech bubble artwork", () => {
  it("ships and uses the isolated designer bubble", () => {
    expect(existsSync(resolve(process.cwd(), "public/farm/assets/ui/speech-bubble-jamkachu.png"))).toBe(true);
    expect(css).toContain("border-image-source: url('/farm/assets/ui/speech-bubble-jamkachu.png');");
    expect(css).toContain("border-image-slice: 100 150 78 150 fill;");
  });

  it("grows with dialogue instead of clipping it into a fixed card", () => {
    const desktop = css.slice(css.indexOf("@media (min-width: 801px)"));
    expect(css).toContain("inline-size: fit-content;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(desktop).toContain("width: fit-content;");
    expect(desktop).toContain("max-height: none;");
    expect(desktop).toContain("overflow: visible;");
  });
});
