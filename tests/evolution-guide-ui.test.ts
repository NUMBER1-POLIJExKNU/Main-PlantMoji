import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/farm/index.html", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");

describe("level evolution guide UI", () => {
  it("keeps next-stage progress visible beside the character", () => {
    expect(html).toContain('id="companion-next"');
    expect(html).toContain('id="evolution-guide-open"');
    expect(live).toContain("lastBondXp = totalXp");
    expect(live).toContain("renderEvolutionProgress()");
  });

  it("shows all ten unlocks in an accessible dialog", () => {
    expect(html).toContain('id="evolution-guide"');
    expect(html).toContain('aria-labelledby="evolution-guide-title"');
    expect(live).toContain("for (const row of ladder)");
    expect(live).toContain('item.classList.toggle("is-current"');
    expect(css).toContain(".evolution-guide-list");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  });
});
