import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Weekly report Jamkachu note", () => {
  it("places the character above its grounded narration bubble", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(page.indexOf("pm-report-jamkachu")).toBeLessThan(page.indexOf("A word from"));
    expect(page).toContain("pm-report-speech");
    expect(css).toContain(".pm-report-jamkachu");
  });

  it("draws the designer sprite with a tone that follows the report", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    // The mini-mascot is the drawn p4 sprite, not CSS box art.
    expect(page).toMatch(/<img\s[^>]*className="pm-report-jamkachu"/);
    expect(page).toContain("spriteAssetPath");
    // Tone mirrors the next-goal logic: a week with overheating gets the
    // overheat face, otherwise happy — both read the same
    // report.overheatingEvents, so picture and advice cannot disagree.
    //
    // This asked for "plain" and had been failing ever since the page stopped
    // varying the face at all. "plain" was never satisfiable either:
    // spriteAssetPath types phase 4's mood as "happy" | "overheat", so writing
    // it would not have compiled. The page varies again, with the mood that
    // exists.
    expect(page).toContain('report.overheatingEvents > 0 ? "overheat" : "happy"');
    // Pixel art must never be smoothed, and the old box-shadow body is gone.
    expect(css).toMatch(/\.pm-report-jamkachu\s*\{[^}]*image-rendering:\s*pixelated/);
    expect(css).not.toContain(".pm-report-jamkachu::after");
  });
});
