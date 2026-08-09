// BUG B regression: STEADY_DAY ("+15 XP for staying out of problem moods")
// must not pay out for a plant that entered a problem mood BEFORE the
// 06:00-18:00 WIB window and simply had no further transitions inside it —
// that plant suffered all day, it didn't stay steady. settleDailyChallenge
// (event-router.ts) previously counted only in-window problem-mood
// TRANSITION events; it must also disqualify on the mood STATE in effect at
// window start (the latest PLANT_STATE_CHANGED at or before 06:00 WIB).
//
// Mocking style mirrors tests/settle-sweep.test.ts: side-effecting
// collaborators are mocked; getDailyEvent is forced to STEADY_DAY so the
// challenge branch under test always runs, and "now" is faked to a WIB
// instant after 18:00 so the window-closed gate passes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runGameTick } from "@/game/events/event-router";
import { dailyChallengeRewardKey } from "@/game/random/daily-events";
import { dayString } from "@/game/progression/streak-engine";

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

// ── Table-aware Supabase stub (same shape as tests/settle-sweep.test.ts) ──

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
  "lte",
  "order",
  "limit",
  "upsert",
  "maybeSingle",
];

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
const hasTypeFilter = (calls: RecordedCall[]) =>
  calls.some((c) => c.method === "eq" && c.args[0] === "type");
const isPriorStateLookup = (calls: RecordedCall[]) =>
  calls.some((c) => c.method === "lte");

const PLANT = "plant-01";

const STEADY_DAY_EVENT = {
  id: "STEADY_DAY",
  name: "Steady Hands",
  description: "flavor",
  emoji: "🧘",
  kind: "daily_challenge" as const,
  challengeXp: 15,
};

/** device_events responder: distinguishes the 3 queries settleDailyChallenge
 *  issues for STEADY_DAY by inspecting the recorded call chain — same
 *  technique isCountQuery already uses. */
function deviceEventsResponder(opts: {
  anyCount: number;
  problemWindowCount: number;
  /** Latest PLANT_STATE_CHANGED at or before window start, or null if none. */
  moodAtWindowStart: string | null;
}): Responder {
  return (calls) => {
    if (!hasTypeFilter(calls)) {
      return { data: null, count: opts.anyCount, error: null };
    }
    if (isPriorStateLookup(calls)) {
      return {
        data: opts.moodAtWindowStart ? { data: { currentState: opts.moodAtWindowStart } } : null,
        error: null,
      };
    }
    // In-window problem-transition count query.
    return { data: null, count: opts.problemWindowCount, error: null };
  };
}

function steadyResponders(deviceEvents: Responder): Record<string, Responder> {
  return {
    quests: (calls) =>
      isCountQuery(calls) ? { data: null, count: 0, error: null } : { data: [], error: null },
    xp_rewards: () => ({ data: [], error: null }),
    plant_badges: () => ({ data: [], error: null }),
    bond_events: () => ({ data: null, error: null }),
    device_events: deviceEvents,
  };
}

function useSupabase(responders: Record<string, Responder>): RecordedCall[] {
  const log: RecordedCall[] = [];
  mocks.getServerSupabase.mockReturnValue(makeSupabase(responders, log));
  return log;
}

// 2026-08-09T19:00:00+07:00 = 12:00:00Z — well after the 18:00 WIB window
// close, so the "window fully over" gate passes.
const AFTER_WINDOW_CLOSE_WIB = new Date("2026-08-09T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AFTER_WINDOW_CLOSE_WIB);
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
    current_chapter: 0,
  });
  mocks.evaluateQuests.mockResolvedValue(undefined);
  mocks.evaluateBadges.mockResolvedValue([]);
  mocks.evaluateChapters.mockResolvedValue([]);
  mocks.recordQualifyingCare.mockResolvedValue({
    currentStreak: 1,
    longestStreak: 1,
    qualifiedToday: true,
  });
  mocks.getDailyEvent.mockReturnValue(STEADY_DAY_EVENT);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("STEADY_DAY qualifies on mood STATE, not just in-window transitions", () => {
  it("does NOT pay out when the plant entered a problem mood before the window and never transitioned back (05:00 Overheating entry, no further transitions)", async () => {
    useSupabase(
      steadyResponders(
        deviceEventsResponder({
          anyCount: 1,
          problemWindowCount: 0, // no transitions INSIDE 06:00-18:00 — the old check alone would pass
          moodAtWindowStart: "Overheating", // entered at 05:00, still in effect at 06:00
        }),
      ),
    );

    await runGameTick(PLANT);

    const steadyAwards = mocks.awardXp.mock.calls.filter(
      (call) => call[2] === dailyChallengeRewardKey(PLANT, dayString(new Date()), "STEADY_DAY"),
    );
    expect(steadyAwards).toHaveLength(0);
  });

  it("pays out when the plant was genuinely Happy at window start and stayed problem-free all day", async () => {
    useSupabase(
      steadyResponders(
        deviceEventsResponder({
          anyCount: 1,
          problemWindowCount: 0,
          moodAtWindowStart: "Happy",
        }),
      ),
    );

    await runGameTick(PLANT);

    const steadyAwards = mocks.awardXp.mock.calls.filter(
      (call) => call[2] === dailyChallengeRewardKey(PLANT, dayString(new Date()), "STEADY_DAY"),
    );
    expect(steadyAwards).toHaveLength(1);
    expect(steadyAwards[0][3]).toBe(15);
  });

  it("pays out when no PLANT_STATE_CHANGED event has ever landed before the window (no evidence of a problem, no claim either way — defaults to eligible)", async () => {
    useSupabase(
      steadyResponders(
        deviceEventsResponder({
          anyCount: 1,
          problemWindowCount: 0,
          moodAtWindowStart: null,
        }),
      ),
    );

    await runGameTick(PLANT);

    const steadyAwards = mocks.awardXp.mock.calls.filter(
      (call) => call[2] === dailyChallengeRewardKey(PLANT, dayString(new Date()), "STEADY_DAY"),
    );
    expect(steadyAwards).toHaveLength(1);
  });

  it("still disqualifies on an in-window problem transition even when the pre-window mood was Happy", async () => {
    useSupabase(
      steadyResponders(
        deviceEventsResponder({
          anyCount: 1,
          problemWindowCount: 1,
          moodAtWindowStart: "Happy",
        }),
      ),
    );

    await runGameTick(PLANT);

    const steadyAwards = mocks.awardXp.mock.calls.filter(
      (call) => call[2] === dailyChallengeRewardKey(PLANT, dayString(new Date()), "STEADY_DAY"),
    );
    expect(steadyAwards).toHaveLength(0);
  });
});
