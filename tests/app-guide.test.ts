import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/components/reno-app-shell.tsx", "utf8");
const guide = readFileSync("src/components/app-guide.tsx", "utf8");
const farm = readFileSync("public/farm/index.html", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

describe("first-use game guide", () => {
  it("is available across React tabs and the static farm home", () => {
    expect(shell).toContain("<AppGuide locale={locale}");
    expect(farm).toContain('id="farm-guide-open"');
  });
  it("teaches the real educational loop and AI boundary", () => {
    expect(guide).toContain("MEET JAMKACHU"); expect(guide).toContain("READ THE SENSORS");
    expect(guide).toContain("OPEN A MISSION"); expect(guide).toContain("VERIFY AND GROW");
    expect(guide).toContain('"Back"');
  });
  // Task 2/3 migration: app-guide.tsx no longer owns a raw localStorage flag
  // or the spotlight/focus-trap mechanics directly — both moved out to the
  // shared pm_seen_v3 store and the reusable CoachMark host respectively
  // (pinned in tests/coach-store-contract.test.ts). This file only pins
  // that app-guide.tsx correctly *consumes* both.
  it("reads/writes the shared seen-store under id \"guide.home\", not a private flag", () => {
    expect(guide).toContain('from "@/lib/seen"');
    expect(guide).toContain('"guide.home"');
    expect(guide).not.toContain("plantmoji_guide_seen_v2");
    expect(guide).not.toMatch(/localStorage\.(get|set)Item/);
  });
  it("is a CoachMark consumer and keeps the replay event working", () => {
    expect(guide).toContain('from "@/components/coach-mark"');
    expect(guide).toContain("<CoachMark");
    expect(guide).toContain("plantmoji:open-guide");
  });
  it("keeps the floating help control above the mobile navigation", () => {
    expect(styles).toMatch(/\.pm-guide-button\s*\{[\s\S]*?bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
    expect(styles).toMatch(/\.pm-guide-button\s*\{[\s\S]*?left:\s*14px/);
  });
});
