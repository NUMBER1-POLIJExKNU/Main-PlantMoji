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
    expect(html.indexOf('id="farmer-chat"')).toBeGreaterThan(html.indexOf('</main>'));
    expect(live).toContain('fetch("/api/farmer-chat"');
    expect(live).toContain("VIRTUAL SENSOR DATA · DEMO MODE");
    expect(live).not.toContain("instanceof HTMLDialogElement");
    expect(live).toContain('typeof dialog.showModal === "function"');
    expect(css).toMatch(/\.npc-farmer\s*\{[\s\S]*?z-index:\s*15/);
    expect(css).toMatch(/\.farmer-chat\s*\{[\s\S]*?pointer-events:\s*auto/);
    expect(css).toMatch(/\.farmer-chat input[\s\S]*?pointer-events:\s*auto/);
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
  it("lets the farmer be grabbed and returns him to the measured grass floor", () => {
    expect(live).toContain('addEventListener("pointerdown", startFarmerDrag)');
    expect(live).toContain('window.addEventListener("pointermove", moveFarmerDrag');
    expect(live).toContain("event.preventDefault()");
    expect(live).toContain("suppressFarmerClick");
    expect(live).toContain("Please put me down, my young friend!");
    expect(live).toContain("Tolong turunkan Kakek, Nak!");
    expect(live).toContain("Math.hypot");
    expect(live).toContain("const ground = farmerGround()");
    expect(live).toContain("Math.min(ground.right, currentLeft)");
    expect(live).toContain('!farmer.classList.contains("npc-ready")');
    expect(live).toContain("Math.min(ground.right, startLeft)");
    expect(css).toMatch(/\.npc-farmer\.npc-grabbed[\s\S]*?cursor:\s*grabbing/);
    expect(css).toMatch(/\.npc-farmer\s*\{[\s\S]*?touch-action:\s*none/);
  });

  it("moves the sun and moon along a WIB time-based sky arc", () => {
    expect(live).toContain('minute: "2-digit"');
    expect(live).toContain('celestial.style.setProperty("--celestial-x"');
    expect(live).toContain("Math.sin(Math.PI * clamped)");
    expect(css).toContain("left: var(--celestial-x");
    expect(css).toContain("body.night .env-sun");
  });
});
