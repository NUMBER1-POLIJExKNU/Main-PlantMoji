import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Pins the two Seed wiring sites. sweepSeedGrants' behavior is unit-tested
// in tests/seed-engine.test.ts; these assertions only guarantee the engine
// actually CALLS it (and that the quiz path grants on correct answers),
// so a future settle refactor cannot silently drop the seed economy.

const router = readFileSync(resolve(process.cwd(), "src/game/events/event-router.ts"), "utf8");
const quizRoute = readFileSync(resolve(process.cwd(), "src/app/api/daily-quiz/route.ts"), "utf8");

describe("seed grant wiring", () => {
  it("event-router runs the seed sweep as part of every settle", () => {
    expect(router).toContain('from "@/game/economy/seed-engine"');
    expect(router).toContain("await sweepSeedGrants(supabase, plantId);");
    // The sweep must run inside settleCompletions (shared by device events
    // AND game ticks), after companion evaluation.
    const companionIdx = router.indexOf("await evaluateCompanion(supabase, plantId);");
    const sweepIdx = router.indexOf("await sweepSeedGrants(supabase, plantId);");
    expect(companionIdx).toBeGreaterThan(-1);
    expect(sweepIdx).toBeGreaterThan(companionIdx);
  });

  it("daily-quiz route grants one Seed on a fresh correct answer only", () => {
    expect(quizRoute).toContain('from "@/game/economy/seed-engine"');
    expect(quizRoute).toContain('from "@/game/economy/seed-grants"');
    expect(quizRoute).toContain("SEED_GRANTS.quizCorrect");
    expect(quizRoute).toContain("seedQuizRewardKey(plantId, quizDate, round, questionKey)");
    // The grant must stay inside the same correct-and-not-duplicate gate the
    // badge/chapter evaluators already use.
    expect(quizRoute).toMatch(/data\?\.correct && !data\?\.duplicate[\s\S]{0,400}awardSeeds/);
  });
});
