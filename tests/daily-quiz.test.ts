import { describe, expect, it } from "vitest";
import { dailyQuiz, quizByKey, QUIZ_QUESTION_COUNT, wibDate } from "@/game/quiz/daily-quiz";

describe("daily quiz", () => {
  it("ships at least 60 deterministic localized questions", () => {
    expect(QUIZ_QUESTION_COUNT).toBeGreaterThanOrEqual(60);
    const first = dailyQuiz("plant-01", "en", "2026-08-09");
    expect(dailyQuiz("plant-01", "en", "2026-08-09")).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((q) => q.category)).size).toBe(3);
  });

  it("keeps the answer invariant while rotating choices", () => {
    for (const suffix of ["v1", "v2", "v3"]) {
      const question = quizByKey(`photosynthesis-${suffix}`, "en");
      expect(question).not.toBeNull();
      expect(question?.choices[question.correctIndex]).toBe("To make sugars through photosynthesis");
    }
  });

  it("localizes fixed truth without changing the answer", () => {
    const en = dailyQuiz("plant-01", "en", "2026-08-10");
    const id = dailyQuiz("plant-01", "id", "2026-08-10");
    expect(id.map((q) => q.key)).toEqual(en.map((q) => q.key));
    expect(id[0].question).not.toBe(en[0].question);
    expect(id[0].correctIndex).toBe(en[0].correctIndex);
  });

  it("uses the Jember calendar date", () => {
    expect(wibDate(new Date("2026-08-09T16:59:59Z"))).toBe("2026-08-09");
    expect(wibDate(new Date("2026-08-09T17:00:00Z"))).toBe("2026-08-10");
  });
});
