import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source-contract guard for the dead-affordance fixes (kid-guide plan Task
// 1): the quest panel is a REAL link now, and the sensor tiles invite
// their very first press with a one-time, motion-gated wiggle. Same
// read-the-source style as tests/farm-onboarding-tour.test.ts.

const html = readFileSync(resolve(process.cwd(), "public/farm/index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "public/farm/style.css"), "utf8");
const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");

describe("removed RIGHT NOW quest affordance", () => {
  it("removes the obsolete mission card and its realtime DOM anchors", () => {
    for (const id of ["care-focus", "care-action", "current-quest", "cq-name", "cq-progress", "quest-verify-console"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    expect(css).not.toContain("#current-quest");
  });
});

describe("env tiles invite their first press (one-time wiggle)", () => {
  it("adds .env-invite only while PMSeen \"tiles.tried\" is unseen", () => {
    expect(live).toContain('const TILES_SEEN_ID = "tiles.tried"');
    expect(live).toContain("let tileInviteRetired = pmSeenFlag(TILES_SEEN_ID);");
    expect(live).toMatch(/if \(!tileInviteRetired\) \{\s*\n\s*for \(const el of document\.querySelectorAll\("\.env-hud-card"\)\) el\.classList\.add\("env-invite"\);/);
  });

  it("retires the wiggle FOREVER on the very first tile tap, even a silent one", () => {
    const retire = live.slice(live.indexOf("function retireTileInvite"), live.indexOf("function onVitalTap"));
    expect(retire).toContain("pmMarkSeen(TILES_SEEN_ID)");
    expect(retire).toContain('classList.remove("env-invite")');
    // onVitalTap retires BEFORE its cooldown/no-comment early returns.
    const tap = live.slice(live.indexOf("function onVitalTap"), live.indexOf("/** One-time listener wiring"));
    expect(tap.indexOf("retireTileInvite();")).toBeGreaterThan(-1);
    expect(tap.indexOf("retireTileInvite();")).toBeLessThan(tap.indexOf("vitalTapCooldownUntil"));
  });

  it("keeps the wiggle gentle, finite, and reduced-motion gated (CSS)", () => {
    // The animation binding lives INSIDE a prefers-reduced-motion block…
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.env-hud-card\.env-invite \{ animation: pm-tile-invite/);
    // …with a bounded iteration count (never an infinite dance)…
    expect(css).toMatch(/\.env-hud-card\.env-invite \{ animation: pm-tile-invite [^;}]*\s\d+;/);
    expect(css).not.toMatch(/pm-tile-invite[^;}]*infinite/);
    // …and the keyframes exist.
    expect(css).toContain("@keyframes pm-tile-invite");
  });

  it("keeps the pressed-button affordance on the tiles (ledge + active press)", () => {
    expect(css).toMatch(/\.env-hud-card \{[^}]*box-shadow:0 4px 0 var\(--color-outline\)/);
    expect(css).toMatch(/\.env-hud-card:active \{[^}]*translateY/);
  });
});
