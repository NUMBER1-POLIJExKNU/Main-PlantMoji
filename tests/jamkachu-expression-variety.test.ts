import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Re-pinned for the kiki designer-sprite integration: the tap-reaction face
// pools became per-mood pools of {spriteMood, emojiBurst} pairs — a tap
// flashes an ALTERNATE drawn sprite mood for ~1.2s via window.PMSprite
// (jamkachu-sprite.js) plus one emoji burst, then reverts to the honest
// mood frame. The deeper contract is unchanged and pinned here: variety per
// mood, cycling taps, presentation-only, sleep respected.
// tests/jamkachu-expressions.test.ts carries the full structural contract.

const source = readFileSync("public/farm/live.js", "utf8");

describe("Jamkachu tap expression variety", () => {
  it("cycles at least three reaction pairs for every sensor-backed mood", () => {
    for (const mood of ["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"]) {
      // Pool literal: Mood: [ { spriteMood: "a", emojiBurst: "x" }, … ] with ≥3 entries.
      expect(source).toMatch(
        new RegExp(
          `${mood}: \\[\\s*(?:\\{ spriteMood: "[^"]+", emojiBurst: "[^"]+" \\},\\s*){3,}`,
        ),
      );
    }
    expect(source).toContain("petExpressionIndex % pool.length");
  });

  it("offers twelve distinct positive Happy reactions with a visible face badge", () => {
    const happy = source.slice(source.indexOf("Happy: ["), source.indexOf("  ],", source.indexOf("Happy: [")) + 4);
    expect((happy.match(/emojiBurst:/g) ?? []).length).toBeGreaterThanOrEqual(12);
    expect(source).toContain("const POSITIVE_FACE_GLYPHS");
    expect(source).toContain('positive-expression');
    expect(happy).not.toMatch(/spriteMood: "(?:plain|sleepy)"/);
  });

  it("keeps expressions presentation-only and respects sleep (plus hatch/tour)", () => {
    const start = source.indexOf("function showPetExpression");
    const end = source.indexOf("// Idle expression variety", start);
    const helper = source.slice(start, end);
    expect(helper).toContain("if (sleepShown || hatchActive || tourActive) return");
    expect(helper).toContain("window.PMSprite.set({ flashMood: reaction.spriteMood })");
    expect(helper).not.toMatch(/fetch\(|award|xp_|quest|localStorage/);
  });
});
