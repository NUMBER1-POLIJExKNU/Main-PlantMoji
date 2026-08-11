import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/quests/page.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
// The hero card's stage row and its copy moved into a client island so the
// classroom sandbox can drive them; the page still owns the target line.
const heroStages = readFileSync(resolve(process.cwd(), "src/components/quest-hero-stages.tsx"), "utf8");

describe("Quest game UI", () => {
  it("shows the deterministic care loop and engine-owned targets", () => {
    expect(heroStages).toContain('["SENSE", "ACT", "VERIFY", "REWARD"]');
    expect(page).toContain("def.verifyTemperatureMax");
    expect(page).toContain("def.verifyHumidityMin");
    expect(page).toContain("def.verifyPhRange");
  });

  it("keeps active care ahead of the secondary daily event and folds old history", () => {
    expect(page.indexOf('<section aria-label="Active quests"')).toBeLessThan(page.lastIndexOf("<DailyEventBanner"));
    expect(page).toContain("history.slice(0, 3)");
    expect(css).toContain(".pm-quest-hero");
    expect(page).toContain("featured={index === 0}");
<<<<<<< HEAD
    expect(heroStages).toContain("I'm watching the sensors");
=======
    // Verifying state keeps its rail/well/bar signals but the companion
    // bubble no longer duplicates them with its own verifying line — the
    // is-watching class is the sole verifying cue left on the bubble.
    expect(page).toContain('pm-quest-jam${verifying ? " is-watching" : ""}');
    expect(page).not.toContain("I'm watching the sensors");
>>>>>>> 0e170c2 (polish(ux): close the audit remainder — instant /plants, single-voice status, one-screen badges)
    expect(css).toContain(".pm-quest-jam");
  });
});
