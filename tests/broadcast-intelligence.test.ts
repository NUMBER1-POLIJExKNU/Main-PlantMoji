import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("broadcast intelligence presentation", () => {
  it("uses one reusable console and accessible skippable typewriter", () => {
    const component = read("src/components/intelligence-console.tsx");
    expect(component).toContain("prefers-reduced-motion: reduce");
    expect(component).toContain('aria-label={text}');
    expect(component).toContain("onClick={() => setShown(text)}");
  });

  it("keeps crop truth deterministic while dramatizing the real pipeline", () => {
    const explorer = read("src/components/crop-explorer.tsx");
    expect(explorer).toContain('AI MAY CHANGE RESULT');
    expect(explorer).toContain('value: "FALSE"');
    expect(explorer).toContain('DETERMINISTIC RESULT');
    expect(explorer).toContain('READY / SAFE FALLBACK');
  });

  it("labels local camera privacy and authority limits", () => {
    const camera = read("src/components/camera-guardian.tsx");
    expect(camera).toContain('label: "CAMERA"');
    expect(camera).toContain('label: "LOCAL MODEL"');
    expect(camera).toContain('label: "RESULT"');
    expect(camera).not.toContain('REWARD CONTROL');
  });

  it("provides honest boot, ending, fullscreen, and verification staging", () => {
    const overlay = read("src/components/broadcast-overlay.tsx");
    const demo = read("public/farm/demo.js");
    const farm = read("public/farm/index.html");
    expect(overlay).toContain("SAFE AI FALLBACK");
    expect(overlay).toContain("SENSE · UNDERSTAND · ACT");
    expect(demo).toContain("toggleFullscreen");
    expect(demo).toContain('case "x"');
    expect(farm).toContain('id="quest-verify-console"');
    expect(farm).toContain("XP TRANSACTION");
    expect(farm).toContain("LOCKED");
  });
});
