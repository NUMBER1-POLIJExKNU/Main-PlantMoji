import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const live = readFileSync("public/farm/live.js", "utf8");

describe("Garden Vitals warning consistency", () => {
  it("never pulses a mood card when its latest reading is stable", () => {
    expect(live).toContain('kind === targetKind && card.classList.contains("is-alert")');
    expect(live).toMatch(/function renderSensors[\s\S]*?applyMoodPulse\(careMood\);[\s\S]*?causalEcho/);
  });
});
