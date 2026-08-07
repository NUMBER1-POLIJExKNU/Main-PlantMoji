import { describe, expect, it } from "vitest";
import {
  DAILY_EVENT_POOL,
  dailyBoostMultiplier,
  dailyChallengeRewardKey,
  getDailyEvent,
  hashDailyKey,
  wibHour,
} from "@/game/random/daily-events";

const PLANT_ID = "plant-01";

/** The pool entry the hash formula selects for a given WIB day string. */
function expectedEventFor(plantId: string, day: string) {
  return DAILY_EVENT_POOL[hashDailyKey(`${plantId}|${day}`) % DAILY_EVENT_POOL.length];
}

describe("hashDailyKey", () => {
  it("is stable: the same input always hashes to the same value", () => {
    const input = `${PLANT_ID}|2026-08-07`;
    expect(hashDailyKey(input)).toBe(hashDailyKey(input));
    // FNV-1a of the empty string is the offset basis — a fixed, documented
    // constant, so any accidental algorithm change fails loudly here.
    expect(hashDailyKey("")).toBe(0x811c9dc5);
  });

  it("always produces an unsigned 32-bit integer (safe for modulo)", () => {
    for (const input of ["", "a", `${PLANT_ID}|2026-08-07`, "plant-02|2026-12-31"]) {
      const hash = hashDailyKey(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("spreads 30 consecutive dates across the pool (at least 3 distinct events)", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day += 1) {
      const dd = String(day).padStart(2, "0");
      // 03:00Z = 10:00 WIB — unambiguously inside the WIB calendar day.
      const event = getDailyEvent(PLANT_ID, new Date(`2026-08-${dd}T03:00:00Z`));
      seen.add(event.id);
      // Each pick matches the documented formula over the WIB day string.
      expect(event).toBe(expectedEventFor(PLANT_ID, `2026-08-${dd}`));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe("getDailyEvent", () => {
  it("is deterministic: same plant + same instant → same event", () => {
    const date = new Date("2026-08-07T03:00:00Z");
    expect(getDailyEvent(PLANT_ID, date)).toBe(getDailyEvent(PLANT_ID, date));
  });

  it("returns the same event for any two instants on the same WIB day", () => {
    // 2026-08-07 in WIB runs 2026-08-06T17:00:00Z .. 2026-08-07T16:59:59Z.
    const morning = new Date("2026-08-06T17:30:00Z"); // 00:30 WIB Aug 7
    const evening = new Date("2026-08-07T16:59:00Z"); // 23:59 WIB Aug 7
    expect(getDailyEvent(PLANT_ID, morning)).toBe(getDailyEvent(PLANT_ID, evening));
    expect(getDailyEvent(PLANT_ID, morning)).toBe(expectedEventFor(PLANT_ID, "2026-08-07"));
  });

  it("treats a WIB-boundary instant as tomorrow's event, not UTC-today's", () => {
    // 2026-08-07T17:30:00Z is UTC+7 = 2026-08-08 00:30 WIB — already the next
    // calendar day in WIB even though the UTC date is still Aug 7.
    const boundary = new Date("2026-08-07T17:30:00Z");
    expect(getDailyEvent(PLANT_ID, boundary)).toBe(expectedEventFor(PLANT_ID, "2026-08-08"));
    expect(getDailyEvent(PLANT_ID, boundary)).toBe(
      getDailyEvent(PLANT_ID, new Date("2026-08-08T03:00:00Z")),
    );
  });

  it("rejects an invalid Date", () => {
    expect(() => getDailyEvent(PLANT_ID, new Date("nonsense"))).toThrow(
      "getDailyEvent: invalid Date",
    );
  });
});

describe("dailyChallengeRewardKey", () => {
  it("builds the deterministic ledger key", () => {
    expect(dailyChallengeRewardKey(PLANT_ID, "2026-08-07", "JOURNAL_DAY")).toBe(
      "daily-challenge:plant-01:2026-08-07:JOURNAL_DAY",
    );
  });
});

describe("dailyBoostMultiplier", () => {
  it("returns the multiplier for xp_boost events and 1 for everything else", () => {
    for (const event of DAILY_EVENT_POOL) {
      if (event.kind === "xp_boost") {
        expect(dailyBoostMultiplier(event)).toBe(event.xpMultiplier);
        expect(dailyBoostMultiplier(event)).toBeGreaterThan(1);
      } else {
        expect(dailyBoostMultiplier(event)).toBe(1);
      }
    }
  });
});

describe("DAILY_EVENT_POOL integrity", () => {
  it("has 7–10 entries with unique ids", () => {
    expect(DAILY_EVENT_POOL.length).toBeGreaterThanOrEqual(7);
    expect(DAILY_EVENT_POOL.length).toBeLessThanOrEqual(10);
    const ids = DAILY_EVENT_POOL.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps exactly the challenge ids the event router knows how to verify", () => {
    // settleDailyChallenge (event-router.ts) verifies these three ids against
    // persisted data. A challenge id the router doesn't recognize would be a
    // promise the game can never pay out — lock the contract here.
    const challengeIds = DAILY_EVENT_POOL.filter(
      (event) => event.kind === "daily_challenge",
    ).map((event) => event.id);
    expect(new Set(challengeIds)).toEqual(
      new Set(["STEADY_DAY", "JOURNAL_DAY", "QUEST_FINISHER"]),
    );
  });

  it("gives every entry a name, description, and emoji", () => {
    for (const event of DAILY_EVENT_POOL) {
      expect(event.name.length).toBeGreaterThan(0);
      expect(event.description.length).toBeGreaterThan(0);
      expect(event.emoji.length).toBeGreaterThan(0);
    }
  });

  it("keeps kind-specific fields consistent", () => {
    for (const event of DAILY_EVENT_POOL) {
      if (event.kind === "xp_boost") {
        expect(event.xpMultiplier).toBeGreaterThan(1);
        expect(event.challengeXp).toBeUndefined();
      } else if (event.kind === "daily_challenge") {
        expect(Number.isInteger(event.challengeXp)).toBe(true);
        expect(event.challengeXp).toBeGreaterThan(0);
        expect(event.xpMultiplier).toBeUndefined();
      } else {
        // Flavor days are pure language — no XP mechanics at all.
        expect(event.kind).toBe("flavor");
        expect(event.xpMultiplier).toBeUndefined();
        expect(event.challengeXp).toBeUndefined();
      }
    }
  });

  it("contains at least one of each kind", () => {
    const kinds = new Set(DAILY_EVENT_POOL.map((event) => event.kind));
    expect(kinds).toEqual(new Set(["xp_boost", "daily_challenge", "flavor"]));
  });
});

describe("wibHour", () => {
  it("converts UTC instants to the WIB (UTC+7) wall-clock hour", () => {
    expect(wibHour(new Date("2026-08-07T11:00:00Z"))).toBe(18); // STEADY_DAY window closes
    expect(wibHour(new Date("2026-08-07T10:59:00Z"))).toBe(17); // still inside the window
    expect(wibHour(new Date("2026-08-07T16:59:00Z"))).toBe(23);
    expect(wibHour(new Date("2026-08-07T17:00:00Z"))).toBe(0); // WIB midnight, h23 → 0
  });
});
