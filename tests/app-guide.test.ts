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
    expect(guide).toContain("plantmoji_guide_seen_v2");
    expect(guide).toContain("pm-tutorial-spotlight");
    expect(guide).toContain('"Back"');
    expect(guide).toContain("scrollIntoView");
    expect(guide).toContain("prefers-reduced-motion: reduce");
    expect(guide).toContain("keepFocusInside");
    expect(guide).toContain("returnFocusTo?.focus()");
  });
  it("keeps the floating help control above the mobile navigation", () => {
    expect(styles).toMatch(/\.pm-guide-button\s*\{[\s\S]*?bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
    expect(styles).toMatch(/\.pm-guide-button\s*\{[\s\S]*?left:\s*14px/);
  });
});
