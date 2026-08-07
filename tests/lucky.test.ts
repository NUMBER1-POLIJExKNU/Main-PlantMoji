import { describe, expect, it } from "vitest";
import { isLuckyQuest, luckyRewardKey } from "@/game/random/lucky";
import { hashDailyKey } from "@/game/random/daily-events";

describe("isLuckyQuest", () => {
  it("is deterministic", () => {
    expect(isLuckyQuest("q-1")).toBe(isLuckyQuest("q-1"));
  });

  it("matches the documented hash formula exactly", () => {
    // The lucky roll must be a pure function of the quest id via the shared
    // FNV-1a hash — replay-stable and precomputable for demos (spec D2).
    for (const id of ["q-1", "abc", "3f2b6d1e-0000-4000-8000-000000000000"]) {
      expect(isLuckyQuest(id)).toBe(hashDailyKey(`lucky:${id}`) % 8 === 0);
    }
  });

  it("hits roughly 1/8", () => {
    const hits = Array.from({ length: 8000 }, (_, i) => isLuckyQuest(`q-${i}`)).filter(
      Boolean,
    ).length;
    expect(hits).toBeGreaterThan(600);
    expect(hits).toBeLessThan(1400);
  });
});

describe("luckyRewardKey", () => {
  it("builds the ledger key", () => {
    expect(luckyRewardKey("abc")).toBe("lucky:abc");
  });
});
