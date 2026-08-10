// Collection book (handoff §20, §33, Phase 13) — Mood / Badges / Story /
// Wisdom tabs. No dedicated collection table: everything is derived from
// event history, plant_badges, bond_state.current_chapter, and the static
// education catalogs (why-cards, farmer wisdom).

import CollectionTabs, {
  type BadgeCollectionItem,
  type MoodCollectionItem,
  type StoryCollectionItem,
  type WisdomCollectionItem,
} from "@/components/collection-tabs";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import { BADGE_DEFINITIONS } from "@/game/badges/badge-definitions";
import { FARMER_WISDOM } from "@/game/education/farmer-wisdom";
import { WHY_CARDS } from "@/game/education/why-cards";
import { getBondState } from "@/game/progression/xp-engine";
import { CHAPTER_DEFINITIONS } from "@/game/story/story-definitions";
import { getChapterScene } from "@/game/story/story-dialogue";
import { getSeenMoods, getUnlockedBadges } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { BADGE_COPY_ID, MOOD_COPY, MOOD_EDUCATION_ID } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { maybeScheduleGameTick } from "@/lib/tick-gate";
import { MOOD_LABELS, PLANT_MOODS, type PlantMood } from "@/types/events";
import { STREAK_TIMEZONE, normalizePersonality } from "@/types/game";

// Discovery state changes with live events — always render fresh.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

/** Mirrors the mood emojis used on the home screen (plant-home.tsx). */
const MOOD_EMOJI: Record<PlantMood, string> = {
  Happy: "😊",
  Overheating: "🔥",
  TooCold: "🥶",
  DryAir: "💨",
  HumidAir: "🌫️",
  Sleepy: "🌙",
  SoilAcidic: "🧪",
  SoilAlkaline: "🧪",
};

export default async function CollectionPage() {
  const locale = await getRequestLocale();
  const unlockDateFormat = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: STREAK_TIMEZONE,
  });
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase environment variables are not set yet.",
          "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
          "Full steps: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  // Lazy timestamp sweep (handoff Correction 4), deferred: awaiting it here
  // blocked every render on the engine's Supabase sweep. It now runs after
  // the response (lib/tick-gate.ts); pending badge/chapter unlocks surface
  // via realtime and on the next navigation.
  maybeScheduleGameTick(PLANT_ID);

  let seenMoods: PlantMood[];
  let badgeRows: Awaited<ReturnType<typeof getUnlockedBadges>>;
  let currentChapter: number;
  let plantName = "Sprout";
  let personality = normalizePersonality(null);
  try {
    const [moods, badges, bond, plantRes] = await Promise.all([
      getSeenMoods(supabase, PLANT_ID),
      getUnlockedBadges(supabase, PLANT_ID),
      getBondState(supabase, PLANT_ID),
      supabase.from("plants").select("name, personality").eq("id", PLANT_ID).maybeSingle(),
    ]);
    seenMoods = moods;
    badgeRows = badges;
    currentChapter = bond?.current_chapter ?? 1;
    if (plantRes.data?.name) plantName = plantRes.data.name as string;
    personality = normalizePersonality(plantRes.data?.personality);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        title="Couldn't load the collection"
        lines={[message, "Check that supabase/milestone3.sql has been run."]}
      />
    );
  }

  const moods: MoodCollectionItem[] = PLANT_MOODS.map((mood) => {
    const discovered = seenMoods.includes(mood);
    return {
      mood,
      label: locale === "id" ? MOOD_COPY.id[mood] : MOOD_LABELS[mood],
      emoji: MOOD_EMOJI[mood],
      discovered,
      // The science card unlocks with discovery — undiscovered moods never
      // ship their explanation to the client (handoff §20: collect to learn).
      whyCard: discovered ? (locale === "id" ? MOOD_EDUCATION_ID[mood] : WHY_CARDS[mood]) : null,
    };
  });

  const wisdom: WisdomCollectionItem[] = FARMER_WISDOM.map((entry) => ({
    id: entry.id,
    saying: locale === "id" ? entry.sayingId ?? entry.saying : entry.saying,
    source: entry.source,
    translation: locale === "id" ? entry.translationId ?? entry.translation : entry.translation,
    metric: entry.sensorLink.metric,
    example:
      locale === "id"
        ? entry.sensorLink.exampleId ?? entry.sensorLink.example
        : entry.sensorLink.example,
  }));

  const badges: BadgeCollectionItem[] = Object.values(BADGE_DEFINITIONS).map((definition) => {
    const row = badgeRows.find((badge) => badge.badge_key === definition.key);
    const unlockedMs = row ? Date.parse(row.unlocked_at) : Number.NaN;
    return {
      key: definition.key,
      name: locale === "id" ? BADGE_COPY_ID[definition.key].name : definition.name,
      description: locale === "id" ? BADGE_COPY_ID[definition.key].description : definition.description,
      emoji: definition.emoji,
      unlockedLabel:
        row != null
          ? Number.isNaN(unlockedMs)
            ? "" // unlocked but with an unparsable date — still shows as unlocked
            : unlockDateFormat.format(new Date(unlockedMs))
          : null,
    };
  });

  const chapters: StoryCollectionItem[] = CHAPTER_DEFINITIONS.map((definition) => {
    const unlocked = definition.chapter <= currentChapter;
    // Locked chapters never compute their scene — keeps future story
    // spoiler-free on the wire.
    const scene = unlocked ? getChapterScene(definition.chapter, personality, plantName) : null;
    return {
      chapter: definition.chapter,
      title: locale === "id" ? definition.titleId ?? definition.title : definition.title,
      description:
        locale === "id" ? definition.descriptionId ?? definition.description : definition.description,
      unlocked,
      // Localized here (page level) so StoryChapterCard stays dumb and keeps
      // reading `line.text` unchanged — .textId is folded into .text before
      // the scene ever reaches the component tree.
      scene:
        scene && locale === "id"
          ? { ...scene, lines: scene.lines.map((line) => ({ ...line, text: line.textId ?? line.text })) }
          : scene,
    };
  });

  // Sizing/backdrop comes from the farm shell contract: .reno-route-content
  // centers this <main> at 720px directly on the sky, and .pm-panel cards
  // inside supply the surfaces.
  return (
    <main className="pm-collection w-full">
      <PageHeader
        icon="🏆"
        eyebrow={locale === "id" ? "Buku penemuan" : "Discovery book"}
        title={locale === "id" ? "Koleksi" : "Collection"}
        description={locale === "id"
          ? "Semua yang sudah kita temukan bersama."
          : "Everything we've discovered together."}
      />

      <CollectionTabs locale={locale} moods={moods} badges={badges} chapters={chapters} wisdom={wisdom} />
    </main>
  );
}
