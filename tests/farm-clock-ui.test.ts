import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/farm/index.html", "utf8");
const script = readFileSync("public/farm/live.js", "utf8");
const styles = readFileSync("public/farm/style.css", "utf8");

describe("farm home Jember clock", () => {
  it("renders a localized clock in the visible farm HUD", () => {
    expect(html).toContain('id="jember-clock-time"');
    expect(html).toContain('data-i18n="clock.label"');
    expect(styles).toContain(".jember-clock");
  });

  it("uses WIB for both the time and day/night icon", () => {
    expect(script).toContain('timeZone: "Asia/Jakarta"');
    expect(script).toContain("function renderJemberClock()");
    expect(script).toContain('now.hour >= 18 || now.hour < 6 ? "🌙" : "☀️"');
    expect(script).toContain("window.setInterval(renderJemberClock, 30_000)");
    expect(script).toContain('document.addEventListener("visibilitychange"');
    expect(script).toContain("Date.now() + 7 * 60 * 60_000");
  });

  it("supports Indonesian and English labels", () => {
    expect(script).toContain('"clock.label": "WAKTU JEMBER · WIB"');
    expect(script).toContain('"clock.label": "JEMBER TIME · WIB"');
  });

  it("keeps the interactive light response on the Node-RED 0–100% scale", () => {
    expect(script).toContain("const VITAL_LIGHT_MIN = 30");
    expect(script).toContain("v >= VITAL_LIGHT_MIN");
    expect(script).not.toContain("v !== 0 && v !== 1");
  });
});
