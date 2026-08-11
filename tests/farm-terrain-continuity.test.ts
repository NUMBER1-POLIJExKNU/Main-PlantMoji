import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");

describe("farm terrain continuity behind navigation", () => {
  it("keeps the desktop grass floor full viewport width", () => {
    const desktop = css.slice(css.indexOf("@media (min-width: 801px)"));
    expect(desktop).toContain(".grass-floor { left: 0; width: 100%; height: 105px; }");
    expect(desktop).not.toContain("width: calc(100% - 272px)");
  });

  it("joins grass to a non-interactive shore and water band", () => {
    expect(css).toContain(".grass-floor::before");
    expect(css).toContain(".grass-floor::after");
    expect(css).toMatch(/\.grass-floor::before,[\s\S]*?pointer-events: none/);
    expect(css).toMatch(/\.grass-floor::after \{[\s\S]*?var\(--color-water\)/);
    expect(css).toContain(".grass-decor");
    expect(css).toContain("inset: 0 0 25px;");
  });
});
