"use client";

// Collection book tabs (handoff §20, §33 — Mood / Badges / Story).
// Purely presentational: the server page queries everything and passes plain
// serializable props across the RSC boundary (dates preformatted as strings).

import { useState } from "react";

export interface MoodCollectionItem {
  mood: string;
  label: string;
  emoji: string;
  discovered: boolean;
}

export interface BadgeCollectionItem {
  key: string;
  name: string;
  description: string;
  emoji: string;
  /** Preformatted unlock date, or null while still locked. */
  unlockedLabel: string | null;
}

export interface StoryCollectionItem {
  chapter: number;
  title: string;
  /** Doubles as the unlock condition for locked chapters (handoff §19). */
  description: string;
  unlocked: boolean;
}

export interface CollectionTabsProps {
  moods: MoodCollectionItem[];
  badges: BadgeCollectionItem[];
  chapters: StoryCollectionItem[];
}

const TABS = [
  { id: "moods", label: "Moods", emoji: "🎭" },
  { id: "badges", label: "Badges", emoji: "🏅" },
  { id: "story", label: "Story", emoji: "📜" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CollectionTabs({ moods, badges, chapters }: CollectionTabsProps) {
  const [tab, setTab] = useState<TabId>("moods");

  const discoveredMoods = moods.filter((mood) => mood.discovered).length;
  const unlockedBadges = badges.filter((badge) => badge.unlockedLabel !== null).length;
  const unlockedChapters = chapters.filter((chapter) => chapter.unlocked).length;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Collection sections"
        className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {TABS.map((entry) => {
          const active = entry.id === tab;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`collection-panel-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span className="mr-1" role="img" aria-hidden="true">
                {entry.emoji}
              </span>
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === "moods" && (
        <section id="collection-panel-moods" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {discoveredMoods} of {moods.length} moods discovered
          </p>
          <ul className="grid grid-cols-3 gap-3">
            {moods.map((mood) => (
              <li
                key={mood.mood}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-4 text-center ${
                  mood.discovered
                    ? "border-green-200/70 bg-green-50/70 dark:border-green-900/60 dark:bg-green-950/40"
                    : "border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <span
                  className={`text-3xl leading-none ${mood.discovered ? "" : "opacity-40 grayscale"}`}
                  role="img"
                  aria-label={mood.label}
                >
                  {mood.emoji}
                </span>
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    mood.discovered
                      ? "text-zinc-800 dark:text-zinc-100"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {mood.label}
                </span>
                <span
                  className={`text-xs font-bold ${
                    mood.discovered
                      ? "text-green-600 dark:text-green-400"
                      : "text-zinc-300 dark:text-zinc-600"
                  }`}
                  aria-label={mood.discovered ? "Discovered" : "Not discovered yet"}
                >
                  {mood.discovered ? "✓" : "?"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "badges" && (
        <section id="collection-panel-badges" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {unlockedBadges} of {badges.length} badges unlocked
          </p>
          <ul className="flex flex-col gap-3">
            {badges.map((badge) => {
              const unlocked = badge.unlockedLabel !== null;
              return (
                <li
                  key={badge.key}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    unlocked
                      ? "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30"
                      : "border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <span
                    className={`text-3xl leading-none ${unlocked ? "" : "opacity-40 grayscale"}`}
                    role="img"
                    aria-hidden="true"
                  >
                    {badge.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-sm font-bold ${
                          unlocked
                            ? "text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {badge.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          unlocked
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                        }`}
                      >
                        {unlocked ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {badge.description}
                    </p>
                    {badge.unlockedLabel && (
                      <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Unlocked {badge.unlockedLabel}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === "story" && (
        <section id="collection-panel-story" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {unlockedChapters} of {chapters.length} chapters unlocked
          </p>
          <ol className="flex flex-col gap-3">
            {chapters.map((chapter) => (
              <li
                key={chapter.chapter}
                className={`rounded-2xl border p-4 ${
                  chapter.unlocked
                    ? "border-indigo-200/70 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/30"
                    : "border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-bold ${
                      chapter.unlocked
                        ? "text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Chapter {chapter.chapter} · {chapter.title}
                  </p>
                  <span className="shrink-0 text-sm" role="img" aria-hidden="true">
                    {chapter.unlocked ? "✨" : "🔒"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {chapter.description}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
