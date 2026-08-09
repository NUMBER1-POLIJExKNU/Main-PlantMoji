import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/farm/index.html", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");

describe("My Garden adventure HUD", () => {
  it("keeps every realtime/game anchor while adding a readable hierarchy", () => {
    for (const id of ["current-quest", "cq-name", "cq-progress", "care-action", "env-temp", "env-hum", "env-light", "env-ph", "hp-inline"]) {
      expect(html).toContain(`id="${id}"`);
    }
    for (const key of ["hud.status", "hud.mission", "hud.bonus"]) {
      expect(html).toContain(`data-i18n="${key}"`);
      expect(live).toContain(`"${key}"`);
    }
  });

  it("uses a 2 by 2 desktop vital board and scroll-safe short-screen rail", () => {
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.env-hud-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    expect(css).toMatch(/\.home-stack \{[\s\S]*?overflow-y:auto/);
    expect(css).toContain("body.night #current-quest");
  });
});
