import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLuckyQuest, luckyRewardKey } from "@/game/random/lucky";
import { hashDailyKey } from "@/game/random/daily-events";
import { runGameTick } from "@/game/events/event-router";

// ── Event-router collaborators, mocked for the settle-order test ─────────
// settleCompletions treats the BASE reward_key (`quest:<id>:completion`) as
// the quest's settlement marker, so the lucky ×2 award MUST run before it —
// a crash between the two awaits would otherwise orphan the bonus forever
// (the next sweep sees the marker and skips the quest). Every side-effecting
// collaborator is mocked; streak-engine and daily-events keep their real
// pure helpers (dayString, hashDailyKey) via importOriginal so the other
// describe blocks below still exercise the production hash.

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  awardXp: vi.fn(),
  getBondState: vi.fn(),
  evaluateQuests: vi.fn(),
  handleStateChange: vi.fn(),
  evaluateBadges: vi.fn(),
  evaluateChapters: vi.fn(),
  recordQualifyingCare: vi.fn(),
  getDailyEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/game/progression/xp-engine", () => ({
  awardXp: mocks.awardXp,
  getBondState: mocks.getBondState,
}));
vi.mock("@/game/quests/quest-engine", () => ({
  evaluateQuests: mocks.evaluateQuests,
  handleStateChange: mocks.handleStateChange,
}));
vi.mock("@/game/badges/badge-engine", () => ({ evaluateBadges: mocks.evaluateBadges }));
vi.mock("@/game/story/story-engine", () => ({ evaluateChapters: mocks.evaluateChapters }));
vi.mock("@/game/progression/streak-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/game/progression/streak-engine")>()),
  recordQualifyingCare: mocks.recordQualifyingCare,
}));
vi.mock("@/game/random/daily-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/game/random/daily-events")>()),
  getDailyEvent: mocks.getDailyEvent,
}));

interface StubResponse {
  data: unknown;
  error: null;
}

/** Minimal thenable PostgREST-style chain: every builder method returns the
 *  chain itself, and awaiting it resolves the canned response. */
function chainable(response: StubResponse) {
  const stub: Record<string, unknown> = {};
  const self = () => stub;
  for (const method of ["select", "eq", "neq", "in", "gte", "lt", "order", "limit", "upsert"]) {
    stub[method] = self;
  }
  stub.then = (resolve: (value: StubResponse) => unknown) =>
    Promise.resolve(response).then(resolve);
  return stub;
}

/** Supabase stub: one COMPLETED quest row, empty everywhere else (so the
 *  reward ledger reports the quest UNSETTLED and no badge/chapter award
 *  muddies the call order). */
function supabaseStub(questRow: Record<string, unknown>) {
  return {
    from: (tableName: string) =>
      chainable({ data: tableName === "quests" ? [questRow] : [], error: null }),
  };
}

describe("settleCompletions award order (lucky before the settlement marker)", () => {
  beforeEach(() => {
    mocks.awardXp.mockResolvedValue({ awarded: true });
    mocks.getBondState.mockResolvedValue(null); // no chapters to sweep
    mocks.evaluateQuests.mockResolvedValue(undefined);
    mocks.evaluateBadges.mockResolvedValue([]);
    mocks.evaluateChapters.mockResolvedValue([]);
    mocks.recordQualifyingCare.mockResolvedValue({
      currentStreak: 1, // below every milestone → no streak-milestone awards
      longestStreak: 1,
      qualifiedToday: true,
    });
    // Flavor day: settleDailyChallenge early-returns and the daily boost
    // multiplier stays 1 — the sweep's only awards are the quest's own.
    mocks.getDailyEvent.mockReturnValue({
      id: "CARNAVAL_DAY",
      name: "Carnaval Day",
      description: "flavor only",
      emoji: "🎭",
      kind: "flavor",
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("awards the lucky ×2 bonus BEFORE the base award", async () => {
    // A quest id that genuinely rolls lucky under the production hash.
    const luckyId = Array.from({ length: 400 }, (_, i) => `quest-${i}`).find(isLuckyQuest);
    expect(luckyId).toBeDefined();
    if (!luckyId) return;

    mocks.getServerSupabase.mockReturnValue(
      supabaseStub({
        id: luckyId,
        plant_id: "plant-01",
        quest_key: "WATER_PLANT",
        status: "COMPLETED",
        xp_reward: 30,
        completed_at: "2026-08-05T10:00:00.000Z",
      }),
    );

    await runGameTick("plant-01");

    const keys = mocks.awardXp.mock.calls.map((call) => call[2] as string);
    const luckyIndex = keys.indexOf(luckyRewardKey(luckyId));
    const baseIndex = keys.indexOf(`quest:${luckyId}:completion`);
    expect(luckyIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThanOrEqual(0);

    // The base reward_key is the settlement marker: it must be the LAST
    // award for the quest, written AFTER the lucky bonus, so its presence
    // implies the lucky roll already settled (crash-window self-healing).
    expect(luckyIndex).toBeLessThan(baseIndex);
    expect(baseIndex).toBe(keys.length - 1);

    // Both awards carry the SAME composed amount (net ×2, spec D2).
    expect(mocks.awardXp.mock.calls[luckyIndex][3]).toBe(mocks.awardXp.mock.calls[baseIndex][3]);
  });
});

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
