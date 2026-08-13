import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/collection-unlocked/route.ts"),
  "utf8",
);

describe("collection-unlocked mobile progress contract", () => {
  it("reads and returns level, total XP, and current streak together", () => {
    expect(route).toContain(
      '.select("bond_level, total_xp, current_streak, current_chapter")',
    );
    expect(route).toContain("totalXp");
    expect(route).toContain("currentStreak");
  });
});
