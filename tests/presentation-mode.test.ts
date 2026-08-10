import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("camera-facing presentation mode", () => {
  it("offers director controls without changing domain results", () => {
    const overlay = read("src/components/broadcast-overlay.tsx");
    for (const control of ["START DEMO", "NEXT SCENE", "HOLD", "REPLAY EFFECT", "LIVE SOURCE", "DEMO SOURCE", "MUTE", "CAMERA READY"]) {
      expect(overlay).toContain(control);
    }
    expect(overlay).not.toContain("awardXp");
  });

  it("shows an honest reusable processing rail for scan and local vision", () => {
    const explorer = read("src/components/crop-explorer.tsx");
    const camera = read("src/components/camera-guardian.tsx");
    expect(explorer).toContain("Rule-based Environment Analyzer");
    expect(explorer).toContain("Gemini Flash / Deterministic fallback");
    expect(camera).toContain('label: "LOCAL MODEL"');
    expect(explorer).toContain("<ProcessRail");
    expect(camera).toContain("<ProcessRail");
  });

  it("keeps filmed process results legible without depending on color alone", () => {
    const css = read("src/app/globals.css");
    const rail = read("src/components/process-rail.tsx");
    expect(css).toMatch(/\.pm-process-rail small[^}]*font:16px/);
    expect(css).toMatch(/\.pm-analysis-authority span[^}]*font-size:16px/);
    expect(rail).toContain('ICON[step.state]');
    expect(rail).toContain("step.summary");
  });
});
