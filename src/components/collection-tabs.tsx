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
import { MOOD_SPRITE, MOOD_STATUS_CHIP, spriteAssetPath, type SpritePhase } from "@/lib/jamkachu-sprite";
import { normalizeMood, type PlantMood } from "@/types/events";
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
  /** English/Indonesian mood names, always both present regardless of
   *  request locale — the detail panel shows them together. */
  labelEn: string;
  labelId: string;
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
  /** Player's real current growth phase (src/lib/jamkachu-sprite.ts) — the
   *  mood dex hero always shows Jamkachu as they actually look today. */
  spritePhase: SpritePhase;
}

const TABS = [
  { id: "moods", emoji: "🎭" },
  { id: "badges", emoji: "🏅" },
  { id: "story", emoji: "📜" },
  { id: "wisdom", emoji: "🌾" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type RewardPreview = { kind: TabId; emoji: string; title: string; line: string; particles: string[] };

// Designer mood badge icon pack (public/farm/assets/moods/) — the dex CELL's
// art. Each PlantMood maps to its own drawn icon file so the grid never
// leans on the shared Jamkachu "plain" body (that collision is what forced
// the old shared 🧪 status chip); SoilAcidic/SoilAlkaline get visually
// distinct icons (a red down-arrow tube vs. a purple up-arrow tube) straight
// from the art, no extra differentiator needed. Two files in the pack (#8
// and #10) belong to moods this build doesn't have — never map to them here.
const MOOD_ICON_FILE: Record<string, string> = {
  Happy: "mood-01-happy",
  Overheating: "mood-02-overheating",
  DryAir: "mood-03-dry-air",
  Sleepy: "mood-04-sleepy",
  SoilAcidic: "mood-05-soil-acidic",
  SoilAlkaline: "mood-06-soil-alkaline",
  HumidAir: "mood-09-too-wet",
  TooCold: "mood-11-too-cold",
};
const MOOD_LOCKED_ICON_FILE = "mood-07-locked";
function moodIconSrc(file: string, variant: "4x" | "badge4x" = "4x"): string {
  return `/farm/assets/moods/${variant}/${file}.png`;
}

// Locked cells hint at WHICH real sensor the mood comes from without naming
// the mood itself (Pokédex-style tease, honesty rule: never invent a fake
// category). Two moods per bucket keeps the hint non-spoiling.
const MOOD_CATEGORY: Record<string, "temperature" | "air" | "light" | "soil" | "comfort"> = {
  Happy: "comfort",
  Overheating: "temperature",
  TooCold: "temperature",
  DryAir: "air",
  HumidAir: "air",
  Sleepy: "light",
  SoilAcidic: "soil",
  SoilAlkaline: "soil",
};
const MOOD_CATEGORY_COPY: Record<AppLocale, Record<string, { icon: string; label: string }>> = {
  id: {
    temperature: { icon: "🌡️", label: "Suhu" },
    air: { icon: "💧", label: "Udara" },
    light: { icon: "☀️", label: "Cahaya" },
    soil: { icon: "🧪", label: "Tanah" },
    comfort: { icon: "🌟", label: "Serba Nyaman" },
  },
  en: {
    temperature: { icon: "🌡️", label: "Temperature" },
    air: { icon: "💧", label: "Air" },
    light: { icon: "☀️", label: "Light" },
    soil: { icon: "🧪", label: "Soil" },
    comfort: { icon: "🌟", label: "All-Around" },
  },
};

// Kid-facing one-liner naming the real sensor behind the mood (honesty
// rule: moods always come from real sensors, never invented). Shown above
// the plant-science why/action cards, which stay untouched.
const MOOD_SENSOR_HINT: Record<string, { id: string; en: string }> = {
  Happy: { id: "Semua sensor — suhu, udara, cahaya, dan tanah — menunjukkan angka yang nyaman.", en: "Every sensor — temperature, air, light, and soil — is reading comfortable." },
  Overheating: { id: "Sensor suhu mendeteksi udara terlalu panas.", en: "The temperature sensor is reading too hot." },
  TooCold: { id: "Sensor suhu mendeteksi udara terlalu dingin.", en: "The temperature sensor is reading too cold." },
  DryAir: { id: "Sensor kelembapan udara mendeteksi udara terlalu kering.", en: "The air humidity sensor is reading too dry." },
  HumidAir: { id: "Sensor kelembapan udara mendeteksi udara terlalu lembap.", en: "The air humidity sensor is reading too damp." },
  Sleepy: { id: "Sensor cahaya mendeteksi cahaya terlalu redup.", en: "The light sensor is reading too dark." },
  SoilAcidic: { id: "Sensor pH tanah mendeteksi tanah terlalu asam.", en: "The soil pH sensor is reading too acidic." },
  SoilAlkaline: { id: "Sensor pH tanah mendeteksi tanah terlalu basa.", en: "The soil pH sensor is reading too alkaline." },
};

// Wisdom cards answered correctly, kept in this browser so the tab's
// progress meter does not reset to zero on reload and read as lost work.
// Presentation only — the engine owns every real reward.
const WISDOM_MASTERED_STORAGE_KEY = "pm-wisdom-mastered";
function persistWisdomMastered(ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(WISDOM_MASTERED_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private mode / quota exceeded — the tally just won't survive a
    // reload. Never block the UI for it.
  }
}

const MOOD_SEEN_STORAGE_KEY = "pm-mood-dex-seen";
function readOpenedMoods(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MOOD_SEEN_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}
function persistOpenedMoods(moodKeys: ReadonlySet<string>) {
  try {
    localStorage.setItem(MOOD_SEEN_STORAGE_KEY, JSON.stringify(Array.from(moodKeys)));
  } catch {
    // Private mode / quota exceeded — the NEW ribbon just won't persist
    // across reloads. Never block the UI for it.
  }
}

const MOOD_REACTIONS: Record<string, { id: string; en: string; particles: string[] }> = {
  Happy: { id: "Yay! Daunku ikut menari!", en: "Yay! My leaves are dancing!", particles: ["💚", "✨", "🌱"] },
  Overheating: { id: "Fuuuh… anginnya enak!", en: "Phew… that breeze feels good!", particles: ["💨", "❄️", "✨"] },
  DryAir: { id: "Awan kecil, datanglah!", en: "Little cloud, come closer!", particles: ["☁️", "💧", "💦"] },
  Sleepy: { id: "Ssst… satu lagu sebelum tidur.", en: "Shh… one song before bed.", particles: ["🌙", "⭐", "💤"] },
  SoilAcidic: { id: "Detektif tanah, ayo periksa bersama guru!", en: "Soil detectives—let's check with a teacher!", particles: ["🔍", "🧪", "🌱"] },
  SoilAlkaline: { id: "Hmm… tanahnya perlu diperiksa orang dewasa.", en: "Hmm… an adult should help check this soil.", particles: ["🔍", "🟣", "🌿"] },
};

const WISDOM_TRIALS: Record<string, { prompt: { id: string; en: string }; choices: { id: string[]; en: string[] }; answer: number }> = {
  "heavy-air-at-midday": { prompt: { id: "Udara siang terasa berat. Sensor mana yang dicek?", en: "Midday air feels heavy. Which sensors should you check?" }, choices: { id: ["Suhu + kelembapan udara", "pH tanah"], en: ["Temperature + air humidity", "Soil pH"] }, answer: 0 },
  "dry-lips-dry-leaves": { prompt: { id: "Daun menghadapi udara kering. Ukur apa?", en: "Leaves face dry air. What should you measure?" }, choices: { id: ["Kelembapan udara", "Kelembapan tanah"], en: ["Air humidity", "Soil moisture"] }, answer: 0 },
  "coffee-shade-lesson": { prompt: { id: "Daun terlalu lama gelap. Sensor apa yang membantu?", en: "Leaves stay dark too long. Which sensor helps?" }, choices: { id: ["Sensor cahaya", "Sensor pH"], en: ["Light sensor", "pH sensor"] }, answer: 0 },
  "sour-soil-after-rains": { prompt: { id: "Tanah diduga asam. Apa yang harus diukur bersama guru?", en: "Soil may be acidic. What should you measure with a teacher?" }, choices: { id: ["pH tanah", "Kelembapan udara"], en: ["Soil pH", "Air humidity"] }, answer: 0 },
  "pale-leaves-green-veins": { prompt: { id: "Daun pucat bisa terkait tanah basa. Cek apa?", en: "Pale leaves may relate to alkaline soil. Check what?" }, choices: { id: ["pH tanah", "Jam di dinding"], en: ["Soil pH", "The wall clock"] }, answer: 0 },
  "water-before-the-heat": { prompt: { id: "Kapan pengamatan dan penyiraman paling aman?", en: "When is observation and watering usually gentlest?" }, choices: { id: ["Pagi yang sejuk", "Puncak panas siang"], en: ["Cool morning", "Peak midday heat"] }, answer: 0 },
};

// Muted ink tints derived from the farm text color #243421 (spec §2.5).
const INK_MUTED = "var(--pm-ink-muted)";
const INK_FAINT = "var(--pm-ink-faint)";
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

/** Wisdom card header icon: one glyph standing in for the jargon-heavy
 *  sensor metric string (e.g. "air temperature (°C) + air humidity (%)")
 *  so the always-visible card face never reads like a spec sheet. The full
 *  metric text still lives in the tap-in "See the why" detail view. */
function wisdomMetricIcon(metric: string): string {
  if (/temperature/i.test(metric)) return "🌡️";
  if (/humidity/i.test(metric)) return "💧";
  if (/light/i.test(metric)) return "☀️";
  if (/ph/i.test(metric)) return "🧪";
  return "📡";
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

export default function CollectionTabs({ locale, moods, badges, chapters, wisdom, spritePhase }: CollectionTabsProps) {
  const [tab, setTab] = useState<TabId>("moods");
  const [selectedBadgeKey, setSelectedBadgeKey] = useState(() => badges.find((badge) => badge.unlockedLabel !== null)?.key ?? badges[0]?.key ?? "");
  const [selectedMoodKey, setSelectedMoodKey] = useState(() => moods.find((mood) => mood.discovered)?.mood ?? moods[0]?.mood ?? "");
  // Badges unlocked by a live plant_badges INSERT after the server render,
  // and the subset currently playing their flip celebration.
  const [liveUnlocked, setLiveUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const [flipping, setFlipping] = useState<ReadonlySet<string>>(() => new Set());
  // Moods discovered by a live `plants` current_state change after the
  // server render (mirrors liveUnlocked/flipping above), the subset
  // currently playing their flip celebration, and which moods the player
  // has already opened the detail of — clears the NEW ribbon and persists
  // across reloads (same localStorage idiom as activeEffect below).
  const [liveDiscoveredMoods, setLiveDiscoveredMoods] = useState<ReadonlySet<string>>(() => new Set());
  const [moodFlipping, setMoodFlipping] = useState<ReadonlySet<string>>(() => new Set());
  const [openedMoods, setOpenedMoods] = useState<ReadonlySet<string>>(() => {
    const stored = readOpenedMoods();
    const initialMood = moods.find((mood) => mood.discovered)?.mood;
    if (initialMood && !stored.has(initialMood)) {
      stored.add(initialMood);
      persistOpenedMoods(stored);
    }
    return stored;
  });
  const moodFlipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const discoveredMoodKeysRef = useRef<Set<string>>(new Set(moods.filter((mood) => mood.discovered).map((mood) => mood.mood)));
  const markMoodOpened = (key: string) => {
    setOpenedMoods((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      persistOpenedMoods(next);
      return next;
    });
  };
  const [activeEffect, setActiveEffect] = useState<BadgeKey | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(BADGE_EFFECT_STORAGE_KEY);
      return saved && saved in BADGE_EFFECTS ? saved as BadgeKey : null;
    } catch {
      return null;
    }
  });
  const [preview, setPreview] = useState<RewardPreview | null>(null);
  const [previewPulse, setPreviewPulse] = useState(0);
  const [wisdomTrial, setWisdomTrial] = useState<string | null>(null);
  const [wisdomAnswer, setWisdomAnswer] = useState<number | null>(null);
  // "Collected" signal for the Wisdom grid: which cards this visitor has
  // answered correctly. Kept in this browser (same idiom as the badge
  // effect above) so the meter does not reset to zero on reload and read
  // as lost progress. Presentation only — no engine or table writes.
  const [wisdomMastered, setWisdomMastered] = useState<ReadonlySet<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(WISDOM_MASTERED_STORAGE_KEY) ?? "[]");
      return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
    } catch { return new Set(); }
  });
  const [selectedChapterNumber, setSelectedChapterNumber] = useState(() => [...chapters].reverse().find((chapter) => chapter.unlocked)?.chapter ?? chapters[0]?.chapter ?? 1);
  const flipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const previewRef = useRef<HTMLElement | null>(null);

  // The reward pop renders once, directly under the tab bar — but the buttons
  // that fire it sit at the BOTTOM of their section (Story's "Play scene" is
  // below the chapter map AND the chapter card). Landing off-screen above, the
  // click read as a dead button. Bring the pop to the reader rather than
  // moving it, so all three trigger sites keep sharing one slot.
  // Instant, not smooth: a smooth scrollIntoView silently no-ops inside
  // .reno-route-content. Measured on the deployed page — with "smooth" the pop
  // stayed put at top -381, with the default it landed at +276. Arriving at
  // once is also what a reduced-motion reader wants, so there is no branch.
  useEffect(() => {
    if (!preview || previewPulse === 0) return;
    previewRef.current?.scrollIntoView({ block: "center" });
  }, [preview, previewPulse]);

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

  // Mirrors the badges realtime effect above, independently: a live `plants`
  // update carrying a mood this session doesn't already know about (server
  // props OR an earlier live update) plays the same flip + coin celebration
  // and flags it NEW, presentation only — no engine/table writes here, the
  // discovery truth still comes entirely from the server-rendered `moods`
  // prop on the next navigation.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("collection-moods")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plants" },
        (payload) => {
          const mood = normalizeMood((payload.new as { current_state?: string } | null)?.current_state);
          if (!mood || discoveredMoodKeysRef.current.has(mood)) return;
          discoveredMoodKeysRef.current.add(mood);
          setLiveDiscoveredMoods((prev) => {
            const next = new Set(prev);
            next.add(mood);
            return next;
          });
          setMoodFlipping((prev) => {
            const next = new Set(prev);
            next.add(mood);
            return next;
          });
          window.PMSfx?.play("coin");
          moodFlipTimers.current.push(
            setTimeout(() => {
              setMoodFlipping((prev) => {
                if (!prev.has(mood)) return prev;
                const next = new Set(prev);
                next.delete(mood);
                return next;
              });
            }, 4000),
          );
        },
      )
      .subscribe();

    const timers = moodFlipTimers.current;
    return () => {
      supabase.removeChannel(channel);
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  // Copy lives inline per locale (same mechanism as the rest of this file).
  const copy = locale === "id"
    ? { moods: "Suasana", badges: "Lencana", story: "Cerita", wisdom: "Pengetahuan", discovered: "suasana ditemukan", learned: "Yang sudah dipelajari", unlockedBadges: "lencana terbuka", unlocked: "Terbuka", locked: "Terkunci", unlockedOn: "Diperoleh", chapters: "bab terbuka", wisdomIntro: "Pengetahuan tradisional yang dihubungkan dengan pengukuran", wisdomSource: "Kearifan tani turun-temurun.", oneMore: "Tinggal 1 lagi!", wheelCenter: "PERTUMBUHAN", branchBond: "IKATAN", branchEnvironment: "LINGKUNGAN", branchMastery: "KEAHLIAN", branchConsistency: "KONSISTEN", reward: "EFEK KETUK", equip: "Aktifkan", equipped: "Sedang aktif", remove: "Matikan", tryIt: "Coba sekarang", replay: "Putar adegan", challenge: "Coba tebak", correct: "Benar! Kamu membaca lingkungan dengan tepat.", wrong: "Belum tepat—lihat jawabannya dan coba lagi.", newBadge: "BARU", moodComplete: "◆ KOLEKSI LENGKAP ◆", moodCompleteLine: "Semua suasana sudah ditemukan! Hadiah kejutan sedang disiapkan." }
    : { moods: "Moods", badges: "Badges", story: "Story", wisdom: "Wisdom", discovered: "moods discovered", learned: "What we've learned", unlockedBadges: "badges unlocked", unlocked: "Unlocked", locked: "Locked", unlockedOn: "Collected", chapters: "chapters unlocked", wisdomIntro: "Traditional knowledge, translated into measurements", wisdomSource: "Traditional farming wisdom.", oneMore: "1 more to go!", wheelCenter: "GROWTH", branchBond: "BOND", branchEnvironment: "ENVIRONMENT", branchMastery: "MASTERY", branchConsistency: "CONSISTENCY", reward: "TAP EFFECT", equip: "Activate", equipped: "Active", remove: "Turn off", tryIt: "Try it now", replay: "Play scene", challenge: "Try a prediction", correct: "Correct! You read the environment well.", wrong: "Not yet—check the answer and try again.", newBadge: "NEW", moodComplete: "◆ COLLECTION COMPLETE ◆", moodCompleteLine: "Every mood has been discovered! A surprise reward is on its way." };

  const discoveredMoods = moods.filter((mood) => mood.discovered || liveDiscoveredMoods.has(mood.mood)).length;
  const unlockedBadges = badges.filter(
    (badge) => badge.unlockedLabel !== null || liveUnlocked.has(badge.key),
  ).length;
  const unlockedChapters = chapters.filter((chapter) => chapter.unlocked).length;
  const selectedBadge = badges.find((badge) => badge.key === selectedBadgeKey) ?? badges[0];
  const selectedBadgeUnlocked = selectedBadge != null && (selectedBadge.unlockedLabel !== null || liveUnlocked.has(selectedBadge.key));
  const selectedEffect = selectedBadge ? BADGE_EFFECTS[selectedBadge.key as BadgeKey] : null;
  const selectedEffectActive = selectedEffect != null && activeEffect === selectedEffect.badgeKey;
  const selectedChapter = chapters.find((chapter) => chapter.chapter === selectedChapterNumber) ?? chapters[0];
  const selectedMood = moods.find((mood) => mood.mood === selectedMoodKey) ?? moods[0];

  const toggleBadgeEffect = () => {
    if (!selectedEffect || !selectedBadgeUnlocked) return;
    const next = selectedEffectActive ? null : selectedEffect.badgeKey;
    setActiveEffect(next);
    if (next) localStorage.setItem(BADGE_EFFECT_STORAGE_KEY, next); else localStorage.removeItem(BADGE_EFFECT_STORAGE_KEY);
    window.PMSfx?.play(selectedEffectActive ? "tick" : "coin");
  };

  const playReward = (next: RewardPreview) => {
    setPreview(next);
    setPreviewPulse((value) => value + 1);
    window.PMSfx?.play(next.kind === "story" ? "levelup" : "coin");
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
          .pm-reward-pop { animation: pm-reward-pop .62s steps(4, jump-end) both; }
          .pm-reward-particle { animation: pm-reward-particle .72s steps(4, jump-end) both; }
          @keyframes pm-reward-pop { 0% { transform: scale(.82); } 55% { transform: scale(1.06); } 100% { transform: scale(1); } }
          @keyframes pm-reward-particle { 0% { opacity: 0; transform: translate(0,12px) scale(.5); } 35% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--reward-x),-48px) scale(1.2); } }
        }
        @media (prefers-reduced-motion: reduce) {
          .pm-bar-fill { transition: none; }
        }
        /* Pressed tab dips 2px, echoing the shared .pm-btn ledge press — a
           plain :active transform, so it stays on for everyone. */
        .pm-tab-btn { transition: transform 0.08s ease-out; }
        .pm-tab-btn:active { transform: translateY(2px); }
        /* One-screen badges tab: wheel + detail side by side on wide
           viewports, wheel diameter clamped to viewport height. Nodes and
           the hub size in cqw (container width), so the whole radial design
           scales as one piece instead of crowding when the circle shrinks. */
        .pm-badge-layout { display: grid; gap: 14px; align-items: center; }
        .pm-badge-layout > .pm-panel { margin-top: 0; }
        @media (min-width: 800px) {
          .pm-badge-layout { grid-template-columns: minmax(0, 30rem) minmax(0, 1fr); }
          .pm-badge-layout .pm-badge-wheel { max-width: min(30rem, 62vh); }
        }
        .pm-badge-wheel { container-type: inline-size; background: radial-gradient(circle at center, #FFFDF2 0 13%, #F4FAF1 35%, #E7F2E2 72%, #D6E8D0 100%); }
        .pm-gem-button { -webkit-tap-highlight-color: transparent; }
        .pm-gem-button:active .pm-gem-socket { transform: translateY(2px) scale(.96); }
        .pm-gem-button:focus-visible { outline: 3px solid #4DA1ED; outline-offset: 4px; border-radius: 18px; }
        .pm-gem-socket { transition: transform .15s ease, filter .2s ease; }
        .pm-gem-unlocked { box-shadow: inset 0 0 0 5px rgba(255,255,255,.38), 0 5px 0 #8C6A21, 0 9px 16px rgba(93,72,24,.18); }
        .pm-gem-unlocked::after { content: ""; position: absolute; width: 24%; height: 13%; top: 18%; left: 23%; background: rgba(255,255,255,.82); transform: rotate(-28deg); }
        .pm-gem-locked { box-shadow: inset 0 0 0 6px rgba(36,52,33,.08), 0 4px 0 #879481; }
        .pm-wheel-node { position: absolute; width: clamp(44px, 13.75cqw, 66px); transform: translate(-50%, -50%); z-index: 3; }
        .pm-wheel-node .pm-gem-socket { width: 100%; }
        .pm-wheel-center { position: absolute; left: 50%; top: 50%; z-index: 4; width: clamp(64px, 20.4cqw, 98px); aspect-ratio: 1; transform: translate(-50%, -50%); }
        .pm-wheel-label { position: absolute; z-index: 2; font: 7px/1.4 var(--pm-font-pixel); letter-spacing: .05em; color: #57684F; }
        .pm-badge-effect-icon { display: flex; align-items: center; justify-content: center; gap: 1px; }
        .pm-badge-effect-icon i { display: block; max-width: 21px; font-style: normal; font-size: 18px; line-height: 1; }
        @media (max-width: 480px) {
          .pm-badge-effect-row { grid-template-columns: 48px minmax(0,1fr); }
          .pm-badge-effect-row > button { grid-column: 1 / -1; width: 100%; }
        }
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
                // Reward previews belong to the tab that launched them. They
                // render above the panels, so explicitly dismiss them before
                // revealing another collection section.
                setPreview(null);
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

      {preview && (
        <section ref={previewRef} key={previewPulse} className="pm-panel pm-reward-pop relative mt-4 overflow-hidden text-center" aria-live="polite" style={{ borderColor: "var(--color-yellow)", background: "linear-gradient(180deg,#FFFDF1,#F4FAF1)" }}>
          <div className="relative mx-auto mt-2 grid size-24 place-items-center overflow-hidden rounded-full border-[3px] border-[#397A2B] bg-[#E8F6E0] shadow-[0_5px_0_#2B3A27]">
            <span className="text-5xl" aria-hidden="true">{preview.emoji}</span>
            {Array.from({ length: 9 }, (_, index) => (
              <span key={`${previewPulse}-${index}`} className="pm-reward-particle pointer-events-none absolute text-xl" style={{ "--reward-x": `${((index % 5) - 2) * 20}px`, animationDelay: `${index * 45}ms` } as CSSProperties} aria-hidden="true">
                {preview.particles[index % preview.particles.length]}
              </span>
            ))}
          </div>
          <h3 className="mt-3 text-base font-bold">{preview.title}</h3>
          <p className="mt-1 text-sm leading-5" style={{ color: INK_MUTED }}>{preview.line}</p>
          <div className="mx-auto mt-3 max-w-[260px] rounded-xl border-2 border-dashed border-[#9bb88c] bg-[#f7fbe9] px-3 py-2 text-left text-[11px] font-bold text-[#397a2b]">
            <div className="flex items-center justify-between"><span>✨ {locale === "id" ? "KOMBO SEMANGAT" : "CARE COMBO"}</span><b>{Math.min(3, previewPulse)} / 3</b></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#dce8d3]"><span className="block h-full rounded-full bg-[#f4c95d] transition-all" style={{ width: `${Math.min(100, previewPulse * 33.333)}%` }} /></div>
          </div>
          <button type="button" className="pm-btn pm-btn-secondary mt-3" onClick={() => setPreview(null)}>{locale === "id" ? "KEMBALI KE KOLEKSI" : "BACK TO COLLECTION"}</button>
        </section>
      )}

      {tab === "moods" && (
        <section id="collection-panel-moods" role="tabpanel" className="mt-5">
          <ProgressCounter value={discoveredMoods} total={moods.length} label={copy.discovered} />
          {discoveredMoods === moods.length - 1 && <OneMorePill label={copy.oneMore} />}
          <div className="pm-mood-dex-head"><span aria-hidden="true">🎮</span><div><p>{locale === "id" ? "MOOD DEX JAMKACHU" : "JAMKACHU MOOD DEX"}</p><h3>{locale === "id" ? "Temukan semua ekspresi dari lingkungan nyata" : "Discover every expression through the real environment"}</h3></div></div>
          {/* Grid + detail split at >=800px (.pm-badge-layout — same shared
              class the Badges tab already established two-column with). */}
          <div className="pm-badge-layout">
          <ul className="pm-mood-dex-grid" aria-label={locale === "id" ? "Daftar suasana Jamkachu" : "Jamkachu mood list"}>
            {moods.map((mood, index) => {
              const discovered = mood.discovered || liveDiscoveredMoods.has(mood.mood);
              const selected = selectedMood?.mood === mood.mood;
              const isNew = discovered && !openedMoods.has(mood.mood);
              const category = MOOD_CATEGORY[mood.mood] ?? "comfort";
              const categoryHint = MOOD_CATEGORY_COPY[locale][category];
              // Locked cells always show the same generic padlock icon — the
              // designer's badge pack, not a mood-specific silhouette, so no
              // shape ever leaks which mood is behind the card.
              const iconFile = discovered ? (MOOD_ICON_FILE[mood.mood] ?? MOOD_LOCKED_ICON_FILE) : MOOD_LOCKED_ICON_FILE;
              return (
                <li key={mood.mood} className="pm-card-cascade" style={cascadeStyle(index)}>
                  <button
                    type="button"
                    className={`pm-mood-dex-slot${selected ? " active" : ""}${discovered ? " discovered" : " locked"}`}
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedMoodKey(mood.mood);
                      setPreview(null);
                      window.PMSfx?.play(discovered ? "tick" : "error");
                      // Opening a discovered mood's detail clears its NEW ribbon.
                      if (discovered) markMoodOpened(mood.mood);
                    }}
                  >
                    <span className={`pm-mood-dex-well${moodFlipping.has(mood.mood) ? " pm-badge-flip" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                      <img className="pm-mood-dex-icon" src={moodIconSrc(iconFile)} alt="" aria-hidden="true" draggable={false} />
                    </span>
                    <small>{discovered ? mood.label : `${categoryHint.icon} ${categoryHint.label}`}</small>
                    <b className={`pm-mood-dex-badge ${discovered ? "is-check" : "is-locked"}`} aria-hidden="true">{discovered ? "✓" : "🔒"}</b>
                    {isNew && <span className="pm-chip pm-mood-dex-ribbon">{copy.newBadge}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedMood && (() => {
            const discovered = selectedMood.discovered || liveDiscoveredMoods.has(selectedMood.mood);
            const category = MOOD_CATEGORY[selectedMood.mood] ?? "comfort";
            const categoryHint = MOOD_CATEGORY_COPY[locale][category];
            // The real Jamkachu sprite (four moods share the "plain" body —
            // MOOD_STATUS_CHIP tells them apart, same contract as mascot.tsx).
            const chip = MOOD_STATUS_CHIP[selectedMood.mood as PlantMood];
            const heroSpriteSrc = spriteAssetPath(spritePhase, MOOD_SPRITE[selectedMood.mood as PlantMood] ?? "plain");
            // Small reinforcement icon ties the hero back to the dex card's
            // art — this is also what fully disambiguates SoilAcidic from
            // SoilAlkaline here, since the big sprite + chip alone still
            // collide (both are the shared "plain" body + 🧪 chip).
            const badgeIconFile = MOOD_ICON_FILE[selectedMood.mood] ?? MOOD_LOCKED_ICON_FILE;
            const primaryLabel = locale === "id" ? selectedMood.labelId : selectedMood.labelEn;
            const secondaryLabel = locale === "id" ? selectedMood.labelEn : selectedMood.labelId;
            const sensorHint = MOOD_SENSOR_HINT[selectedMood.mood];
            return (
              <article className={`pm-mood-stage${discovered ? ` mood-${selectedMood.mood.toLowerCase()}` : " is-locked"}`}>
                <div className="pm-mood-stage-scene">
                  <span role="img" aria-label={discovered ? primaryLabel : copy.locked}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                    <img className={discovered ? "" : "is-silhouette"} src={heroSpriteSrc} alt="" aria-hidden="true" draggable={false} />
                    {discovered && chip && <span className="pm-mood-stage-chip" aria-hidden="true">{chip}</span>}
                    {discovered && (
                      <span className="pm-mood-stage-badge" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
                        <img src={moodIconSrc(badgeIconFile)} alt="" draggable={false} />
                      </span>
                    )}
                  </span>
                  <i aria-hidden="true">🌱</i>
                  <div>
                    <small>{discovered ? (locale === "id" ? "SUASANA DITEMUKAN" : "MOOD DISCOVERED") : copy.locked}</small>
                    <h3>{discovered ? primaryLabel : "???"}</h3>
                    {discovered && <small className="pm-mood-stage-altname">{secondaryLabel}</small>}
                  </div>
                </div>
                {discovered ? (
                  <div className="pm-mood-stage-info">
                    {/* Kid-facing one-liner naming the real sensor (honesty
                        rule) — above the plant-science why/action cards,
                        whose copy stays exactly as written. */}
                    {sensorHint && (
                      <p className="pm-mood-sensor-hint"><span aria-hidden="true">📡</span> {sensorHint[locale]}</p>
                    )}
                    {selectedMood.whyCard ? (
                      <>
                        <div className="pm-mood-lesson"><span>💡</span><div><small>{locale === "id" ? "KENAPA BEGITU?" : "WHY THIS MOOD?"}</small><h4>{selectedMood.whyCard.title}</h4><p>{selectedMood.whyCard.why}</p></div></div>
                        <div className="pm-mood-action"><span>🎯</span><div><small>{locale === "id" ? "AKSI AMAN" : "SAFE NEXT MOVE"}</small><p>{selectedMood.whyCard.action}</p></div></div>
                      </>
                    ) : (
                      <p>{locale === "id" ? "Pelajaran sensor akan muncul setelah tersedia." : "Its sensor lesson will appear when available."}</p>
                    )}
                    <button type="button" className="pm-btn pm-btn-primary w-full" onClick={() => { const reaction = MOOD_REACTIONS[selectedMood.mood]; if (reaction) playReward({ kind: "moods", emoji: selectedMood.emoji, title: selectedMood.label, line: reaction[locale], particles: reaction.particles }); }}>▶ {copy.tryIt}</button>
                  </div>
                ) : (
                  <div className="pm-mood-locked-copy">
                    <b aria-hidden="true">🔒</b>
                    <div>
                      <p className="pm-mood-locked-category">{categoryHint.icon} {categoryHint.label}</p>
                      <p>{locale === "id" ? "Mood ini akan terbuka saat sensor benar-benar melihat kondisi tersebut." : "This mood unlocks when the sensors truly observe that condition."}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })()}
          </div>
          {/* Completion callout placeholder — reuses the shared reward-pop
              styling/motion. The actual reward is engine-owned; this never
              grants XP/seeds, it only announces that one is coming. */}
          {discoveredMoods === moods.length && (
            <div className="pm-panel pm-reward-pop mt-4 text-center" role="status" style={{ borderColor: "var(--color-yellow)", background: "linear-gradient(180deg,#FFFDF1,#F4FAF1)" }}>
              <span className="text-3xl" aria-hidden="true">🏆</span>
              <p className="pm-heading mt-2 text-[10px]" style={{ color: "#A97B12" }}>{copy.moodComplete}</p>
              <p className="mt-1 text-sm leading-5" style={{ color: INK_MUTED }}>{copy.moodCompleteLine}</p>
            </div>
          )}
        </section>
      )}

      {tab === "badges" && (
        <section id="collection-panel-badges" role="tabpanel" className="mt-5">
          {unlockedBadges === badges.length - 1 && <OneMorePill label={copy.oneMore} />}
          {/* One-screen layout: wheel + detail side by side on desktop, and the
              wheel diameter is clamped to viewport height so the badges tab
              never needs a scroll to see both (nodes/labels are %-positioned,
              so the circle scales without breaking). */}
          <div className="pm-badge-layout">
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
                <div className="pm-badge-effect-row mx-auto mt-4 grid max-w-sm grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 border-[#D8C98B] bg-[#FFF9DC] p-3 text-left">
                  <span className="pm-badge-effect-icon grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#C99B32] bg-white text-xl" aria-hidden="true">{selectedEffect.particles.slice(0,2).map((particle, index) => <i className="not-italic" key={`${particle}-${index}`}>{particle}</i>)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="pm-heading text-[8px] text-[#A97B12]">{copy.reward}</p>
                    <p className="mt-1 text-sm font-bold">{selectedEffect.name[locale]}</p>
                    <p className="text-[11px]" style={{ color: INK_MUTED }}>{selectedEffect.particles.join(" · ")}</p>
                  </div>
                  <button type="button" disabled={!selectedBadgeUnlocked} onClick={toggleBadgeEffect} className={`pm-btn cursor-pointer px-3 py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-45 ${selectedEffectActive ? "pm-btn-danger" : "pm-btn-primary"}`} aria-pressed={selectedEffectActive}>
                    {selectedEffectActive ? copy.remove : selectedBadgeUnlocked ? copy.equip : `🔒 ${copy.locked}`}
                  </button>
                </div>
              )}
            </article>
          )}
          </div>
        </section>
      )}

      {tab === "story" && (
        <section id="collection-panel-story" role="tabpanel" className="mt-5">
          <ProgressCounter value={unlockedChapters} total={chapters.length} label={copy.chapters} />
          {unlockedChapters === chapters.length - 1 && <OneMorePill label={copy.oneMore} />}
          <div className="pm-story-book-head">
            <span aria-hidden="true">🗺️</span>
            <div><p>{locale === "id" ? "PERJALANAN JAMKACHU" : "JAMKACHU'S JOURNEY"}</p><h3>{locale === "id" ? "Pilih bab untuk membuka kenangan" : "Choose a chapter to revisit a memory"}</h3></div>
          </div>
          <ol className="pm-story-path" aria-label={locale === "id" ? "Peta bab cerita" : "Story chapter map"}>
            {chapters.map((chapter, index) => (
              <li key={chapter.chapter} className="pm-card-cascade" style={cascadeStyle(index)}>
                <button type="button" className={`pm-story-node${selectedChapter?.chapter === chapter.chapter ? " active" : ""}${chapter.unlocked ? " unlocked" : " locked"}`} aria-pressed={selectedChapter?.chapter === chapter.chapter} onClick={() => { setSelectedChapterNumber(chapter.chapter); setPreview(null); window.PMSfx?.play(chapter.unlocked ? "tick" : "error"); }}>
                  <span>{chapter.unlocked ? chapter.chapter : "🔒"}</span>
                  <small>{locale === "id" ? "BAB" : "CH"} {chapter.chapter}</small>
                </button>
              </li>
            ))}
          </ol>
          {selectedChapter && (
            <div className="pm-story-selected">
              <StoryChapterCard chapter={{ chapter: selectedChapter.chapter, title: selectedChapter.title, description: selectedChapter.description }} unlocked={selectedChapter.unlocked} scene={selectedChapter.scene} locale={locale} />
              {selectedChapter.unlocked && selectedChapter.scene && (
                <button type="button" className="pm-btn pm-btn-primary pm-story-replay w-full cursor-pointer text-[9px]" onClick={() => playReward({ kind: "story", emoji: selectedChapter.chapter >= 5 ? "🎆" : "🌱", title: selectedChapter.title, line: selectedChapter.scene?.lines.find((line) => line.speaker === "plant")?.text ?? selectedChapter.description, particles: ["✨", "📖", "💚"] })}>
                  🎬 {copy.replay}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "wisdom" && (
        <section id="collection-panel-wisdom" role="tabpanel" className="mt-5">
          <div className="pm-wisdom-hero" role="status">
            <span className="pm-wisdom-hero-icon" aria-hidden="true">🎮</span>
            <div><b>{locale === "id" ? "PILIH MISI TANAMAN" : "PICK A PLANT MISSION"}</b><p>{locale === "id" ? "Baca petunjuk singkat → pilih jawaban → dapatkan umpan balik." : "Read the clue → pick an answer → get instant feedback."}</p></div>
          </div>
          <ProgressCounter value={wisdomMastered.size} total={wisdom.length} label={copy.learned} />
          {wisdomMastered.size === wisdom.length - 1 && <OneMorePill label={copy.oneMore} />}
          <ul className="pm-wisdom-grid">
            {wisdom.map((entry, index) => (
              <li
                key={entry.id}
                className="pm-panel pm-wisdom-card pm-card-cascade"
                style={{ borderColor: "#A9D2F2", ...cascadeStyle(index) }}
              >
                <div className="pm-wisdom-card-head">
                  <span className={`pm-wisdom-number${wisdomMastered.has(entry.id) ? " is-mastered" : ""}`}>{wisdomMastered.has(entry.id) ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <span className="pm-wisdom-metric" role="img" aria-hidden="true">{wisdomMetricIcon(entry.metric)}</span>
                </div>
                <p className="pm-wisdom-saying">“{entry.saying}”</p>
                <button type="button" className="pm-btn pm-btn-primary mt-3 w-full min-h-11 cursor-pointer text-[9px]" onClick={() => { setWisdomTrial(entry.id); setWisdomAnswer(null); window.PMSfx?.play("tick"); }}>
                  🎯 {copy.challenge}
                </button>
                <details className="pm-wisdom-details">
                  <summary>💡 {locale === "id" ? "Lihat penjelasan" : "See the why"}</summary>
                  <p>{entry.translation}</p>
                  <div className="pm-wisdom-clue"><span aria-hidden="true">🧩</span><p>{entry.example}</p></div>
                  <small>{copy.wisdomSource}</small>
                </details>
                {wisdomTrial === entry.id && WISDOM_TRIALS[entry.id] && (
                  <div className="pm-wisdom-trial mt-3 rounded-xl border-2 border-[#A9D2F2] bg-[#EEF8FF] p-3" aria-live="polite">
                    <div className="pm-wisdom-trial-label">⚡ {locale === "id" ? "CEPAT, PILIH!" : "QUICK PICK!"}</div><p className="mt-1 text-sm font-bold leading-5">{WISDOM_TRIALS[entry.id].prompt[locale]}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {WISDOM_TRIALS[entry.id].choices[locale].map((choice, choiceIndex) => {
                        const answered = wisdomAnswer !== null;
                        const correct = choiceIndex === WISDOM_TRIALS[entry.id].answer;
                        return <button key={choice} type="button" disabled={answered} onClick={() => { setWisdomAnswer(choiceIndex); window.PMSfx?.play(correct ? "coin" : "tick"); if (correct) setWisdomMastered((prev) => { if (prev.has(entry.id)) return prev; const next = new Set(prev).add(entry.id); persistWisdomMastered(next); return next; }); }} className="min-h-11 cursor-pointer rounded-xl border-2 px-3 py-2 text-xs font-semibold disabled:cursor-default" style={answered && correct ? { borderColor: "#397A2B", background: "#E8F6E0", color: "#397A2B" } : answered && choiceIndex === wisdomAnswer ? { borderColor: "#D66B6B", background: "#FFE9E9", color: "#A03030" } : { borderColor: "#A9D2F2", background: "#fff" }}>{choice}</button>;
                      })}
                    </div>
                    {wisdomAnswer !== null && (
                      <div className="mt-3 text-xs leading-5">
                        <p className="font-bold" style={{ color: wisdomAnswer === WISDOM_TRIALS[entry.id].answer ? "#397A2B" : "#A03030" }}>{wisdomAnswer === WISDOM_TRIALS[entry.id].answer ? copy.correct : copy.wrong}</p>
                        <p className="mt-1" style={{ color: INK_MUTED }}>{entry.example}</p>
                        {wisdomAnswer !== WISDOM_TRIALS[entry.id].answer && <button type="button" className="mt-2 cursor-pointer font-bold underline" onClick={() => setWisdomAnswer(null)}>{copy.tryIt}</button>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
