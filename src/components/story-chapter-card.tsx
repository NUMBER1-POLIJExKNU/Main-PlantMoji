// Story chapter card (handoff §19, §46.4 — attachment, not guilt).
//
// Purely presentational — the parent resolves unlock state (from
// bond_state.current_chapter) and the personality-voiced scene (from
// getChapterScene), and passes both down. No hooks; safe to render from
// either a server or client component. Styling mirrors the home-screen
// cards (see home-quest-card.tsx).

import type { ChapterDefinition } from "@/types/game";
import type { ChapterScene } from "@/game/story/story-dialogue";
import type { AppLocale } from "@/lib/i18n";

export interface StoryChapterCardProps {
  chapter: ChapterDefinition;
  unlocked: boolean;
  /** Voiced scene for this chapter, or null when locked / no content. */
  scene: ChapterScene | null;
  /** Locale for this card's own chrome copy (chapter word, lock label,
   *  unlocked pill). Everything else on `chapter`/`scene` arrives already
   *  localized from the collection page, but this component owns a few
   *  small strings directly — same duplicated-inline-copy mechanism as
   *  collection-tabs.tsx's `copy` map (its parent), since neither can read
   *  the farm string table at build time. */
  locale: AppLocale;
}

// Mirrors collection-tabs.tsx's `copy.unlocked` / `copy.locked` and the
// "Bab {n}" convention from public/farm/strings.js's chapter-gate label.
const COPY: Record<AppLocale, { chapterWord: string; unlocked: string; locked: string }> = {
  id: { chapterWord: "BAB", unlocked: "Terbuka", locked: "Terkunci" },
  en: { chapterWord: "CHAPTER", unlocked: "Unlocked", locked: "Locked" },
};

const CHAPTER_ART = ["", "🪟", "🌋", "🌦️", "☀️", "🎭", "🌾"] as const;

export default function StoryChapterCard({ chapter, unlocked, scene, locale }: StoryChapterCardProps) {
  const copy = COPY[locale];

  if (!unlocked) {
    return (
      <article className="pm-story-stage is-locked">
        <header className="pm-story-stage-head"><span>{copy.chapterWord} {chapter.chapter}</span><b>🔒 {copy.locked}</b></header>
        <div className={`pm-story-scene-art chapter-${chapter.chapter}`}><span aria-hidden="true">{CHAPTER_ART[chapter.chapter] ?? "🌱"}</span><i aria-hidden="true">🔒</i></div>
        <div className="pm-story-stage-copy"><h3>{chapter.title}</h3><p className="pm-story-unlock-label">{locale === "id" ? "SYARAT MEMBUKA" : "UNLOCK QUEST"}</p><p>{chapter.description}</p></div>
      </article>
    );
  }

  return (
    <article className="pm-story-stage is-unlocked">
      <header className="pm-story-stage-head"><span>{copy.chapterWord} {chapter.chapter}</span><b>✓ {copy.unlocked}</b></header>
      <div className={`pm-story-scene-art chapter-${chapter.chapter}`}><span aria-hidden="true">{CHAPTER_ART[chapter.chapter] ?? "🌱"}</span><i aria-hidden="true">🌱</i></div>
      <div className="pm-story-stage-copy"><h3>{chapter.title}</h3>

      {scene ? (
        <div className="pm-story-dialogue">
          {scene.lines.map((line, index) =>
            line.speaker === "narrator" ? (
              <p key={index} className="pm-story-narrator">◆ {line.text}</p>
            ) : (
              <div key={index} className="pm-story-plant-line">
                <span role="img" aria-hidden="true">🌱</span><p>{line.text}</p>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="pm-story-narrator">{chapter.description}</p>
      )}
      </div>
    </article>
  );
}
