import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/quests/page.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("Quest game UI", () => {
  it("shows the deterministic care loop and engine-owned targets", () => {
    expect(page).toContain('["SENSE", "ACT", "VERIFY", "REWARD"]');
    expect(page).toContain("def.verifyTemperatureMax");
    expect(page).toContain("def.verifyHumidityMin");
    expect(page).toContain("def.verifyPhRange");
  });

  it("keeps active care ahead of the secondary daily event and folds old history", () => {
    expect(page.indexOf('<section aria-label="Active quests"')).toBeLessThan(page.lastIndexOf("<DailyEventBanner"));
    expect(page).toContain("history.slice(0, 3)");
    expect(css).toContain(".pm-quest-hero");
    expect(page).toContain("featured={index === 0}");
    expect(page).toContain("I'm watching the sensors");
    expect(css).toContain(".pm-quest-jam");
  });
});
