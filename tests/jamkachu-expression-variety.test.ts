import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Re-pinned for the farm-wave expression upgrade: the original three-face
// expr-* cycle grew into per-mood pools of dedicated tap-reaction faces
// (data-face="tap-*" art in index.html, tapface-* classes from live.js's
// showPetExpression). The deeper contract is unchanged and pinned here:
// variety per mood, cycling taps, presentation-only, sleep respected.
// tests/jamkachu-expressions.test.ts carries the full structural contract.

const source = readFileSync("public/farm/live.js", "utf8");

describe("Jamkachu tap expression variety", () => {
  it("cycles at least three expressions for every sensor-backed mood", () => {
    for (const mood of ["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"]) {
      // Pool literal: Mood: ["a", "b", "c", ...] with ≥3 entries.
      expect(source).toMatch(new RegExp(`${mood}: \\["[^"]+", "[^"]+", "[^"]+"`));
    }
    expect(source).toContain("petExpressionIndex % pool.length");
  });

  it("keeps expressions presentation-only and respects sleep (plus hatch/tour)", () => {
    const start = source.indexOf("function showPetExpression");
    const end = source.indexOf("function quickPetResponse", start);
    const helper = source.slice(start, end);
    expect(helper).toContain("if (sleepShown || hatchActive || tourActive) return");
    expect(helper).not.toMatch(/fetch\(|award|xp_|quest|localStorage/);
  });
});
