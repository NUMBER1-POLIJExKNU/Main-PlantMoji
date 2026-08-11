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

  it("puts one care decision before progression and bonus content", () => {
    for (const id of ["care-focus", "care-focus-title", "care-focus-summary", "care-proof-note"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html.indexOf('id="care-focus"')).toBeLessThan(html.indexOf('id="current-quest"'));
    expect(html.indexOf('id="current-quest"')).toBeLessThan(html.indexOf('id="env-strip"'));
    expect(html.indexOf('id="env-strip"')).toBeLessThan(html.indexOf('class="user-gamification'));
    expect(html.indexOf('class="user-gamification')).toBeLessThan(html.indexOf('id="daily-quiz-open"'));
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.home-stack \{ display:contents; \}/);
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.care-focus \{ order:1;/);
    expect(css).toContain("width:calc(100vw - 28px)");
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.mascot-stage \{ order:2; \}/);
  });

  it("explains the physical-care loop with four honest UI states", () => {
    for (const state of ["waiting", "healthy", "action", "verifying"]) {
      expect(live).toContain(`renderCareFocus("${state}")`);
      expect(css).toContain(`.care-focus[data-care-state="${state}"]`);
    }
    for (const step of ["sense", "act", "verify"]) {
      expect(html).toContain(`data-care-step="${step}"`);
    }
    expect(html).toContain('aria-live="polite"');
    expect(live).toContain('"focus.proof"');
    expect(live).toContain('"focus.waiting.action"');
    expect(live).toContain('careFocusState === "waiting"');
  });
});
