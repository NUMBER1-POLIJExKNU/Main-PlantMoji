// Pure tests for the story chapter dialogue (handoff §19, §46.4).
// No DB access — scenes are static, deterministic TypeScript content.

import { describe, expect, it } from "vitest";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { getChapterScene } from "@/game/story/story-dialogue";
import { PERSONALITIES } from "@/types/game";

const STORY_CHAPTERS = CHAPTER_DEFINITIONS.map((def) => def.chapter);
const NAME = "Jin";

describe("getChapterScene", () => {
  it("covers exactly chapters 1–6 (every defined chapter has a scene)", () => {
    expect(STORY_CHAPTERS).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("returns a 4–6 line scene with non-empty lines for every chapter × personality", () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const personality of PERSONALITIES) {
        const scene = getChapterScene(chapter, personality, NAME);
        expect(scene).not.toBeNull();
        expect(scene!.chapter).toBe(chapter);
        expect(scene!.lines.length).toBeGreaterThanOrEqual(4);
        expect(scene!.lines.length).toBeLessThanOrEqual(6);
        for (const line of scene!.lines) {
          expect(["narrator", "plant"]).toContain(line.speaker);
          expect(line.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("includes both narrator and plant lines in every scene", () => {
    for (const chapter of STORY_CHAPTERS) {
      const scene = getChapterScene(chapter, "cute", NAME)!;
      const speakers = new Set(scene.lines.map((line) => line.speaker));
      expect(speakers.has("narrator")).toBe(true);
      expect(speakers.has("plant")).toBe(true);
    }
  });

  it("varies at least one plant line between two personalities in every chapter", () => {
    for (const chapter of STORY_CHAPTERS) {
      const plantScripts = PERSONALITIES.map((personality) =>
        getChapterScene(chapter, personality, NAME)!
          .lines.filter((line) => line.speaker === "plant")
          .map((line) => line.text)
          .join("\n"),
      );
      expect(new Set(plantScripts).size).toBeGreaterThan(1);
    }
  });

  it("keeps narrator lines identical across personalities (shared narration)", () => {
    for (const chapter of STORY_CHAPTERS) {
      const narrations = PERSONALITIES.map((personality) =>
        getChapterScene(chapter, personality, NAME)!
          .lines.filter((line) => line.speaker === "narrator")
          .map((line) => line.text)
          .join("\n"),
      );
      expect(new Set(narrations).size).toBe(1);
    }
  });

  it("uses the plant's name in chapter 1 for every personality", () => {
    for (const personality of PERSONALITIES) {
      const scene = getChapterScene(1, personality, NAME)!;
      const fullText = scene.lines.map((line) => line.text).join("\n");
      expect(fullText).toContain(NAME);
    }
  });

  it("returns null for chapters without narrative content (0 and 7)", () => {
    expect(getChapterScene(0, "cute", NAME)).toBeNull();
    expect(getChapterScene(7, "cute", NAME)).toBeNull();
  });

  it("echoes the mission line in chapter 6 through every plant voice", () => {
    // Handoff §2: “Preserve the wisdom. Measure the environment. Grow the
    // next generation.” — each personality carries it in its own words.
    for (const personality of PERSONALITIES) {
      const plantText = getChapterScene(6, personality, NAME)!
        .lines.filter((line) => line.speaker === "plant")
        .map((line) => line.text)
        .join("\n")
        .toLowerCase();
      expect(plantText).toContain("wisdom");
      expect(plantText).toContain("measure");
      expect(plantText).toContain("grow");
    }
  });

  it("is deterministic — same input yields the same scene", () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const personality of PERSONALITIES) {
        expect(getChapterScene(chapter, personality, NAME)).toEqual(
          getChapterScene(chapter, personality, NAME),
        );
      }
    }
  });

  it("keeps every line short enough for a card (under ~100 chars with a short name)", () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const personality of PERSONALITIES) {
        for (const line of getChapterScene(chapter, personality, NAME)!.lines) {
          expect(line.text.length).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("falls back gracefully when the name is blank", () => {
    const scene = getChapterScene(1, "calm", "   ")!;
    for (const line of scene.lines) {
      expect(line.text.trim().length).toBeGreaterThan(0);
    }
    // The naming beat still reads as a name, never as an empty string.
    expect(scene.lines.map((line) => line.text).join("\n")).toContain("Sprout");
  });
});
