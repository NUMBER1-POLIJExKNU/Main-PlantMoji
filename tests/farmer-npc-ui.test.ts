import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const live = source("public/farm/live.js");
const css = source("public/farm/style.css");

describe("Grandpa Tani living-world UI", () => {
  it("measures the real grass boundary instead of wandering by viewport width", () => {
    expect(live).toContain('const grass = $(".grass-floor")');
    expect(live).toContain("grass.getBoundingClientRect()");
    expect(live).not.toContain("pm-npc-wander");
  });

  it("implements the fall, vine, climb, and reduced-motion paths", () => {
    expect(live).toContain("farmerFallAndClimb");
    expect(live).toContain('vine.classList.add("is-visible")');
    expect(live).toContain('matchMedia?.("(prefers-reduced-motion: reduce)")');
    expect(css).toContain(".npc-farmer-vine");
  });

  it("provides an accessible localized chat dialog with server-side answers", () => {
    expect(html).toContain('id="farmer-chat"');
    expect(html).toContain('aria-labelledby="farmer-chat-title"');
    expect(live).toContain('fetch("/api/farmer-chat"');
    expect(live).toContain("VIRTUAL SENSOR DATA · DEMO MODE");
  });
});
