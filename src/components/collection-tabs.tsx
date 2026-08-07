"use client";

// Collection book tabs (handoff §20, §33 — Mood / Badges / Story / Wisdom).
// Purely presentational: the server page queries everything and passes plain
// serializable props across the RSC boundary (dates preformatted as strings).

import { useState } from "react";
import StoryChapterCard from "@/components/story-chapter-card";
import type { ChapterScene } from "@/game/story/story-dialogue";
import type { AppLocale } from "@/lib/i18n";

export interface MoodCollectionItem {
  mood: string;
  label: string;
  emoji: string;
  discovered: boolean;
  /** Plant-science why-card, present only once the mood is discovered. */
  whyCard: { title: string; why: string; action: string } | null;
}

export interface WisdomCollectionItem {
  id: string;
  saying: string;
  source: string;
  translation: string;
  metric: string;
  example: string;
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
  /** Personality-flavored chapter dialogue; null while locked (spoiler-free). */
  scene: ChapterScene | null;
}

export interface CollectionTabsProps {
  locale: AppLocale;
  moods: MoodCollectionItem[];
  badges: BadgeCollectionItem[];
  chapters: StoryCollectionItem[];
  wisdom: WisdomCollectionItem[];
}

const TABS = [
  { id: "moods", emoji: "🎭" },
  { id: "badges", emoji: "🏅" },
  { id: "story", emoji: "📜" },
  { id: "wisdom", emoji: "🌾" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CollectionTabs({ locale, moods, badges, chapters, wisdom }: CollectionTabsProps) {
  const [tab, setTab] = useState<TabId>("moods");
  const copy = locale === "id"
    ? { moods: "Suasana", badges: "Lencana", story: "Cerita", wisdom: "Pengetahuan", discovered: "suasana ditemukan", learned: "Yang sudah dipelajari", unlockedBadges: "lencana terbuka", unlocked: "Terbuka", locked: "Terkunci", unlockedOn: "Terbuka", chapters: "bab terbuka", wisdomIntro: "Pengetahuan tradisional yang dihubungkan dengan pengukuran" }
    : { moods: "Moods", badges: "Badges", story: "Story", wisdom: "Wisdom", discovered: "moods discovered", learned: "What we've learned", unlockedBadges: "badges unlocked", unlocked: "Unlocked", locked: "Locked", unlockedOn: "Unlocked", chapters: "chapters unlocked", wisdomIntro: "Traditional knowledge, translated into measurements" };

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
              {copy[entry.id]}
            </button>
          );
        })}
      </div>

      {tab === "moods" && (
        <section id="collection-panel-moods" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {discoveredMoods} / {moods.length} {copy.discovered}
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
                  aria-label={mood.discovered ? copy.unlocked : copy.locked}
                >
                  {mood.discovered ? "✓" : "?"}
                </span>
              </li>
            ))}
          </ul>

          {/* Educational layer (handoff §2, §51): once a mood is discovered,
              its plant-science why-card unlocks. Undiscovered moods stay
              hidden until the sensors have actually seen them. */}
          {moods.some((mood) => mood.discovered && mood.whyCard) && (
            <>
              <p className="mb-3 mt-6 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
                {copy.learned}
              </p>
              <ul className="flex flex-col gap-3">
                {moods
                  .filter((mood) => mood.discovered && mood.whyCard != null)
                  .map((mood) => (
                    <li
                      key={mood.mood}
                      className="rounded-2xl border border-green-200/70 bg-green-50/70 p-4 dark:border-green-900/60 dark:bg-green-950/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none" role="img" aria-hidden="true">
                          {mood.emoji}
                        </span>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {mood.label}
                          <span className="font-medium text-zinc-500 dark:text-zinc-400">
                            {" "}
                            · {mood.whyCard?.title}
                          </span>
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                        {mood.whyCard?.why}
                      </p>
                      <p className="mt-1.5 text-xs font-medium leading-5 text-green-700 dark:text-green-400">
                        {mood.whyCard?.action}
                      </p>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "badges" && (
        <section id="collection-panel-badges" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {unlockedBadges} / {badges.length} {copy.unlockedBadges}
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
                        {unlocked ? copy.unlocked : copy.locked}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {badge.description}
                    </p>
                    {badge.unlockedLabel && (
                      <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {copy.unlockedOn} {badge.unlockedLabel}
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
            {unlockedChapters} / {chapters.length} {copy.chapters}
          </p>
          <ol className="flex flex-col gap-3">
            {chapters.map((chapter) => (
              <li key={chapter.chapter}>
                <StoryChapterCard
                  chapter={{
                    chapter: chapter.chapter,
                    title: chapter.title,
                    description: chapter.description,
                  }}
                  unlocked={chapter.unlocked}
                  scene={chapter.scene}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab === "wisdom" && (
        <section id="collection-panel-wisdom" role="tabpanel" className="mt-5">
          <p className="mb-3 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {copy.wisdomIntro}
          </p>
          <ul className="flex flex-col gap-3">
            {wisdom.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-teal-200/70 bg-teal-50/60 p-4 dark:border-teal-900/60 dark:bg-teal-950/30"
              >
                <p className="text-sm font-semibold italic leading-5 text-zinc-900 dark:text-zinc-50">
                  &ldquo;{entry.saying}&rdquo;
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                  {entry.translation}
                </p>
                <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    {entry.metric}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
                    {entry.example}
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-medium leading-4 text-zinc-400 dark:text-zinc-500">
                  {entry.source}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
