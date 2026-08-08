"use client";

// Collection book tabs (handoff §20, §33 — Mood / Badges / Story / Wisdom).
// The server page queries everything and passes plain serializable props
// across the RSC boundary (dates preformatted as strings). On top of that,
// a realtime plant_badges subscription (dopamine plan Task 16) flips badge
// cards live when the backend unlocks one — presentation only, zero writes.
//
// Styled in the farm design language (public/farm/style.css is the source
// of truth) via the shared shell contract: .pm-panel cards, .pm-bar
// progress, .pm-chip pills, .pm-heading pixel type. The pm-* classes are
// unlayered CSS (they beat Tailwind utilities), so per-card accent colors
// are applied with inline styles on purpose.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import StoryChapterCard from "@/components/story-chapter-card";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { ChapterScene } from "@/game/story/story-dialogue";
import type { AppLocale } from "@/lib/i18n";

declare global {
  interface Window {
    /** 8-bit SFX engine from public/farm/sfx.js (loaded via the root layout). */
    PMSfx?: {
      play: (cue: string) => void;
      muted: () => boolean;
      toggle: () => boolean;
      buzz: (ms: number) => void;
    };
  }
}

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

// Muted ink tints derived from the farm text color #243421 (spec §2.5).
const INK_MUTED = "#5B6B57";
const INK_FAINT = "#93A08F";

// Locked cards read as empty inventory slots: tinted well, dashed border,
// no pixel shadow. Spread on top of .pm-panel via inline style.
const LOCKED_PANEL: CSSProperties = {
  background: "var(--color-bg)",
  borderStyle: "dashed",
  boxShadow: "none",
};

