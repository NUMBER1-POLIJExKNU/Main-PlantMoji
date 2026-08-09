import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/components/reno-app-shell.tsx", "utf8");
const guide = readFileSync("src/components/app-guide.tsx", "utf8");
const farm = readFileSync("public/farm/index.html", "utf8");

describe("first-use game guide", () => {
  it("is available across React tabs and the static farm home", () => {
    expect(shell).toContain("<AppGuide locale={locale}");
    expect(farm).toContain('id="farm-guide-open"');
  });
  it("teaches the real educational loop and AI boundary", () => {
    expect(guide).toContain("SENSE"); expect(guide).toContain("UNDERSTAND");
    expect(guide).toContain("ACT"); expect(guide).toContain("VERIFY & GROW");
    expect(guide).toContain("AI only explains");
  });
});
