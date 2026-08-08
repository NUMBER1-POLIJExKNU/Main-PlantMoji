import { describe, expect, it } from "vitest";
import { affinityForQuest, careForm, eligibleCompanionStage, type VerifiedCare } from "@/game/companion/companion-engine";
import type { QuestKey } from "@/types/game";

const care = (keys: QuestKey[], days = 1): VerifiedCare[] => keys.map((questKey, index) => ({
  questKey,
  completedAt: new Date(Date.UTC(2026, 7, 1 + (index % days), 5)).toISOString(),
}));

describe("companion evolution", () => {
  it("maps quest kinds to care affinities", () => {
    expect(affinityForQuest("COOL_ME_DOWN")).toBe("cool");
    expect(affinityForQuest("BALANCE_SOIL_ACIDIC")).toBe("soil");
    expect(affinityForQuest("STAY_COMFY")).toBe("steady");
  });

  it("honors count, diversity, and WIB-day boundaries", () => {
    expect(eligibleCompanionStage([])).toBe("Seed");
    expect(eligibleCompanionStage(care(["COOL_ME_DOWN"]))).toBe("Sprout");
    expect(eligibleCompanionStage(care(["COOL_ME_DOWN", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("Bud");
    const seven = care(["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "COOL_ME_DOWN"], 2);
    expect(eligibleCompanionStage(seven)).toBe("Bloom");
    const fifteen = care(Array.from({ length: 15 }, (_, index) => (["COOL_ME_DOWN", "HUMIDIFY_MY_AIR", "GIVE_ME_MORE_LIGHT", "BALANCE_SOIL_ACIDIC"] as QuestKey[])[index % 4]), 3);
    expect(eligibleCompanionStage(fifteen)).toBe("Guardian");
  });

  it("uses balanced for a tie and the sole leader otherwise", () => {
    expect(careForm(care(["COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("balanced");
    expect(careForm(care(["COOL_ME_DOWN", "COOL_ME_DOWN", "HUMIDIFY_MY_AIR"]))).toBe("cool");
  });
});
