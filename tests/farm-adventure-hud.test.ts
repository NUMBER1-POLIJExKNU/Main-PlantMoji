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
    expect(html.indexOf('id="env-strip"')).toBeLessThan(html.indexOf('id="daily-quiz-open"'));
    // The bond/XP panel left this stack for the headroom above Jamkachu, so
    // the decision-first order above is now care → quest → sensors → bonus.
    // Its own placement is pinned in the status-panel test below.
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.home-stack \{ display:contents; \}/);
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.care-focus \{ order:1;/);
    expect(css).toContain("width:calc(100vw - 28px)");
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.mascot-stage \{ order:2; \}/);
  });

  it("puts the status panel in the headroom above Jamkachu, over the bubble", () => {
    // It used to sit in the right-hand stack, a whole screen from the
    // character it describes. Inside .mascot-container it is a flow sibling
    // ABOVE .speech-bubble, so the two can never overlap at any width —
    // something absolute positioning could not have guaranteed.
    const container = html.indexOf('class="mascot-container"');
    const panel = html.indexOf('class="user-gamification');
    const bubble = html.indexOf('class="speech-bubble');
    const mascot = html.indexOf('class="mascot-wrapper');
    expect(container).toBeLessThan(panel);
    expect(panel).toBeLessThan(bubble);
    expect(bubble).toBeLessThan(mascot);
    // Every hook live.js writes into survived the move.
    for (const hook of ['class="username"', 'class="xp-bar"', 'id="hp-inline"', "class=\"badge coin\"", "class=\"badge streak\"", "class=\"badge seeds\"", "data-seed-num", "data-seed-label"]) {
      expect(html).toContain(hook);
    }
    // Sized as a card over the plant rather than a full-width stage band.
    expect(css).toMatch(/\.mascot-container > \.user-gamification \{[\s\S]*?max-width: min\(420px, 100%\)/);
    expect(css).toContain(".mascot-container > .user-gamification .xp-bar-wrap { width: 150px; }");
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
