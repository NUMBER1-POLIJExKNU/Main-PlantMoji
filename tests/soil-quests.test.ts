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

  it("defines HUMIDIFY_MY_AIR as the DryAir recovery quest (handoff §5.2 dry-OFF at 45%)", () => {
    const def = QUEST_DEFINITIONS.HUMIDIFY_MY_AIR;
    expect(def.title).toBe("Humidify My Air");
    expect(def.kind).toBe("recovery");
    expect(def.triggerMood).toBe("DryAir");
    expect(def.requiredSeconds).toBe(300);
    expect(def.xpReward).toBe(20);
    expect(def.emoji).toBe("💦");
    expect(def.verifyHumidityMin).toBe(45);
  });

  it("defines STAY_COMFY as a two-hour Happy maintain quest", () => {
    const def = QUEST_DEFINITIONS.STAY_COMFY;
    expect(def.title).toBe("Stay Comfy");
    expect(def.kind).toBe("maintain");
    expect(def.triggerMood).toBe("Happy");
    expect(def.requiredSeconds).toBe(7200);
    expect(def.xpReward).toBe(40);
    expect(def.emoji).toBe("🛋️");
  });

  it("defines the two soil quests per handoff §16 / §5.2", () => {
    for (const key of ["BALANCE_SOIL_ACIDIC", "BALANCE_SOIL_ALKALINE"] as const) {
      const def = QUEST_DEFINITIONS[key];
      expect(def.title).toBe("Balance My Soil");
      expect(def.kind).toBe("recovery");
      expect(def.requiredSeconds).toBe(300);
      expect(def.xpReward).toBe(25);
      expect(def.emoji).toBe("🧪");
      expect(def.verifyPhRange).toEqual({ min: 5.5, max: 6.5 });
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

  it("DryAir triggers exactly HUMIDIFY_MY_AIR", () => {
    expect(questsTriggeredBy("DryAir").map((def) => def.key)).toEqual([
      "HUMIDIFY_MY_AIR",
    ]);
  });

  it("Happy triggers BOTH maintain quests (per-key unique index lets them coexist)", () => {
    expect(
      questsTriggeredBy("Happy")
        .map((def) => def.key)
        .sort(),
    ).toEqual(["KEEP_ME_HAPPY", "STAY_COMFY"]);
  });
});

describe("sensorBlocksRecovery", () => {
  const acidic = QUEST_DEFINITIONS.BALANCE_SOIL_ACIDIC;
  const coolDown = QUEST_DEFINITIONS.COOL_ME_DOWN;
  const humidify = QUEST_DEFINITIONS.HUMIDIFY_MY_AIR;

  it("blocks BALANCE_SOIL_ACIDIC below the strawberry range", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 5.49 })).toBe(true);
  });

  it("does not block once pH is back in range (6.5)", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 6.5 })).toBe(false);
  });

  it("treats the range as inclusive at both bounds", () => {
    expect(sensorBlocksRecovery(acidic, { soilPH: 5.5 })).toBe(false);
    expect(sensorBlocksRecovery(acidic, { soilPH: 6.5 })).toBe(false);
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

  it("uses the strawberry recovery threshold for COOL_ME_DOWN", () => {
    expect(sensorBlocksRecovery(coolDown, { temperature: 27 })).toBe(true);
    expect(sensorBlocksRecovery(coolDown, { temperature: 26 })).toBe(false);
  });

  it("blocks HUMIDIFY_MY_AIR while the air is still dry (30% < dry-OFF 45%)", () => {
    expect(sensorBlocksRecovery(humidify, { humidity: 30 })).toBe(true);
  });

  it("does not block HUMIDIFY_MY_AIR once humidity recovered (50%)", () => {
    expect(sensorBlocksRecovery(humidify, { humidity: 50 })).toBe(false);
  });

  it("does not block HUMIDIFY_MY_AIR when the event carries no humidity", () => {
    expect(sensorBlocksRecovery(humidify, { temperature: 25 })).toBe(false);
    expect(sensorBlocksRecovery(humidify, {})).toBe(false);
    expect(sensorBlocksRecovery(humidify, undefined)).toBe(false);
  });
});
