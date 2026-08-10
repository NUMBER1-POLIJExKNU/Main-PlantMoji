import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Jamkachu's farm speech bubble is tiny; Gemini once filled it with a
// 300-character monologue ("…officially throwing a chalk party at the
// roots…"). src/lib/ai.ts imports "server-only", so this contract is pinned
// read-the-source style: bubble-bound event kinds must carry a hard short
// cap, and an overlong reply must be rejected (null → deterministic
// template) rather than displayed.
const source = readFileSync(resolve(process.cwd(), "src/lib/ai.ts"), "utf8");

describe("AI speech-bubble length contract", () => {
  it("defines a short hard cap well below the 2-sentence cap", () => {
    const bubble = source.match(/MAX_BUBBLE_CHARS = (\d+)/);
    const general = source.match(/MAX_MESSAGE_CHARS = (\d+)/);
    expect(bubble).not.toBeNull();
    expect(general).not.toBeNull();
    expect(Number(bubble![1])).toBeLessThanOrEqual(160);
    expect(Number(bubble![1])).toBeLessThan(Number(general![1]));
  });

  it("classifies every bubble-rendered event kind as short-form", () => {
    const setBlock = source.match(/BUBBLE_KINDS[\s\S]*?\]\)/);
    expect(setBlock).not.toBeNull();
    for (const kind of ["MOOD", "QUEST_CREATED", "QUEST_COMPLETED", "LEVEL_UP", "BADGE_UNLOCKED", "CHAPTER_UNLOCKED"]) {
      expect(setBlock![0]).toContain(`"${kind}"`);
    }
  });

  it("rejects overlong replies per kind instead of using one blanket cap", () => {
    expect(source).toMatch(/BUBBLE_KINDS\.has\(input\.kind\) \? MAX_BUBBLE_CHARS : MAX_MESSAGE_CHARS/);
    expect(source).toMatch(/text\.length > maxChars\) return null/);
  });

  it("asks the model for one short sentence for bubble kinds", () => {
    expect(source).toContain("ONE short in-character sentence");
    expect(source).toMatch(/MAX_BUBBLE_TOKENS/);
  });
});
