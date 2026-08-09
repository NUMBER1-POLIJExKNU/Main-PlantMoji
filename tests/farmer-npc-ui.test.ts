import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = source("public/farm/index.html");
const live = source("public/farm/live.js");
const css = source("public/farm/style.css");
const strings = source("public/farm/strings.js");

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
    expect(live).not.toContain("instanceof HTMLDialogElement");
    expect(live).toContain('typeof dialog.showModal === "function"');
    expect(css).toMatch(/\.npc-farmer\s*\{[\s\S]*?z-index:\s*15/);
  });

  it("schedules varied autonomous speech without interrupting important states", () => {
    expect(live).toContain("FARMER_FIRST_MIN_MS = 20_000");
    expect(live).toContain("FARMER_AUTO_MAX_MS = 150_000");
    expect(live).toContain("farmerCanSpeakAutonomously");
    expect(live).toContain("fxQueue.length === 0");
    expect(live).toContain('classList.contains("npc-falling")');
    expect(live).toContain("farmerRecentLines.length > 3");
  });

  it("keeps idle lines deterministic, bilingual, and opens chat from the bubble", () => {
    expect(strings).toContain("A sensor is a clue, not a command");
    expect(strings).toContain("Sensor itu petunjuk, bukan perintah");
    expect(live).toContain('bubble.addEventListener("click", openFarmerChat)');
    expect(css).toMatch(/\.npc-bubble[\s\S]*?pointer-events:\s*auto/);
  });
});
