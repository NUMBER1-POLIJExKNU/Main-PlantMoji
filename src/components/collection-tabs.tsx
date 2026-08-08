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
import { BADGE_EFFECTS, BADGE_EFFECT_STORAGE_KEY } from "@/game/badges/keepsakes";
import type { BadgeKey } from "@/types/game";

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
const BADGE_WHEEL_BRANCHES = [
  { id: "bond", color: "#F4C95D", angle: 225, keys: ["FIRST_RESCUE", "LEVEL_5_BOND", "LEVEL_10_BOND"] },
  { id: "environment", color: "#74B9FF", angle: 315, keys: ["LIGHT_MASTER", "COOL_KEEPER", "HUMIDITY_HERO"] },
  { id: "mastery", color: "#C89BFF", angle: 45, keys: ["PH_GUARDIAN", "MOOD_SCHOLAR", "CARE_VETERAN"] },
  { id: "consistency", color: "#71D18B", angle: 135, keys: ["CHRONICLER", "STREAK_7", "STREAK_30"] },
] as const;
const BADGE_RING_RADII = [18, 31.5, 45] as const;

function badgeWheelMeta(key: string) {
  for (const branch of BADGE_WHEEL_BRANCHES) {
    const rank = branch.keys.findIndex((item) => item === key);
    if (rank >= 0) {
      const angle = (branch.angle + (rank - 1) * 7) * Math.PI / 180;
      const radius = BADGE_RING_RADII[rank];
      return { branch: branch.id, color: branch.color, rank, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
    }
  }
  return { branch: "other", color: "#F4C95D", rank: 0, x: 50, y: 50 };
}

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
  const [selectedBadgeKey, setSelectedBadgeKey] = useState(() => badges.find((badge) => badge.unlockedLabel !== null)?.key ?? badges[0]?.key ?? "");
  // Badges unlocked by a live plant_badges INSERT after the server render,
  // and the subset currently playing their flip celebration.
  const [liveUnlocked, setLiveUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const [flipping, setFlipping] = useState<ReadonlySet<string>>(() => new Set());
  const [activeEffect, setActiveEffect] = useState<BadgeKey | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(BADGE_EFFECT_STORAGE_KEY);
      return saved && saved in BADGE_EFFECTS ? saved as BadgeKey : null;
    } catch {
      return null;
    }
  });
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
    ? { moods: "Suasana", badges: "Lencana", story: "Cerita", wisdom: "Pengetahuan", discovered: "suasana ditemukan", learned: "Yang sudah dipelajari", unlockedBadges: "lencana terbuka", unlocked: "Terbuka", locked: "Terkunci", unlockedOn: "Diperoleh", chapters: "bab terbuka", wisdomIntro: "Pengetahuan tradisional yang dihubungkan dengan pengukuran", oneMore: "Tinggal 1 lagi!", luckyOdds: "1 dari 8 misi menumbuhkan bonus keberuntungan!", gemIntro: "Pilih lencana untuk mengubah efek saat Jamkachu diketuk.", wheelCenter: "PERTUMBUHAN", branchBond: "IKATAN", branchEnvironment: "LINGKUNGAN", branchMastery: "KEAHLIAN", branchConsistency: "KONSISTEN", reward: "EFEK KETUK", equip: "Aktifkan", equipped: "Sedang aktif", remove: "Matikan" }
    : { moods: "Moods", badges: "Badges", story: "Story", wisdom: "Wisdom", discovered: "moods discovered", learned: "What we've learned", unlockedBadges: "badges unlocked", unlocked: "Unlocked", locked: "Locked", unlockedOn: "Collected", chapters: "chapters unlocked", wisdomIntro: "Traditional knowledge, translated into measurements", oneMore: "1 more to go!", luckyOdds: "1 in 8 quests sprouts a lucky bonus!", gemIntro: "Choose a badge to change Jamkachu’s tap effect.", wheelCenter: "GROWTH", branchBond: "BOND", branchEnvironment: "ENVIRONMENT", branchMastery: "MASTERY", branchConsistency: "CONSISTENCY", reward: "TAP EFFECT", equip: "Activate", equipped: "Active", remove: "Turn off" };

  const discoveredMoods = moods.filter((mood) => mood.discovered).length;
  const unlockedBadges = badges.filter(
    (badge) => badge.unlockedLabel !== null || liveUnlocked.has(badge.key),
  ).length;
  const unlockedChapters = chapters.filter((chapter) => chapter.unlocked).length;
  const selectedBadge = badges.find((badge) => badge.key === selectedBadgeKey) ?? badges[0];
  const selectedBadgeUnlocked = selectedBadge != null && (selectedBadge.unlockedLabel !== null || liveUnlocked.has(selectedBadge.key));
  const selectedEffect = selectedBadge ? BADGE_EFFECTS[selectedBadge.key as BadgeKey] : null;
  const selectedEffectActive = selectedEffect != null && activeEffect === selectedEffect.badgeKey;

  const toggleBadgeEffect = () => {
    if (!selectedEffect || !selectedBadgeUnlocked) return;
    const next = selectedEffectActive ? null : selectedEffect.badgeKey;
    setActiveEffect(next);
    if (next) localStorage.setItem(BADGE_EFFECT_STORAGE_KEY, next); else localStorage.removeItem(BADGE_EFFECT_STORAGE_KEY);
    window.PMSfx?.play(selectedEffectActive ? "tick" : "coin");
  };

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
            0% { transform: scale(.72) rotate(-12deg); filter: brightness(2); }
            55% { transform: scale(1.18) rotate(5deg); filter: brightness(1.5) drop-shadow(0 0 12px #F4C95D); }
            100% { transform: scale(1) rotate(0); filter: brightness(1); }
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
        .pm-badge-wheel { background: radial-gradient(circle at center, #FFFDF2 0 13%, #F4FAF1 35%, #E7F2E2 72%, #D6E8D0 100%); }
        .pm-gem-button { -webkit-tap-highlight-color: transparent; }
        .pm-gem-button:active .pm-gem-socket { transform: translateY(2px) scale(.96); }
        .pm-gem-button:focus-visible { outline: 3px solid #4DA1ED; outline-offset: 4px; border-radius: 18px; }
        .pm-gem-socket { transition: transform .15s ease, filter .2s ease; }
        .pm-gem-unlocked { box-shadow: inset 0 0 0 5px rgba(255,255,255,.38), 0 5px 0 #8C6A21, 0 9px 16px rgba(93,72,24,.18); }
        .pm-gem-unlocked::after { content: ""; position: absolute; width: 24%; height: 13%; top: 18%; left: 23%; background: rgba(255,255,255,.82); transform: rotate(-28deg); }
        .pm-gem-locked { box-shadow: inset 0 0 0 6px rgba(36,52,33,.08), 0 4px 0 #879481; }
        .pm-wheel-node { position: absolute; width: clamp(48px, 14.5vw, 66px); transform: translate(-50%, -50%); z-index: 3; }
        .pm-wheel-node .pm-gem-socket { width: 100%; }
        .pm-wheel-center { position: absolute; left: 50%; top: 50%; z-index: 4; width: clamp(76px, 21vw, 98px); aspect-ratio: 1; transform: translate(-50%, -50%); }
        .pm-wheel-label { position: absolute; z-index: 2; font: 7px/1.4 var(--pm-font-pixel); letter-spacing: .05em; color: #57684F; }
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
          <p className="mb-4 text-center text-xs leading-5" style={{ color: INK_MUTED }}>{copy.gemIntro}</p>
          <div className="pm-badge-wheel relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-full border-[3px]" style={{ borderColor: "var(--color-border)", boxShadow: "inset 0 0 0 7px rgba(255,255,255,.38), 0 6px 0 rgba(36,52,33,.14)" }}>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
              {BADGE_RING_RADII.map((radius) => <circle key={radius} cx="50" cy="50" r={radius} fill="none" stroke="rgba(87,104,79,.19)" strokeWidth=".65" strokeDasharray="1.5 1.5" />)}
              {BADGE_WHEEL_BRANCHES.flatMap((branch) => branch.keys.map((key, rank) => {
                const to = badgeWheelMeta(key); const from = rank === 0 ? { x: 50, y: 50 } : badgeWheelMeta(branch.keys[rank - 1]);
                const badge = badges.find((item) => item.key === key); const lit = badge != null && (badge.unlockedLabel !== null || liveUnlocked.has(key));
                return <line key={key} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={lit ? branch.color : "#AAB6A5"} strokeWidth={lit ? "1.4" : ".8"} strokeDasharray={lit ? undefined : "1.5 1.5"} />;
              }))}
            </svg>
            <span className="pm-wheel-label left-[8%] top-[47%] -rotate-45">{copy.branchBond}</span>
            <span className="pm-wheel-label right-[3%] top-[47%] rotate-45">{copy.branchEnvironment}</span>
            <span className="pm-wheel-label bottom-[7%] right-[15%] -rotate-45">{copy.branchMastery}</span>
            <span className="pm-wheel-label bottom-[7%] left-[9%] rotate-45">{copy.branchConsistency}</span>
            <div className="pm-wheel-center grid place-items-center rounded-full border-[5px] border-[#397A2B] bg-[#E8F6E0] text-center shadow-[0_5px_0_#2B3A27]">
              <span className="text-3xl leading-none" aria-hidden="true">🌱</span>
              <span className="pm-heading text-[7px] text-[#397A2B]">{copy.wheelCenter}</span>
              <strong className="text-[11px] tabular-nums">{unlockedBadges}/{badges.length}</strong>
            </div>
            {badges.map((badge, index) => {
              const unlocked = badge.unlockedLabel !== null || liveUnlocked.has(badge.key);
              const selected = badge.key === selectedBadge?.key;
              const meta = badgeWheelMeta(badge.key);
              return (
                <button key={badge.key} type="button" className="pm-wheel-node pm-gem-button cursor-pointer border-0 bg-transparent p-0" style={{ left: `${meta.x}%`, top: `${meta.y}%`, ...cascadeStyle(index) }} aria-pressed={selected} aria-label={`${badge.name}: ${unlocked ? copy.unlocked : copy.locked}`} onClick={() => { setSelectedBadgeKey(badge.key); window.PMSfx?.play("tick"); }}>
                    <span className={`pm-gem-socket relative grid aspect-square place-items-center overflow-hidden rounded-full border-[5px] ${unlocked ? "pm-gem-unlocked" : "pm-gem-locked"} ${flipping.has(badge.key) ? "pm-badge-flip" : ""}`} style={unlocked ? { background: `radial-gradient(circle at 38% 30%, #fff 0 5%, ${meta.color} 18% 58%, #4D5135 100%)`, borderColor: selected ? "#243421" : "#FFF4BE" } : { background: "#D9E1D5", borderColor: selected ? "#243421" : "#AAB6A5" }}>
                      <span className={`text-3xl leading-none sm:text-4xl ${unlocked ? "drop-shadow-[0_2px_0_rgba(255,255,255,.6)]" : "brightness-0 opacity-25"}`} aria-hidden="true">{badge.emoji}</span>
                      {!unlocked && <span className="absolute bottom-1 right-2 text-sm" aria-hidden="true">🔒</span>}
                    </span>
                </button>
              );
            })}
          </div>
          {selectedBadge && (
            <article className="pm-panel mt-4 text-center" style={{ borderColor: selectedBadgeUnlocked ? "var(--color-yellow)" : "var(--color-border)", ...(selectedBadgeUnlocked ? {} : LOCKED_PANEL) }} aria-live="polite">
              <p className="pm-heading text-[10px]" style={{ color: selectedBadgeUnlocked ? "#A97B12" : INK_FAINT }}>{selectedBadgeUnlocked ? `◆ ${copy.unlocked} ◆` : `🔒 ${copy.locked}`}</p>
              <h3 className="mt-2 text-base font-bold">{selectedBadge.name}</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: INK_MUTED }}>{selectedBadge.description}</p>
              {selectedBadge.unlockedLabel && <p className="mt-2 text-[11px] font-semibold" style={{ color: "#A97B12" }}>{copy.unlockedOn} {selectedBadge.unlockedLabel}</p>}
              {selectedEffect && (
                <div className="mx-auto mt-4 flex max-w-sm items-center gap-3 rounded-xl border-2 border-[#D8C98B] bg-[#FFF9DC] p-3 text-left">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-[#C99B32] bg-white text-xl" aria-hidden="true">{selectedEffect.particles.slice(0,2).join("")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="pm-heading text-[8px] text-[#A97B12]">{copy.reward}</p>
                    <p className="mt-1 text-sm font-bold">{selectedEffect.name[locale]}</p>
                    <p className="text-[11px]" style={{ color: INK_MUTED }}>{selectedEffect.particles.join(" · ")}</p>
                  </div>
                  <button type="button" disabled={!selectedBadgeUnlocked} onClick={toggleBadgeEffect} className="pm-btn cursor-pointer px-3 py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-45" aria-pressed={selectedEffectActive}>
                    {selectedEffectActive ? copy.remove : selectedBadgeUnlocked ? copy.equip : `🔒 ${copy.locked}`}
                  </button>
                </div>
              )}
            </article>
          )}
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
