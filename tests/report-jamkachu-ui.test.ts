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
});