// 8-bit pop-in cascade: every card gets the same `pm-card-cascade` class
// (locked cards included — nothing about the entrance teases what's inside)
// with a per-index stagger. Capped at the first 8 cards so a long badge or
// story list never drags out the reveal — cards past the cap share the 8th
// card's delay instead of accumulating further.
const CASCADE_STAGGER_MS = 40;
const CASCADE_CAP = 8;
function cascadeStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, CASCADE_CAP - 1) * CASCADE_STAGGER_MS}ms` };
}

/** Chunky pixel progress bar (shell .pm-bar contract) replacing the plain
 *  "x / y" text counters (Task 16). */
function ProgressCounter({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-label={`${value} / ${total} ${label}`}
        className="pm-bar flex-1"
      >
        <div className="pm-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pm-heading shrink-0 text-[10px] tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}

/** Pulsing "1 more to go!" pill shown when a tab is one item from complete. */
function OneMorePill({ label }: { label: string }) {
  return (
    <p className="mb-3 text-center">
      <span
        className="pm-chip motion-safe:animate-pulse"
        style={{
          background: "var(--color-primary)",
          borderColor: "var(--color-forest)",
          color: "#ffffff",
        }}
      >
        {label}
      </span>
    </p>
  );
}

export default function CollectionTabs({ locale, moods, badges, chapters, wisdom }: CollectionTabsProps) {
  const [tab, setTab] = useState<TabId>("moods");
  // Badges unlocked by a live plant_badges INSERT after the server render,
  // and the subset currently playing their flip celebration.
  const [liveUnlocked, setLiveUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const [flipping, setFlipping] = useState<ReadonlySet<string>>(() => new Set());
  const flipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Degrades gracefully: without Supabase env the collection stays static.
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("collection-badges")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plant_badges" },
        (payload) => {
          const key = (payload.new as { badge_key?: string } | null)?.badge_key;
          if (!key) return;
          setLiveUnlocked((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          setFlipping((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          // Presentation only — sound is muted/rate-limited inside the engine.
          window.PMSfx?.play("coin");
          // Whole celebration stays inside the 4s budget (flip itself is 0.9s).
          flipTimers.current.push(
            setTimeout(() => {
              setFlipping((prev) => {
                if (!prev.has(key)) return prev;
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            }, 4000),
          );
        },
      )
      .subscribe();

    const timers = flipTimers.current;
    return () => {
      supabase.removeChannel(channel);
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  // Copy lives inline per locale (same mechanism as the rest of this file).
  // luckyOdds duplicates public/farm/strings.js → PM_STRINGS.luckyOdds
  // knowingly: React can't read the farm string table at build time.
  const copy = locale === "id"
    ? { moods: "Suasana", badges: "Lencana", story: "Cerita", wisdom: "Pengetahuan", discovered: "suasana ditemukan", learned: "Yang sudah dipelajari", unlockedBadges: "lencana terbuka", unlocked: "Terbuka", locked: "Terkunci", unlockedOn: "Terbuka", chapters: "bab terbuka", wisdomIntro: "Pengetahuan tradisional yang dihubungkan dengan pengukuran", oneMore: "Tinggal 1 lagi!", luckyOdds: "1 dari 8 misi menumbuhkan bonus keberuntungan!" }
    : { moods: "Moods", badges: "Badges", story: "Story", wisdom: "Wisdom", discovered: "moods discovered", learned: "What we've learned", unlockedBadges: "badges unlocked", unlocked: "Unlocked", locked: "Locked", unlockedOn: "Unlocked", chapters: "chapters unlocked", wisdomIntro: "Traditional knowledge, translated into measurements", oneMore: "1 more to go!", luckyOdds: "1 in 8 quests sprouts a lucky bonus!" };

  const discoveredMoods = moods.filter((mood) => mood.discovered).length;
  const unlockedBadges = badges.filter(
    (badge) => badge.unlockedLabel !== null || liveUnlocked.has(badge.key),
  ).length;
  const unlockedChapters = chapters.filter((chapter) => chapter.unlocked).length;

  return (
    <div>
      {/* Badge flip celebration (CSS rotateY). Wrapped in a no-preference
          media query so reduced-motion users get an instant, animation-free
          reveal — the card content still updates, it just never rotates.
          The reduce block also stills the shell's .pm-bar-fill width
          transition, preserving this component's motion-safe gate. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .pm-badge-flip {
            animation: pm-badge-flip 0.9s ease-in-out both;
          }
          @keyframes pm-badge-flip {
            0% { transform: perspective(600px) rotateY(0deg); }
            100% { transform: perspective(600px) rotateY(360deg); }
          }
          /* Pixel cascade pop-in (fill-mode "both" holds the 0% frame during
             each card's stagger delay, so nothing flashes at full opacity
             before its turn). Outside this media query the class carries no
             rules at all, so reduced-motion users just get the cards already
             in place — an instant swap, not a de-animated version. */
          .pm-card-cascade {
            animation: pm-card-cascade 200ms steps(3, jump-end) both;
          }
          @keyframes pm-card-cascade {
            0% { opacity: 0; transform: translateY(6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pm-bar-fill { transition: none; }
        }
        /* Pressed tab dips 2px, echoing the shared .pm-btn ledge press — a
           plain :active transform, so it stays on for everyone. */
        .pm-tab-btn { transition: transform 0.08s ease-out; }
        .pm-tab-btn:active { transform: translateY(2px); }
      `}</style>
      <div
        role="tablist"
        aria-label="Collection sections"
        className="grid grid-cols-4 gap-1.5 rounded-2xl border-2 p-1.5"
        style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}
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
              onClick={() => {
                setTab(entry.id);
                window.PMSfx?.play("tick");
              }}
              className="pm-heading pm-tab-btn flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[8px] transition-all sm:text-[9px]"
              style={
                active
                  ? { background: "var(--color-grass)", color: "#ffffff", boxShadow: "0 3px 0 var(--color-forest)" }
                  : { color: "var(--color-text)" }
              }
            >
              <span className="text-base leading-none" role="img" aria-hidden="true">
                {entry.emoji}
              </span>
              {copy[entry.id]}
            </button>
          );
        })}
      </div>

      {tab === "moods" && (
        <section id="collection-panel-moods" role="tabpanel" className="mt-5">
          <ProgressCounter value={discoveredMoods} total={moods.length} label={copy.discovered} />
          {discoveredMoods === moods.length - 1 && <OneMorePill label={copy.oneMore} />}
          <ul className="grid grid-cols-3 gap-3">
            {moods.map((mood, index) => (
              <li
                key={mood.mood}
                className="pm-panel pm-card-cascade flex flex-col items-center gap-1.5 text-center"
                style={
                  mood.discovered
                    ? { padding: "14px 10px", borderColor: "var(--color-grass-light)", ...cascadeStyle(index) }
                    : { padding: "14px 10px", ...LOCKED_PANEL, ...cascadeStyle(index) }
                }
              >
                <span
                  className={`text-3xl leading-none ${mood.discovered ? "" : "brightness-0 opacity-30"}`}
                  role="img"
                  aria-label={mood.label}
                >
                  {mood.emoji}
                </span>
                <span
                  className="text-[11px] font-semibold leading-tight"
                  style={{ color: mood.discovered ? "var(--color-text)" : INK_FAINT }}
                >
                  {mood.label}
                </span>
                <span
                  className="pm-heading text-[10px]"
                  style={{ color: mood.discovered ? "var(--color-forest)" : "#B7C2B3" }}
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
              <p className="pm-heading mb-3 mt-6 text-center text-[10px]" style={{ color: INK_MUTED }}>
                {copy.learned}
              </p>
              <ul className="flex flex-col gap-3">
                {moods
                  .filter((mood) => mood.discovered && mood.whyCard != null)
                  .map((mood) => (
                    <li
                      key={mood.mood}
                      className="pm-panel"
                      style={{ borderColor: "var(--color-grass-light)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none" role="img" aria-hidden="true">
                          {mood.emoji}
                        </span>
                        <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                          {mood.label}
                          <span className="font-medium" style={{ color: INK_MUTED }}>
                            {" "}
                            · {mood.whyCard?.title}
                          </span>
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs leading-5" style={{ color: INK_MUTED }}>
                        {mood.whyCard?.why}
                      </p>
                      <p className="mt-1.5 text-xs font-semibold leading-5" style={{ color: "var(--color-forest)" }}>
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
          <ProgressCounter value={unlockedBadges} total={badges.length} label={copy.unlockedBadges} />
          {unlockedBadges === badges.length - 1 && <OneMorePill label={copy.oneMore} />}
          <ul className="flex flex-col gap-3">
            {badges.map((badge, index) => {
              const unlocked = badge.unlockedLabel !== null || liveUnlocked.has(badge.key);
              return (
                <li
                  key={badge.key}
                  className={`pm-panel pm-card-cascade flex items-start gap-3 ${flipping.has(badge.key) ? "pm-badge-flip" : ""}`}
                  style={
                    unlocked
                      ? { borderColor: "var(--color-yellow)", ...cascadeStyle(index) }
                      : { ...LOCKED_PANEL, ...cascadeStyle(index) }
                  }
                >
                  <span
                    className={`text-3xl leading-none ${unlocked ? "" : "brightness-0 opacity-30"}`}
                    role="img"
                    aria-hidden="true"
                  >
                    {badge.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className="text-sm font-bold"
                        style={{ color: unlocked ? "var(--color-text)" : INK_FAINT }}
                      >
                        {badge.name}
                      </p>
                      <span
                        className="pm-heading shrink-0 rounded-full border-2 px-2 py-1 text-[8px] uppercase"
                        style={
                          unlocked
                            ? { background: "var(--color-yellow)", borderColor: "#E8C46B", color: "#7A5B12" }
                            : { background: "var(--color-bg)", borderColor: "var(--color-border)", color: INK_FAINT }
                        }
                      >
                        {unlocked ? copy.unlocked : copy.locked}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5" style={{ color: INK_MUTED }}>
                      {badge.description}
                    </p>
                    {badge.unlockedLabel && (
                      <p className="mt-1 text-[11px] font-semibold" style={{ color: "#A97B12" }}>
                        {copy.unlockedOn} {badge.unlockedLabel}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {/* Honest lucky-odds disclosure (spec D2 / §4.2). English copy is
              the same text as PM_STRINGS.luckyOdds in public/farm/strings.js —
              duplicated knowingly, React can't read that file at build time. */}
          <p className="mt-4 text-center text-[11px] font-medium" style={{ color: INK_MUTED }}>
            🍀 {copy.luckyOdds}
          </p>
        </section>
      )}

      {tab === "story" && (
        <section id="collection-panel-story" role="tabpanel" className="mt-5">
          <ProgressCounter value={unlockedChapters} total={chapters.length} label={copy.chapters} />
          {unlockedChapters === chapters.length - 1 && <OneMorePill label={copy.oneMore} />}
          <ol className="flex flex-col gap-3">
            {chapters.map((chapter, index) => (
              <li key={chapter.chapter} className="pm-card-cascade" style={cascadeStyle(index)}>
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
          <p className="mb-3 text-center text-xs font-medium" style={{ color: INK_MUTED }}>
            {copy.wisdomIntro}
          </p>
          <ul className="flex flex-col gap-3">
            {wisdom.map((entry, index) => (
              <li
                key={entry.id}
                className="pm-panel pm-card-cascade"
                style={{ borderColor: "#A9D2F2", ...cascadeStyle(index) }}
              >
                <p className="text-sm font-semibold italic leading-5" style={{ color: "var(--color-text)" }}>
                  &ldquo;{entry.saying}&rdquo;
                </p>
                <p className="mt-2 text-xs leading-5" style={{ color: INK_MUTED }}>
                  {entry.translation}
                </p>
                <div
                  className="mt-2 rounded-xl border-2 px-3 py-2"
                  style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}
                >
                  <p className="pm-heading text-[8px] uppercase tracking-wide" style={{ color: "#2F6FAE" }}>
                    {entry.metric}
                  </p>
                  <p className="mt-1 text-[11px] leading-4" style={{ color: INK_MUTED }}>
                    {entry.example}
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-medium leading-4" style={{ color: INK_FAINT }}>
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
