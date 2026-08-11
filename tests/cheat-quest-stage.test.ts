import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cheatQuestStage,
  stageFromBoard,
  stageFromQuestStatus,
  stageFromSensors,
  toSensorData,
  STAGE_ACT,
  STAGE_VERIFY,
  STAGE_REWARD,
} from "@/game/quests/cheat-quest-stage";
import { sensorBlocksRecovery } from "@/game/quests/quest-engine";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getCropProfile } from "@/lib/crop-profiles";

// The sandbox lets a presenter force a stage OR earn it by editing sensors.
// These cover both paths and, above all, that "earning" it uses the engine's
// own rule instead of a demo-only imitation.

const comfy = { temperature: 24, humidity: 50, light: 60, soilPh: 6 };

describe("cheat quest stage", () => {
  it("leaves the real quest row in charge when the sandbox says nothing", () => {
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE" })).toBe(STAGE_ACT);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "VERIFYING" })).toBe(STAGE_VERIFY);
    expect(stageFromQuestStatus(null)).toBe(STAGE_ACT);
  });

  it("lets the board force any stage, including REWARD", () => {
    expect(stageFromBoard({ COOL_ME_DOWN: 4 }, "COOL_ME_DOWN")).toBe(STAGE_REWARD);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE", quests: { COOL_ME_DOWN: 4 } })).toBe(STAGE_REWARD);
    // Untouched, or junk, means "no opinion" — never a reset to stage 0.
    expect(stageFromBoard({}, "COOL_ME_DOWN")).toBe(0);
    expect(stageFromBoard({ COOL_ME_DOWN: "nonsense" }, "COOL_ME_DOWN")).toBe(0);
  });

  it("advances a recovery quest once the sensor edit actually fixes it", () => {
    const hot = { ...comfy, temperature: 34 };
    expect(stageFromSensors("COOL_ME_DOWN", hot)).toBe(STAGE_ACT);
    expect(stageFromSensors("COOL_ME_DOWN", comfy)).toBe(STAGE_VERIFY);

    const sour = { ...comfy, soilPh: 4.2 };
    expect(stageFromSensors("BALANCE_SOIL_ACIDIC", sour)).toBe(STAGE_ACT);
    expect(stageFromSensors("BALANCE_SOIL_ACIDIC", comfy)).toBe(STAGE_VERIFY);

    const dry = { ...comfy, humidity: 20 };
    expect(stageFromSensors("HUMIDIFY_MY_AIR", dry)).toBe(STAGE_ACT);
    expect(stageFromSensors("HUMIDIFY_MY_AIR", comfy)).toBe(STAGE_VERIFY);
  });

  it("asks the engine's own predicate, not a demo-only imitation", () => {
    const profile = getCropProfile(null);
    for (const key of ["COOL_ME_DOWN", "WARM_ME_UP", "BALANCE_SOIL_ALKALINE", "DEHUMIDIFY_MY_AIR"] as const) {
      for (const vitals of [comfy, { ...comfy, temperature: 40 }, { ...comfy, temperature: 5 }, { ...comfy, soilPh: 9 }, { ...comfy, humidity: 95 }]) {
        const blocked = sensorBlocksRecovery(QUEST_DEFINITIONS[key], toSensorData(vitals), profile);
        expect(stageFromSensors(key, vitals, profile)).toBe(blocked ? STAGE_ACT : STAGE_VERIFY);
      }
    }
  });

  it("maps the store's soilPh onto the engine's soilPH", () => {
    // A silent mismatch here would make every soil quest look already fixed.
    expect(toSensorData({ temperature: 1, humidity: 2, light: 3, soilPh: 4 })).toEqual({
      temperature: 1, humidity: 2, light: 3, soilPH: 4,
    });
  });

  it("never hands out REWARD for a sensor edit alone", () => {
    // On real hardware the reward is gated on the reading HOLDING. Collapsing
    // that into the moment of the fix would sell the tap-to-win this quest
    // design refuses, so fixing the problem stops at VERIFY.
    expect(stageFromSensors("COOL_ME_DOWN", comfy)).toBe(STAGE_VERIFY);
    expect(cheatQuestStage({ key: "COOL_ME_DOWN", questStatus: "ACTIVE", vitals: comfy })).toBe(STAGE_VERIFY);
  });

  it("says nothing about maintain quests, which no sensor edit can fast-forward", () => {
    expect(QUEST_DEFINITIONS.KEEP_ME_HAPPY.kind).toBe("maintain");
    expect(stageFromSensors("KEEP_ME_HAPPY", comfy)).toBe(0);
    // ...so the board is the only way to move them.
    expect(cheatQuestStage({ key: "KEEP_ME_HAPPY", questStatus: "ACTIVE", vitals: comfy, quests: { KEEP_ME_HAPPY: 3 } })).toBe(STAGE_VERIFY);
  });

  it("takes the furthest source so neither path walks the card backwards", () => {
    // Forced to REWARD, then a sensor nudge that alone would say ACT.
    expect(cheatQuestStage({
      key: "COOL_ME_DOWN",
      questStatus: "ACTIVE",
      quests: { COOL_ME_DOWN: 4 },
      vitals: { ...comfy, temperature: 34 },
    })).toBe(STAGE_REWARD);
  });

  it("keeps the sensor rule out of the client bundle's server dependencies", () => {
    // sensorBlocksRecovery moved to a leaf module precisely so the client
    // island could import it; if it drifts back, quest-engine's Supabase
    // helpers follow it into the browser bundle.
    const leaf = readFileSync("src/game/quests/sensor-recovery.ts", "utf8");
    expect(leaf).toContain("export function sensorBlocksRecovery");
    expect(leaf).not.toContain("@supabase/supabase-js");
    expect(leaf).not.toContain("crop-profile-data");
    const island = readFileSync("src/components/quest-hero-stages.tsx", "utf8");
    expect(island).not.toContain("quest-engine");
  });
});

describe("collection reward preview", () => {
  const tabs = readFileSync("src/components/collection-tabs.tsx", "utf8");

  it("brings the reward pop into view, since it renders above the button", () => {
    // Story's "Play scene" sits below the chapter map and the chapter card,
    // while the pop renders under the tab bar — it fired off-screen and read
    // as a dead button.
    expect(tabs).toContain("const previewRef = useRef<HTMLElement | null>(null);");
    expect(tabs).toContain('node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });');
    expect(tabs).toContain("ref={previewRef}");
    expect(tabs).toMatch(/matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  });
});
