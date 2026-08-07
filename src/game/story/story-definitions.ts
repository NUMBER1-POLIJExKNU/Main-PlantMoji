// Story chapter definitions — Phase 12 (handoff §19).
// Static content lives in TypeScript during MVP (handoff §26); progress is
// the `current_chapter` column on `bond_state`.

import type { ChapterDefinition } from "@/types/game";

/** Chapters in unlock order. `chapter` numbers are 1-based and contiguous. */
export const CHAPTER_DEFINITIONS: ChapterDefinition[] = [
  {
    chapter: 1,
    title: "First Meeting",
    description: "Your plant has arrived — unlocked at registration / first launch.",
  },
  {
    chapter: 2,
    title: "Learning to Grow",
    description: "Unlocked when your first quest is completed.",
  },
  {
    chapter: 3,
    title: "Trust",
    description: "Unlocked at Bond Level 3 with a 3-day care streak.",
  },
  {
    chapter: 4,
    title: "Stronger Together",
    description:
      "Unlocked at Bond Level 5 with 10 quests completed, including at least one recovery quest.",
  },
  {
    chapter: 5,
    title: "Full Bloom",
    description:
      "Unlocked at Bond Level 7 with all six moods discovered and 15 quests completed.",
  },
  {
    chapter: 6,
    title: "Harvest of Wisdom",
    description:
      "Unlocked at Bond Level 10 with 30 quests completed and 5 growth records logged.",
  },
];

/** Title lookup with a safe fallback for out-of-range chapter numbers. */
export function chapterTitle(chapter: number): string {
  return (
    CHAPTER_DEFINITIONS.find((def) => def.chapter === chapter)?.title ??
    `Chapter ${chapter}`
  );
}
