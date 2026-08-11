import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const live = readFileSync("public/farm/live.js", "utf8");
describe("player-facing companion progression", () => {
  it("shows remaining goals and hides raw internal labels", () => {
    expect(live).toContain("more care actions");
    expect(live).toContain("more days");
    expect(live).toContain("Math.max(0, req.care - state.care_count)");
    expect(live).toContain('"STAGE"');
    expect(live).not.toContain('label.textContent = `${PM().companionWord');
  });
});
