import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runGameTick } from "@/game/events/event-router";
import { badgeRewardKey, chapterRewardKey } from "@/game/progression/bonus-xp";
import { dailyChallengeRewardKey } from "@/game/random/daily-events";
import { dayString } from "@/game/progression/streak-engine";
import { isLuckyQuest } from "@/game/random/lucky";

// ── Performance-surgery regression tests for settleCompletions ───────────
// 1. Steady state (every quest settled, every badge/chapter bonus already in
//    the xp_rewards ledger) must issue ZERO award_xp RPCs — the ledger
//    pre-filter replaces the per-badge / per-chapter re-award loops.
// 2. The second evaluateBadges/evaluateChapters pass (which exists only to
//    catch bonus-XP-triggered unlocks) must be SKIPPED when no award landed
//    in this settle, and must still RUN when one did.
//
// Mocking style mirrors tests/lucky.test.ts: side-effecting collaborators are
// mocked; bonus-xp / lucky / daily-events keep their real pure helpers so the
// reward keys asserted here are byte-identical to production.

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

// ── Table-aware Supabase stub ────────────────────────────────────────────

interface StubResponse {
  data: unknown;
  error: null;
  count?: number | null;
}

interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

type Responder = (chainCalls: RecordedCall[]) => StubResponse;

const CHAIN_METHODS = [
  "select",
  "eq",
  "neq",
  "in",
  "gte",
  "lt",
  "order",
  "limit",
  "upsert",
  "maybeSingle",
];

/** PostgREST-style thenable chain: every builder method records itself and
 *  returns the chain; awaiting resolves the table's responder, which can
 *  inspect the recorded chain (e.g. to tell a head:true count apart from a
 *  row select on the same table). */
function makeSupabase(responders: Record<string, Responder>, log: RecordedCall[]) {
  return {
    from(table: string) {
      const chainCalls: RecordedCall[] = [];
      const stub: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        stub[method] = (...args: unknown[]) => {
          const call = { table, method, args };
          chainCalls.push(call);
          log.push(call);
          return stub;
        };
      }
      stub.then = (resolve: (value: StubResponse) => unknown) => {
        const responder = responders[table] ?? (() => ({ data: [], error: null }));
        return Promise.resolve(responder(chainCalls)).then(resolve);
      };
      return stub;
    },
  };
}

const isCountQuery = (calls: RecordedCall[]) =>
  calls.some(
    (c) => c.method === "select" && (c.args[1] as { count?: string } | undefined)?.count,
  );

// ── Fixtures ─────────────────────────────────────────────────────────────

const PLANT = "plant-01";

const SETTLED_QUEST = {
  id: "q-settled",
  plant_id: PLANT,
  quest_key: "WATER_PLANT",
  status: "COMPLETED",
  xp_reward: 30,
  completed_at: "2026-08-05T10:00:00.000Z",
};

const OWNED_BADGES = ["FIRST_RESCUE", "STREAK_7"] as const;
const CURRENT_CHAPTER = 3;

/** Every reward key the steady-state sweep could try to award. */
function fullLedger(): Array<{ reward_key: string }> {
  return [
    { reward_key: `quest:${SETTLED_QUEST.id}:completion` },
    ...OWNED_BADGES.map((key) => ({ reward_key: badgeRewardKey(PLANT, key) })),
    ...[1, 2, 3].map((chapter) => ({ reward_key: chapterRewardKey(PLANT, chapter) })),
  ];
}

function steadyResponders(ledger: Array<{ reward_key: string }>): Record<string, Responder> {
  return {
    quests: (calls) =>
      isCountQuery(calls)
        ? { data: null, count: 1, error: null }
        : { data: [SETTLED_QUEST], error: null },
    xp_rewards: () => ({ data: ledger, error: null }),
    plant_badges: () => ({
      data: OWNED_BADGES.map((key) => ({ badge_key: key })),
      error: null,
    }),
    bond_events: () => ({ data: null, error: null }),
  };
}

const FLAVOR_DAY = {
  id: "CARNAVAL_DAY",
  name: "Carnaval Day",
  description: "flavor only",
  emoji: "🎭",
  kind: "flavor",
};

function useSupabase(responders: Record<string, Responder>): RecordedCall[] {
  const log: RecordedCall[] = [];
  mocks.getServerSupabase.mockReturnValue(makeSupabase(responders, log));
  return log;
}

beforeEach(() => {
  mocks.awardXp.mockResolvedValue({
    duplicate: false,
    totalXp: 100,
    bondLevel: 2,
    leveledUp: false,
  });
  mocks.getBondState.mockResolvedValue({
    plant_id: PLANT,
    total_xp: 500,
    bond_level: 4,
    current_streak: 2,
    longest_streak: 7,
    current_chapter: CURRENT_CHAPTER,
  });
  mocks.evaluateQuests.mockResolvedValue(undefined);
  mocks.evaluateBadges.mockResolvedValue([]);
  mocks.evaluateChapters.mockResolvedValue([]);
  mocks.recordQualifyingCare.mockResolvedValue({
    currentStreak: 1,
    longestStreak: 1,
    qualifiedToday: true,
  });
  mocks.getDailyEvent.mockReturnValue(FLAVOR_DAY);
});

afterEach(() => vi.clearAllMocks());

