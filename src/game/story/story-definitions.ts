// Story chapter definitions — Phase 12 (handoff §19).
// Static content lives in TypeScript during MVP (handoff §26); progress is
// the `current_chapter` column on `bond_state`.

import type { ChapterDefinition } from "@/types/game";

/** Chapters in unlock order. `chapter` numbers are 1-based and contiguous. */
// The story is set where the plant physically lives: Jember, East Java —
// coffee-and-tobacco country between Mount Argopuro and Mount Raung.
// Descriptions double as unlock-condition text for locked chapters, so each
// keeps its condition sentence intact after the flavor clause.
export const CHAPTER_DEFINITIONS: ChapterDefinition[] = [
  {
    chapter: 1,
    title: "First Meeting in Jember",
    description:
      "Your plant arrives on a windowsill in Jember, in coffee-and-tobacco country — unlocked at registration / first launch.",
  },
  {
    chapter: 2,
    title: "Roots in Volcanic Soil",
    description:
      "First lessons in rich volcanic earth. Unlocked when your first quest is completed.",
  },
  {
    chapter: 3,
    title: "Trust, Rain or Shine",
    description:
      "Steady care through sun and rain. Unlocked at Bond Level 3 with a 3-day care streak.",
  },
  {
    chapter: 4,
    title: "Through Heat and Gray Skies",
    description:
      "Weathering dry-season heat and gloomy days together. Unlocked at Bond Level 5 with 10 quests completed, including at least one recovery quest.",
  },
  {
    chapter: 5,
    title: "Full Bloom, Carnival Bright",
    description:
      "Every mood discovered as carnival month colors Jember. Unlocked at Bond Level 7 with all six moods discovered and 15 quests completed.",
  },
  {
    chapter: 6,
    title: "Harvest of Wisdom",
    description:
      "What you learned together becomes wisdom for the next grower. Unlocked at Bond Level 10 with 30 quests completed and 5 growth records logged.",
  },
];

/** Title lookup with a safe fallback for out-of-range chapter numbers. */
export function chapterTitle(chapter: number): string {
  return (
    CHAPTER_DEFINITIONS.find((def) => def.chapter === chapter)?.title ??
    `Chapter ${chapter}`
  );
}
