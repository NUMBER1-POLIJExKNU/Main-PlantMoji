// Story chapter card (handoff §19, §46.4 — attachment, not guilt).
//
// Purely presentational — the parent resolves unlock state (from
// bond_state.current_chapter) and the personality-voiced scene (from
// getChapterScene), and passes both down. No hooks; safe to render from
// either a server or client component. Styling mirrors the home-screen
// cards (see home-quest-card.tsx).

import type { ChapterDefinition } from "@/types/game";
import type { ChapterScene } from "@/game/story/story-dialogue";

export interface StoryChapterCardProps {
  chapter: ChapterDefinition;
  unlocked: boolean;
  /** Voiced scene for this chapter, or null when locked / no content. */
  scene: ChapterScene | null;
}

export default function StoryChapterCard({ chapter, unlocked, scene }: StoryChapterCardProps) {
  if (!unlocked) {
    return (
      <article className="w-full max-w-sm rounded-2xl bg-white/40 p-5 shadow-sm backdrop-blur dark:bg-zinc-900/30">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-600">
            CHAPTER {chapter.chapter}
          </span>
          <span className="text-sm" role="img" aria-label="Locked">
            🔒
          </span>
        </div>
        <p className="mt-1 font-semibold text-zinc-400 dark:text-zinc-500">{chapter.title}</p>
        <p className="mt-3 text-center text-lg font-semibold tracking-[0.4em] text-zinc-300 dark:text-zinc-700">
          ???
        </p>
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">{chapter.description}</p>
      </article>
    );
  }

  return (
    <article className="w-full max-w-sm rounded-2xl bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-zinc-900/60">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500">
          CHAPTER {chapter.chapter}
        </span>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/60 dark:text-green-200">
          Unlocked
        </span>
      </div>
      <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{chapter.title}</p>

      {scene ? (
        <div className="mt-3 space-y-2.5">
          {scene.lines.map((line, index) =>
            line.speaker === "narrator" ? (
              <p
                key={index}
                className="text-xs italic leading-relaxed text-zinc-500 dark:text-zinc-400"
              >
                {line.text}
              </p>
            ) : (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-1 text-base" role="img" aria-hidden="true">
                  🌱
                </span>
                <p className="rounded-2xl rounded-tl-sm bg-green-100/80 px-3 py-2 text-sm leading-relaxed text-green-900 dark:bg-green-900/50 dark:text-green-100">
                  {line.text}
                </p>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{chapter.description}</p>
      )}
    </article>
  );
}
