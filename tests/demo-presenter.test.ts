import { describe, expect, it } from "vitest";
import { DEMO_PRESENTATION_MAX_XP, nextCompanionStage, xpBeforeNextLevel } from "@/game/demo/presenter";
import { getEnvironmentDemoPreset } from "@/lib/environment-demo";

describe("presenter demo scenarios", () => {
  it("prepares the final XP before the next level without decreasing progress", () => {
    expect(xpBeforeNextLevel(0)).toBe(29);
    expect(xpBeforeNextLevel(29)).toBe(29);
    expect(xpBeforeNextLevel(30)).toBe(59);
    expect(xpBeforeNextLevel(DEMO_PRESENTATION_MAX_XP)).toBe(DEMO_PRESENTATION_MAX_XP);
  });

  it("advances companion stages monotonically", () => {
    expect(nextCompanionStage("Seed")).toBe("Sprout");
    expect(nextCompanionStage("Sprout")).toBe("Bud");
    expect(nextCompanionStage("Bud")).toBe("Bloom");
    expect(nextCompanionStage("Bloom")).toBe("Guardian");
    expect(nextCompanionStage("Guardian")).toBeNull();
  });

  it("uses explicit virtual snapshots without persisting sensor truth", () => {
    expect(getEnvironmentDemoPreset("hot").temperature).toBe(35);
    expect(getEnvironmentDemoPreset("dry").humidity).toBe(38);
    expect(getEnvironmentDemoPreset("dark").light).toBe(18);
    expect(getEnvironmentDemoPreset("unknown").recordedAt).toBeNull();
  });
});
