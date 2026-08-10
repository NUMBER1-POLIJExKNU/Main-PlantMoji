import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync("src/app/globals.css", "utf8");
const featureCss = [
  readFileSync("src/app/camera/camera.css", "utf8"),
  readFileSync("src/app/diary/diary.css", "utf8"),
  readFileSync("src/app/shop/shop.css", "utf8"),
].join("\n");

describe("shared font token compatibility", () => {
  it("maps legacy farm font names to bundled Next font variables", () => {
    expect(globalCss).toContain("--font-heading: var(--pm-font-pixel)");
    expect(globalCss).toContain("--font-display: var(--pm-font-game)");
    expect(globalCss).toContain("--font-body: var(--pm-font-body)");
    expect(globalCss).toContain("--font-pixel: var(--pm-font-pixel)");
    expect(featureCss).toContain("var(--font-heading");
  });
});
