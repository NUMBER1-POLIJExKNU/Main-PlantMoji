// Story chapter definitions — Phase 12 (handoff §19).
// Static content lives in TypeScript during MVP (handoff §26); progress is
// the `current_chapter` column on `bond_state`.

import type { ChapterDefinition } from "@/types/game";

// ── i18n (last i18n gap — narrative content, additive-only) ─────────────
// `titleId`/`descriptionId` are the Indonesian variants, added alongside the
// existing English fields without touching their values or the imported
// ChapterDefinition shape (src/types/game.ts stays untouched). Consumers
// (see file:line list below) still read `.title`/`.description` and keep
// compiling unchanged; wiring the id fields into the UI is a later pass:
//   - src/app/collection/page.tsx:141-142 (StoryCollectionItem.title/description)
//   - src/app/settings/page.tsx:138 (count only, no text — no wiring needed)
//   - src/game/story/story-engine.ts:159 (chapterTitle() — English only)
//   - src/components/story-chapter-card.tsx:31,35,50,75 (chapter.title/description)
//   - src/game/demo/demo-max.ts:89,135 (chapter.title/description in demo events)
//
// `titleId` values are copied VERBATIM from public/farm/strings.js
// `chapterTitles` (id) — that file is the pinned source of truth for chapter
// titles; keep both sides in sync if either changes.
export interface LocalizedChapterDefinition extends ChapterDefinition {
  /** Indonesian title — verbatim from public/farm/strings.js chapterTitles (id). */
  titleId: string;
  /** Indonesian description/unlock-condition text. */
  descriptionId: string;
}

/** Chapters in unlock order. `chapter` numbers are 1-based and contiguous. */
// The story is set where the plant physically lives: Jember, East Java —
// coffee-and-tobacco country between Mount Argopuro and Mount Raung.
// Descriptions double as unlock-condition text for locked chapters, so each
// keeps its condition sentence intact after the flavor clause.
export const CHAPTER_DEFINITIONS: LocalizedChapterDefinition[] = [
  {
    chapter: 1,
    title: "First Meeting in Jember",
    description:
      "Your plant arrives on a windowsill in Jember, in coffee-and-tobacco country — unlocked at registration / first launch.",
    titleId: "Pertemuan Pertama di Jember",
    descriptionId:
      "Tanamanmu tiba di ambang jendela di Jember, negeri kopi dan tembakau — terbuka sejak kamu mendaftar / pertama kali membuka aplikasi.",
  },
  {
    chapter: 2,
    title: "Roots in Volcanic Soil",
    description:
      "First lessons in rich volcanic earth. Unlocked when your first quest is completed.",
    titleId: "Berakar di Tanah Vulkanik",
    descriptionId:
      "Pelajaran pertama di tanah vulkanik yang subur. Terbuka setelah misi pertamamu selesai.",
  },
  {
    chapter: 3,
    title: "Trust, Rain or Shine",
    description:
      "Steady care through sun and rain. Unlocked at Bond Level 3 with a 3-day care streak.",
    titleId: "Saling Percaya, Hujan maupun Cerah",
    descriptionId:
      "Perawatan yang konsisten, hujan maupun cerah. Terbuka di Level Ikatan 3 dengan 3 hari beruntun merawat tanaman.",
  },
  {
    chapter: 4,
    title: "Through Heat and Gray Skies",
    description:
      "Weathering dry-season heat and gloomy days together. Unlocked at Bond Level 5 with 10 quests completed, including at least one recovery quest.",
    titleId: "Melewati Panas dan Langit Kelabu",
    descriptionId:
      "Melewati panasnya musim kemarau dan hari-hari mendung bersama-sama. Terbuka di Level Ikatan 5 dengan 10 misi selesai, termasuk minimal satu misi pemulihan.",
  },
  {
    chapter: 5,
    title: "Full Bloom, Carnival Bright",
    description:
      "Every mood discovered as carnival month colors Jember. Unlocked at Bond Level 7 with all six moods discovered and 15 quests completed.",
    titleId: "Mekar Penuh Semeriah Karnaval",
    descriptionId:
      "Semua suasana ditemukan saat bulan karnaval mewarnai Jember. Terbuka di Level Ikatan 7 dengan keenam suasana ditemukan dan 15 misi selesai.",
  },
  {
    chapter: 6,
    title: "Harvest of Wisdom",
    description:
      "What you learned together becomes wisdom for the next grower. Unlocked at Bond Level 10 with 30 quests completed and 5 growth records logged.",
    titleId: "Panen Kebijaksanaan",
    descriptionId:
      "Apa yang kalian pelajari bersama menjadi kebijaksanaan untuk penanam berikutnya. Terbuka di Level Ikatan 10 dengan 30 misi selesai dan 5 catatan pertumbuhan dicatat.",
  },
];

/** Title lookup with a safe fallback for out-of-range chapter numbers. */
export function chapterTitle(chapter: number): string {
  return (
    CHAPTER_DEFINITIONS.find((def) => def.chapter === chapter)?.title ??
    `Chapter ${chapter}`
  );
}
