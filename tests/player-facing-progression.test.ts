import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const live = readFileSync("public/farm/live.js", "utf8");
describe("player-facing companion progression", () => {
  it("shows level and XP-only evolution guidance", () => {
    expect(live).toContain('t("evolution.next")');
    expect(live).toContain("targetXp - lastBondXp");
    expect(live).toContain('t("evolution.xpLeft")');
    expect(live).toContain("renderEvolutionGuide");
    expect(live).not.toContain("req.care - state.care_count");
    expect(live).not.toContain("req.days - state.day_count");
    expect(live).toContain('"STAGE"');
    expect(live).not.toContain('label.textContent = `${PM().companionWord');
  });
});
