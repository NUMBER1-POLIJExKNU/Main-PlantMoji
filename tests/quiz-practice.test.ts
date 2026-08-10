import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  evaluateBadges: vi.fn(async () => null),
  evaluateChapters: vi.fn(async () => null),
  awardSeeds: vi.fn(async () => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/game/badges/badge-engine", () => ({ evaluateBadges: mocks.evaluateBadges }));
vi.mock("@/game/story/story-engine", () => ({ evaluateChapters: mocks.evaluateChapters }));
vi.mock("@/game/economy/seed-engine", () => ({ awardSeeds: mocks.awardSeeds }));

import { POST } from "@/app/api/daily-quiz/route";
import { dailyQuiz, quizHint, wibDate } from "@/game/quiz/daily-quiz";
import { SEED_GRANTS, seedQuizRewardKey } from "@/game/economy/seed-grants";

// POST /api/daily-quiz practice gating (economy exploit fix). Round 0 is the
// only paying round: it goes through the answer_daily_quiz RPC and, on a fresh
// correct answer, the badge/chapter/seed evaluators. Rounds >= 1 are practice:
// correctness is computed in the route, the RPC is never invoked, and XP,
// Seeds, badges, and chapters are all untouched.

/** Today's deterministic question set for a given round's seed. */
function questionFor(round: number) {
  return dailyQuiz("plant-01", "en", `${wibDate()}:round:${round}`)[0];
}

function makeSupabase(rpcData: Record<string, unknown> = { correct: true, duplicate: false, xp_awarded: 6, attempts: 1, completed: true }) {
  return { rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: rpcData, error: null })) };
}

function request(body: unknown) {
  return new Request("http://localhost/api/daily-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Stub = ReturnType<typeof makeSupabase>;
function installSupabase(stub: Stub): Stub {
  mocks.getServerSupabase.mockReturnValue(stub);
  return stub;
}

describe("POST /api/daily-quiz practice rounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
  });

  it("round 2 correct: practice payload with zero XP, and the RPC + reward engines are never touched", async () => {
    const supabase = installSupabase(makeSupabase());
    const q = questionFor(2);
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: q.correctIndex, locale: "en", round: 2 }));
    expect(response.status).toBe(200);
    // toEqual is exact: any leaked RPC field (leveled_up, duplicate, ...) fails here.
    expect(await response.json()).toEqual({
      ok: true,
      practice: true,
      correct: true,
      xp_awarded: 0,
      explanation: q.explanation,
      hint: quizHint(q.category, "en"),
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mocks.awardSeeds).not.toHaveBeenCalled();
    expect(mocks.evaluateBadges).not.toHaveBeenCalled();
    expect(mocks.evaluateChapters).not.toHaveBeenCalled();
  });

  it("round 2 wrong: reveals the answer immediately through the client's completed+correctIndex path, still zero XP", async () => {
    const supabase = installSupabase(makeSupabase());
    const q = questionFor(2);
    const wrongIndex = (q.correctIndex + 1) % 3;
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: wrongIndex, locale: "en", round: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      practice: true,
      correct: false,
      xp_awarded: 0,
      attempts: 2,
      completed: true,
      correctIndex: q.correctIndex,
      correctAnswer: q.choices[q.correctIndex],
      explanation: q.explanation,
      hint: quizHint(q.category, "en"),
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mocks.awardSeeds).not.toHaveBeenCalled();
    expect(mocks.evaluateBadges).not.toHaveBeenCalled();
    expect(mocks.evaluateChapters).not.toHaveBeenCalled();
  });

  it("practice answers even when Supabase is not configured (no DB dependency for pure learning)", async () => {
    mocks.getServerSupabase.mockReturnValue(null);
    const q = questionFor(1);
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: q.correctIndex, locale: "en", round: 1 }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.practice).toBe(true);
    expect(data.xp_awarded).toBe(0);
  });

  it("round 0 fresh correct answer: the RPC runs and the badge/chapter/seed path fires exactly once", async () => {
    const supabase = installSupabase(makeSupabase({ correct: true, duplicate: false, xp_awarded: 6, attempts: 1, completed: true }));
    const q = questionFor(0);
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: q.correctIndex, locale: "en", round: 0 }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.practice).toBeUndefined();
    expect(data.xp_awarded).toBe(6);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("answer_daily_quiz", {
      p_plant_id: "plant-01",
      p_quiz_date: wibDate(),
      p_round_no: 0,
      p_question_key: q.key,
      p_answer_index: q.correctIndex,
      p_correct: true,
    });
    expect(mocks.evaluateBadges).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateChapters).toHaveBeenCalledTimes(1);
    expect(mocks.awardSeeds).toHaveBeenCalledTimes(1);
    expect(mocks.awardSeeds).toHaveBeenCalledWith(
      supabase,
      "plant-01",
      seedQuizRewardKey("plant-01", wibDate(), 0, q.key),
      SEED_GRANTS.quizCorrect,
      "quiz-correct",
    );
  });

  it("clamps round 10000 down to 9999 and treats it as practice (no RPC)", async () => {
    const supabase = installSupabase(makeSupabase());
    const q = questionFor(9999); // question only resolves if the route really clamped to 9999
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: q.correctIndex, locale: "en", round: 10000 }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.practice).toBe(true);
    expect(data.xp_awarded).toBe(0);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mocks.awardSeeds).not.toHaveBeenCalled();
  });

  it("clamps a negative round up to 0, which stays on the paying RPC path", async () => {
    const supabase = installSupabase(makeSupabase());
    const q = questionFor(0); // question only resolves if the route really clamped to 0
    const response = await POST(request({ plantId: "plant-01", questionKey: q.key, answerIndex: q.correctIndex, locale: "en", round: -5 }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.practice).toBeUndefined();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({ p_round_no: 0 });
  });
});
