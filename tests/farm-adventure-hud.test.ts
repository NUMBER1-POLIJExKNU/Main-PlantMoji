import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/farm/index.html", "utf8");
const css = readFileSync("public/farm/style.css", "utf8");
const live = readFileSync("public/farm/live.js", "utf8");

describe("My Garden adventure HUD", () => {
  it("keeps every realtime/game anchor while adding a readable hierarchy", () => {
    for (const id of ["env-temp", "env-hum", "env-light", "env-ph", "hp-inline"]) {
      expect(html).toContain(`id="${id}"`);
    }
    for (const id of ["care-focus", "care-focus-title", "care-focus-summary", "care-proof-note", "care-action", "current-quest", "cq-name", "cq-progress", "quest-verify-console"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    for (const key of ["hud.status", "hud.bonus"]) {
      expect(html).toContain(`data-i18n="${key}"`);
      expect(live).toContain(`"${key}"`);
    }
  });

  it("uses a 2 by 2 desktop vital board and scroll-safe short-screen rail", () => {
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.env-hud-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    expect(html).toContain('class="home-stack-scroll"');
    expect(css).toMatch(/\.home-stack-scroll \{[\s\S]*?overflow-y:auto/);
    expect(css).not.toContain("#current-quest");
  });

  it("keeps the right rail to sensors followed by today's quiz", () => {
    expect(html.indexOf('id="env-strip"')).toBeLessThan(html.indexOf('id="daily-quiz-open"'));
    expect(css).toContain(".home-stack-scroll {");
    expect(css).toContain("overflow-y:auto");
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
    for (const hook of ['class="status-help username"', 'class="xp-bar"', 'id="hp-inline"', "class=\"badge streak", "class=\"badge seeds", "data-xp-num", "data-seed-num", "data-seed-label"]) {
      expect(html).toContain(hook);
    }
    expect(html).not.toContain('class="badge coin"');
    expect(html).not.toContain("body .user-gamification { grid-template-columns: minmax(0, 1fr); }");
    expect(html.match(/data-xp-num/g)).toHaveLength(1);
    // Sized as a card over the plant rather than a full-width stage band.
    expect(css).toMatch(/\.mascot-container > \.user-gamification \{[\s\S]*?max-width: min\(560px, 100%\)/);
    expect(css).toContain(".mascot-container > .user-gamification .xp-bar-wrap { width: 150px; }");
  });

  it("keeps today's quiz inside two text lines", () => {
    expect(css).toContain(".quiz-bonus-label { display:none; }");
    expect(css).toMatch(/\.quiz-chip-copy strong,\.quiz-chip-copy small \{[^}]*white-space:nowrap/);
  });

  it("keeps only sensors and quiz in the scrollable rail", () => {
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.home-stack \{[\s\S]*?overflow:hidden/);
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.home-stack-scroll \{[\s\S]*?overflow-y:auto/);
    expect(html).toContain('id="env-strip"');
    expect(html).toContain('id="daily-quiz-open"');
  });

  it("keeps primary desktop actions intact on 768px-tall classroom screens", () => {
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.home-stack \{[\s\S]*?overflow:hidden/);
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.home-stack-scroll > \* \{ flex:0 0 auto; \}/);
    expect(css).toContain("@media (min-width: 801px) and (max-height: 820px)");
    expect(css).toMatch(/max-height: 820px\)[\s\S]*?\.env-hud-card \{[^}]*min-height:72px/);
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.farm-guide-open \{[^}]*left:290px/);
    expect(css).toMatch(/max-height: 820px\)[\s\S]*?\.farm-appearance \{[^}]*flex-direction:row/);
    expect(css).toMatch(/@media \(min-width: 801px\)[\s\S]*?\.nav-item \{ min-height:44px/);
  });

  it("keeps desktop NPC guidance away from Jamkachu controls", () => {
    expect(live).toContain('window.matchMedia?.("(min-width: 801px)").matches');
    expect(live).toContain('const mascotRect = $(".mascot-container")?.getBoundingClientRect()');
    expect(live).toContain("const overlapsMascot = mascotRect");
    expect(live).toContain("bubble.style.left = `${Math.round(safeCenter)}px`");
  });

});
