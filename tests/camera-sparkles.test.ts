import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const component = source("src/components/camera-sparkles.tsx");
const css = source("src/app/camera/camera-sparkles.css");
const guardian = source("src/components/camera-guardian.tsx");
const page = source("src/app/camera/page.tsx");

describe("camera sparkle overlay", () => {
  it("stays a display-only layer that can never affect detection", () => {
    // The overlay must not intercept input (taps fall through to the stage)
    // and must never read frames — no canvas, no drawImage, no network.
    expect(css).toMatch(/\.pm-cam-sparkles\s*\{[^}]*pointer-events:\s*none/);
    expect(component).not.toContain("drawImage");
    expect(component).not.toContain("canvas");
    expect(component).not.toContain("fetch(");
  });

  it("is mounted inside the guardian stage and styled from the camera page", () => {
    expect(guardian).toContain("<CameraSparkles locale={locale} />");
    expect(page).toContain('import "./camera-sparkles.css"');
  });

  it("defaults on, respects the stored off switch, and caps live sparkles", () => {
    expect(component).toContain('window.localStorage.getItem(STORAGE_KEY) !== "off"');
    expect(component).toContain("slice(-MAX_LIVE)");
    expect(component).toContain('"pm_cam_sparkles"');
  });

  it("labels the toggle in both player languages", () => {
    expect(component).toContain("kelap-kelip");
    expect(component).toContain("sparkle effects");
  });

  it("keeps animating under reduced motion so finished sparkles still unmount", () => {
    // animationend drives React cleanup — `animation: none` would strand them.
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*pm-cam-sparkle-fade/);
    expect(component).toContain("onAnimationEnd");
  });
});