describe("settleCompletions steady state (everything already settled)", () => {
  it("issues ZERO award_xp RPCs", async () => {
    useSupabase(steadyResponders(fullLedger()));

    await runGameTick(PLANT);

    expect(mocks.awardXp).not.toHaveBeenCalled();
  });

  it("pre-filters badge and chapter bonus keys through ONE xp_rewards read", async () => {
    const log = useSupabase(steadyResponders(fullLedger()));

    await runGameTick(PLANT);

    // Exactly one xp_rewards .in() carries the badge/chapter candidate keys
    // (the other pre-filter read is the quest-completion one).
    const bonusReads = log.filter(
      (call) =>
        call.table === "xp_rewards" &&
        call.method === "in" &&
        (call.args[1] as string[]).includes(badgeRewardKey(PLANT, "FIRST_RESCUE")),
    );
    expect(bonusReads).toHaveLength(1);
    const keys = bonusReads[0].args[1] as string[];
    for (const badge of OWNED_BADGES) {
      expect(keys).toContain(badgeRewardKey(PLANT, badge));
    }
    for (let chapter = 1; chapter <= CURRENT_CHAPTER; chapter += 1) {
      expect(keys).toContain(chapterRewardKey(PLANT, chapter));
    }
  });

  it("skips the second evaluateBadges/evaluateChapters pass when nothing landed", async () => {
    useSupabase(steadyResponders(fullLedger()));

    await runGameTick(PLANT);

    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(1);
  });
});

describe("settleCompletions when an award lands", () => {
  it("awards ONLY the missing badge bonus and re-runs both evaluators", async () => {
    // STREAK_7's bonus is missing from the ledger — the crash-healing case.
    const ledger = fullLedger().filter(
      (row) => row.reward_key !== badgeRewardKey(PLANT, "STREAK_7"),
    );
    useSupabase(steadyResponders(ledger));

    await runGameTick(PLANT);

    expect(mocks.awardXp).toHaveBeenCalledTimes(1);
    const [, plantId, rewardKey, amount, reason] = mocks.awardXp.mock.calls[0];
    expect(plantId).toBe(PLANT);
    expect(rewardKey).toBe(badgeRewardKey(PLANT, "STREAK_7"));
    expect(amount).toBe(15);
    expect(reason).toBe("badge:STREAK_7");

    // The landed badge bonus can raise bond_level → second pass must run.
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(2);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(2);
  });

  it("awards a missing chapter bonus with the exact ledger key", async () => {
    const ledger = fullLedger().filter(
      (row) => row.reward_key !== chapterRewardKey(PLANT, 2),
    );
    useSupabase(steadyResponders(ledger));

    await runGameTick(PLANT);

    expect(mocks.awardXp).toHaveBeenCalledTimes(1);
    const [, plantId, rewardKey, amount, reason] = mocks.awardXp.mock.calls[0];
    expect(plantId).toBe(PLANT);
    expect(rewardKey).toBe(chapterRewardKey(PLANT, 2));
    expect(amount).toBe(25);
    expect(reason).toBe("chapter:2");
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-run the evaluators when the RPC reports a duplicate (race lost)", async () => {
    const ledger = fullLedger().filter(
      (row) => row.reward_key !== badgeRewardKey(PLANT, "STREAK_7"),
    );
    useSupabase(steadyResponders(ledger));
    // Another settle won the race: the RPC dedupes server-side — nothing
    // actually landed, so the second pass has nothing new to see.
    mocks.awardXp.mockResolvedValue({
      duplicate: true,
      totalXp: 100,
      bondLevel: 2,
      leveledUp: false,
    });

    await runGameTick(PLANT);

    expect(mocks.awardXp).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(1);
  });

  it("re-runs the evaluators when quest XP lands", async () => {
    // A non-lucky unsettled quest: its base award is the only landing XP.
    const questId = Array.from({ length: 100 }, (_, i) => `plain-${i}`).find(
      (id) => !isLuckyQuest(id),
    );
    expect(questId).toBeDefined();
    if (!questId) return;

    const quest = { ...SETTLED_QUEST, id: questId };
    const ledger = fullLedger().filter(
      (row) => row.reward_key !== `quest:${SETTLED_QUEST.id}:completion`,
    );
    useSupabase({
      ...steadyResponders(ledger),
      quests: (calls) =>
        isCountQuery(calls)
          ? { data: null, count: 1, error: null }
          : { data: [quest], error: null },
    });

    await runGameTick(PLANT);

    const keys = mocks.awardXp.mock.calls.map((call) => call[2] as string);
    expect(keys).toContain(`quest:${questId}:completion`);
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(2);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(2);
  });

  it("re-runs the evaluators when a daily challenge pays out", async () => {
    // QUEST_FINISHER challenge day, satisfied (count 1), everything else
    // settled — the challenge XP is the only award this settle.
    mocks.getDailyEvent.mockReturnValue({
      id: "QUEST_FINISHER",
      name: "Little Panen Day",
      description: "complete any quest today",
      emoji: "🎯",
      kind: "daily_challenge",
      challengeXp: 10,
    });
    useSupabase(steadyResponders(fullLedger()));

    await runGameTick(PLANT);

    expect(mocks.awardXp).toHaveBeenCalledTimes(1);
    const [, plantId, rewardKey, amount, reason] = mocks.awardXp.mock.calls[0];
    expect(plantId).toBe(PLANT);
    expect(rewardKey).toBe(
      dailyChallengeRewardKey(PLANT, dayString(new Date()), "QUEST_FINISHER"),
    );
    expect(amount).toBe(10);
    expect(reason).toBe("daily:QUEST_FINISHER");
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(2);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(2);
  });
});
