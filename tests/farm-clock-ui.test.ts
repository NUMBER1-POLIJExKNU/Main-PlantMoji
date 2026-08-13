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

  it("uses WIB for the displayed time", () => {
    expect(script).toContain('timeZone: "Asia/Jakarta"');
    expect(script).toContain("function renderJemberClock()");
    // The card shows the time only. Its sun/moon glyph was removed: it sat
    // beside the weather widget's own icon and read as a second forecast.
    expect(html).not.toContain('id="jember-clock-icon"');
    expect(script).not.toContain("jember-clock-icon");
    expect(script).toContain("window.setInterval(renderJemberClock, 30_000)");
    expect(script).toContain('document.addEventListener("visibilitychange"');
    // Fixed UTC+7 fallback for an Intl build with no IANA data. It reads the
    // instant from clockNow(), not Date.now(), so the developer clock
    // override reaches this path too — otherwise a browser without timezone
    // data would silently ignore the override and stay on real time.
    expect(script).toContain("new Date(source.getTime() + 7 * 60 * 60_000)");
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
