import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEMO_PRESENTATION_MAX_XP, nextCompanionStage, xpBeforeNextLevel } from "@/game/demo/presenter";
import { getEnvironmentDemoPreset } from "@/lib/environment-demo";
import { XP_PER_LEVEL } from "@/types/game";

describe("presenter demo scenarios", () => {
  it("prepares the final XP before the next level without decreasing progress", () => {
    // "One short of the next level" is the top of the current band, whatever
    // a level currently costs.
    expect(xpBeforeNextLevel(0)).toBe(XP_PER_LEVEL - 1);
    expect(xpBeforeNextLevel(XP_PER_LEVEL - 1)).toBe(XP_PER_LEVEL - 1);
    expect(xpBeforeNextLevel(XP_PER_LEVEL)).toBe(XP_PER_LEVEL * 2 - 1);
    expect(xpBeforeNextLevel(DEMO_PRESENTATION_MAX_XP)).toBe(DEMO_PRESENTATION_MAX_XP);
  });

  it("advances companion stages monotonically", () => {
    expect(nextCompanionStage("Seed")).toBe("Sprout");
    expect(nextCompanionStage("Sprout")).toBe("Seedling");
    expect(nextCompanionStage("Bud")).toBe("Bloom");
    expect(nextCompanionStage("Bloom")).toBe("Fruit");
    expect(nextCompanionStage("Guardian")).toBe("Elder");
    expect(nextCompanionStage("Legend")).toBeNull();
  });

  it("uses Bond XP rather than direct companion writes for demo evolution", () => {
    const source = readFileSync("src/game/demo/presenter.ts", "utf8");
    expect(source).toContain('"presenter-level-evolution"');
    expect(source).toContain("await awardXp(");
    expect(source).not.toContain('from("companion_evolutions").upsert');
    expect(source).not.toContain('from("companion_state").upsert');
  });

  it("uses explicit virtual snapshots without persisting sensor truth", () => {
    expect(getEnvironmentDemoPreset("hot").temperature).toBe(35);
    expect(getEnvironmentDemoPreset("dry").humidity).toBe(38);
    expect(getEnvironmentDemoPreset("dark").light).toBe(18);
    expect(getEnvironmentDemoPreset("unknown").recordedAt).toBeNull();
  });
});
