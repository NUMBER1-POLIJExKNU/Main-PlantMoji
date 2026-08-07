// Collection book (handoff §20, §33, Phase 13) — Mood / Badges / Story tabs.
// No dedicated collection table: everything is derived from event history,
// plant_badges, and bond_state.current_chapter.

import CollectionTabs, {
  type BadgeCollectionItem,
  type MoodCollectionItem,
  type StoryCollectionItem,
} from "@/components/collection-tabs";
import Notice from "@/components/notice";
import { BADGE_DEFINITIONS } from "@/game/badges/badge-definitions";
import { runGameTick } from "@/game/events/event-router";
import { getBondState } from "@/game/progression/xp-engine";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { getSeenMoods, getUnlockedBadges } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { MOOD_LABELS, PLANT_MOODS, type PlantMood } from "@/types/events";
import { STREAK_TIMEZONE } from "@/types/game";

// Discovery state changes with live events — always render fresh.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

/** Mirrors the mood emojis used on the home screen (plant-home.tsx). */
const MOOD_EMOJI: Record<PlantMood, string> = {
  Happy: "😊",
  Overheating: "🔥",
  DryAir: "💨",
  Sleepy: "🌙",
  SoilAcidic: "🧪",
  SoilAlkaline: "🧪",
};

const unlockDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: STREAK_TIMEZONE,
});

export default async function CollectionPage() {
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase 환경 변수가 아직 설정되지 않았습니다.",
          ".env.local.example을 .env.local로 복사한 뒤 값을 채우고 dev 서버를 재시작하세요.",
          "자세한 순서: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  // Lazy timestamp sweep FIRST (handoff Correction 4): pending badge and
  // chapter unlocks land on page load, not on a server timer. Never let a
  // sweep failure break rendering.
  try {
    await runGameTick(PLANT_ID);
  } catch (cause) {
    console.error(`CollectionPage runGameTick(${PLANT_ID}) failed:`, cause);
  }

  let seenMoods: PlantMood[];
  let badgeRows: Awaited<ReturnType<typeof getUnlockedBadges>>;
  let currentChapter: number;
  try {
    const [moods, badges, bond] = await Promise.all([
      getSeenMoods(supabase, PLANT_ID),
      getUnlockedBadges(supabase, PLANT_ID),
      getBondState(supabase, PLANT_ID),
    ]);
    seenMoods = moods;
    badgeRows = badges;
    currentChapter = bond?.current_chapter ?? 1;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        title="컬렉션을 불러오지 못했습니다"
        lines={[message, "supabase/milestone3.sql이 실행되었는지 확인해 주세요."]}
      />
    );
  }

  const moods: MoodCollectionItem[] = PLANT_MOODS.map((mood) => ({
    mood,
    label: MOOD_LABELS[mood],
    emoji: MOOD_EMOJI[mood],
    discovered: seenMoods.includes(mood),
  }));

  const badges: BadgeCollectionItem[] = Object.values(BADGE_DEFINITIONS).map((definition) => {
    const row = badgeRows.find((badge) => badge.badge_key === definition.key);
    const unlockedMs = row ? Date.parse(row.unlocked_at) : Number.NaN;
    return {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      emoji: definition.emoji,
      unlockedLabel:
        row != null
          ? Number.isNaN(unlockedMs)
            ? "" // unlocked but with an unparsable date — still shows as unlocked
            : unlockDateFormat.format(new Date(unlockedMs))
          : null,
    };
  });

  const chapters: StoryCollectionItem[] = CHAPTER_DEFINITIONS.map((definition) => ({
    chapter: definition.chapter,
    title: definition.title,
    description: definition.description,
    unlocked: definition.chapter <= currentChapter,
  }));

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-10">
      <header className="mb-6 flex flex-col items-center gap-1 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          📖
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Collection
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Everything we&apos;ve discovered together.
        </p>
      </header>

      <CollectionTabs moods={moods} badges={badges} chapters={chapters} />
    </main>
  );
}
