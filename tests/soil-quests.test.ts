// Soil-pH recovery quests (handoff §16 "Healthy Soil / Balance My Soil").
// Pure tests — no Supabase client, only the definitions catalog and the
// exported sensorBlocksRecovery guard.

import { describe, expect, it } from "vitest";
import { QUEST_KEYS } from "@/types/game";
import { QUEST_DEFINITIONS, questsTriggeredBy } from "@/game/quests/quest-definitions";
import { sensorBlocksRecovery } from "@/game/quests/quest-engine";

describe("QUEST_DEFINITIONS completeness", () => {
  it("has a definition for every QuestKey in the union", () => {
    for (const key of QUEST_KEYS) {
      const def = QUEST_DEFINITIONS[key];
      expect(def, `missing definition for ${key}`).toBeDefined();
      expect(def.key).toBe(key);
    }
  });

  it("defines the two soil quests per handoff §16 / §5.2", () => {
    for (const key of ["BALANCE_SOIL_ACIDIC", "BALANCE_SOIL_ALKALINE"] as const) {
      const def = QUEST_DEFINITIONS[key];
      expect(def.title).toBe("Balance My Soil");
      expect(def.kind).toBe("recovery");
      expect(def.requiredSeconds).toBe(300);
      expect(def.xpReward).toBe(25);
      expect(def.emoji).toBe("🧪");
      expect(def.verifyPhRange).toEqual({ min: 6.0, max: 7.0 });
    }
  });
});

describe("questsTriggeredBy soil moods", () => {
  it("SoilAcidic triggers exactly BALANCE_SOIL_ACIDIC", () => {
    expect(questsTriggeredBy("SoilAcidic").map((def) => def.key)).toEqual([
      "BALANCE_SOIL_ACIDIC",
    ]);
  });

  it("SoilAlkaline triggers exactly BALANCE_SOIL_ALKALINE", () => {
    expect(questsTriggeredBy("SoilAlkaline").map((def) => def.key)).toEqual([
      "BALANCE_SOIL_ALKALINE",
    ]);
  });
});

describe("sensorBlocksRecovery", () => {
  const acidic = QUEST_DEFINITIONS.BALANCE_SOIL_ACIDIC;
  const coolDown = QUEST_DEFINITIONS.COOL_ME_DOWN;

  it("blocks BALANCE_SOIL_ACIDIC while pH is still 5.5", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 5.5 })).toBe(true);
  });

  it("does not block once pH is back in range (6.5)", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 6.5 })).toBe(false);
  });

  it("treats the range as inclusive at both bounds", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 6.0 })).toBe(false);
    expect(sensorBlocksRecovery(acidic, { soilPH: 7.0 })).toBe(false);
  });

  it("does not block when the event carries no soilPH", () => {
    expect(sensorBlocksRecovery(acidic, { temperature: 25 })).toBe(false);
    expect(sensorBlocksRecovery(acidic, {})).toBe(false);
    expect(sensorBlocksRecovery(acidic, undefined)).toBe(false);
  });

  it("ignores non-finite or non-numeric soilPH values", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: Number.NaN })).toBe(false);
    expect(sensorBlocksRecovery(acidic, { soilPH: "5.5" })).toBe(false);
  });

  it("still blocks COOL_ME_DOWN when temperature is 31", () => {
    expect(sensorBlocksRecovery(coolDown, { temperature: 31 })).toBe(true);
    expect(sensorBlocksRecovery(coolDown, { temperature: 30 })).toBe(false);
  });
});
