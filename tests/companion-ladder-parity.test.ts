import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { COMPANION_LADDER, COMPANION_STAGES } from "@/types/game";

// Guards against drift between the engine's ladder (src/types/game.ts
// COMPANION_LADDER — the single source of truth) and its display-only farm
// mirror (public/farm/companion-ladder.js). The farm layer renders labels and
// the next-stage level guide from the mirror; if the two tables disagree,
// students would see unlock levels that the engine never honors. Same
// pattern as tests/strings-parity.test.ts: read the plain script, evaluate it
// in a node:vm sandbox whose only global is a stub `window`, then compare.

const here = path.dirname(fileURLToPath(import.meta.url));
const ladderPath = path.resolve(here, "../public/farm/companion-ladder.js");
const source = readFileSync(ladderPath, "utf8");

interface LadderRow {
  stage: string;
  level: number;
}

type StubWindow = {
  PM_LADDER?: LadderRow[];
  PM_NEXT_STAGE?: (stageName: string) => LadderRow | null;
};

function loadFarmLadder(): Required<StubWindow> {
  const stubWindow: StubWindow = {};
  const context = vm.createContext({ window: stubWindow });
  vm.runInContext(source, context, { filename: ladderPath });
  if (!Array.isArray(stubWindow.PM_LADDER)) {
    throw new Error("companion-ladder.js did not assign window.PM_LADDER");
  }
  if (typeof stubWindow.PM_NEXT_STAGE !== "function") {
    throw new Error("companion-ladder.js did not assign window.PM_NEXT_STAGE");
  }
  return stubWindow as Required<StubWindow>;
}

const { PM_LADDER, PM_NEXT_STAGE } = loadFarmLadder();

describe("farm companion-ladder mirror parity", () => {
  it("farm ladder mirror matches the engine ladder exactly", () => {
    expect(PM_LADDER).toEqual(
      COMPANION_LADDER.map(({ stage, level }) => ({
        stage,
        level,
      })),
    );
  });

  it("covers every stage in COMPANION_STAGES order", () => {
    expect(PM_LADDER.map((row) => row.stage)).toEqual([...COMPANION_STAGES]);
    expect(PM_LADDER.map((row) => row.level)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it("PM_NEXT_STAGE walks the ladder one row at a time", () => {
    for (let i = 0; i < PM_LADDER.length - 1; i++) {
      expect(PM_NEXT_STAGE(PM_LADDER[i].stage)).toEqual(PM_LADDER[i + 1]);
    }
  });

  it("PM_NEXT_STAGE returns null at the top stage and for unknown stages", () => {
    const topStage = PM_LADDER[PM_LADDER.length - 1].stage;
    expect(PM_NEXT_STAGE(topStage)).toBeNull();
    // Unknown stage (old client + newer DB, or vice versa) must hide the
    // progress line via null — never throw or invent a requirement.
    expect(PM_NEXT_STAGE("Cocoon")).toBeNull();
  });
});
