// Quests screen (handoff §33) — active quest cards with live time progress
// plus completed/expired history. Mobile-first companion feel, not a
// dashboard. Styled in the farm design language (public/farm) via the shared
// pm-* shell utilities: white surface panels, pixel headings, yellow XP chips.

import type { CSSProperties } from "react";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import QuestCelebration from "@/components/quest-celebration";
import QuestDonePill from "@/components/quest-done-pill";
import QuestProgress from "@/components/quest-progress";
import CheatQuestPanel, { type CheatQuestItem } from "@/components/cheat-quest-panel";
import QuestHeroStages from "@/components/quest-hero-stages";
import { getCropProfile, type CropProfile } from "@/lib/crop-profiles";
import { getPlant } from "@/lib/queries";
import { QUEST_WHY, WHY_CARDS } from "@/game/education/why-cards";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getActiveQuests, getQuestHistory } from "@/game/quests/quest-engine";
import { getDailyEvent, type DailyEvent } from "@/game/random/daily-events";
import { getServerSupabase } from "@/lib/supabase/server";
import { DAILY_EVENT_COPY_ID, MOOD_COPY, QUEST_COPY_ID, type AppLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { maybeScheduleGameTick } from "@/lib/tick-gate";
import { MOOD_LABELS } from "@/types/events";
import { STREAK_TIMEZONE, type QuestKey, type QuestRow, type QuestStatus } from "@/types/game";

// Quest timing is timestamp-based — always render fresh from Supabase.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

function formatWhen(iso: string | null, locale: AppLocale): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: STREAK_TIMEZONE,
  }).format(new Date(ms));
}

// Farm-palette chip tints (inline styles win over the unlayered .pm-chip base
// in globals.css — Tailwind color utilities would lose that cascade fight).

/** XP pills: --color-yellow with the amber frame the farm uses for rewards. */
const XP_CHIP_STYLE: CSSProperties = {
  background: "var(--color-yellow)",
  borderColor: "#E8C46B",
  color: "#6B4F10",
};

/** Dashed tinted well (farm --color-bg) for secondary copy inside cards. */
const WELL_STYLE: CSSProperties = {
  background: "var(--color-bg)",
  border: "2px dashed var(--color-border)",
  color: "#555555",
};

const FALLBACK_PILL: { label: string; style: CSSProperties } = {
  label: "Expired",
  style: { background: "var(--color-bg)", borderColor: "var(--color-border)", color: "#6B7A66" },
};

const STATUS_PILL: Partial<Record<QuestStatus, { label: string; style: CSSProperties }>> = {
  COMPLETED: {
    label: "✓ Done",
    style: { background: "#E4F4DD", borderColor: "var(--color-grass)", color: "var(--color-forest)" },
  },
  EXPIRED: FALLBACK_PILL,
  FAILED: {
    label: "Failed",
    style: { background: "#FFE3E3", borderColor: "#E8A0A0", color: "#A03030" },
  },
};

function ActiveQuestCard({ quest, locale, featured = false, cropProfile = null }: { quest: QuestRow; locale: AppLocale; featured?: boolean; cropProfile?: CropProfile | null }) {
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const localized = locale === "id" ? QUEST_COPY_ID[quest.quest_key] : def;
  const verifying = quest.status === "VERIFYING" && quest.verifying_since != null;
  const target = def.verifyTemperatureMax != null ? `≤ ${def.verifyTemperatureMax}°C`
    : def.verifyHumidityMin != null ? `≥ ${def.verifyHumidityMin}% RH`
      : def.verifyPhRange ? `pH ${def.verifyPhRange.min}–${def.verifyPhRange.max}`
        : locale === "id" ? "Kondisi nyaman dan stabil" : "Comfortable and stable";

  return (
    // Active quests get the grass-green border accent — same white surface
    // family as every farm panel, but clearly "alive" next to history rows.
    <article className={`pm-panel ${featured ? "pm-quest-hero" : "pm-quest-side"}${verifying ? " is-verifying" : ""}`}>
      <div className="pm-quest-ribbon">{featured ? (locale === "id" ? "MISI UTAMA" : "HERO MISSION") : (locale === "id" ? "MISI SAMPINGAN" : "SIDE MISSION")}</div>
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" role="img" aria-hidden="true">
          {def.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="pm-heading text-xs">{localized.title}</h2>
            <span className="pm-chip shrink-0" style={XP_CHIP_STYLE}>
              +{quest.xp_reward} XP
            </span>
          </div>
          {!featured && (
            <p className="mt-2 text-sm leading-6" style={{ color: "#555555" }}>
              {localized.description}
            </p>
          )}
        </div>
      </div>

      {/* Stage row + its copy live in a client island: the cheat sandbox drives
          them off the board and the sensor editor, since the Supabase quest row
          they otherwise read can never move during a classroom demo. With the
          sandbox off it renders the real status, exactly as before. */}
      {featured && (
        <QuestHeroStages
          questKey={quest.quest_key}
          questStatus={verifying ? "VERIFYING" : quest.status}
          locale={locale}
          description={localized.description}
          target={target}
          cropProfile={cropProfile}
        />
      )}

      {quest.status === "ACTIVE" && def.kind === "maintain" && (
        <QuestProgress
          mode="maintain"
          sinceIso={quest.started_at}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
          questId={quest.id}
          locale={locale}
        />
      )}

      {verifying && (
        <QuestProgress
          mode="verifying"
          sinceIso={quest.verifying_since as string}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
          questId={quest.id}
          locale={locale}
        />
      )}

      {quest.status === "ACTIVE" && def.kind === "recovery" && (
        <p className="mt-3 rounded-xl px-3 py-2 text-xs font-medium leading-5" style={WELL_STYLE}>
          {locale === "id"
            ? `Masih ${MOOD_COPY.id[def.triggerMood]} — setelah kondisinya membaik, sensor akan memeriksa kestabilan selama ${Math.round(def.requiredSeconds / 60)} menit.`
            : `Still ${MOOD_LABELS[def.triggerMood]} — once I feel better, a ${Math.round(def.requiredSeconds / 60)}-minute check confirms the rescue.`}
        </p>
      )}

      {/* Educational layer (handoff §2, §51): teach the science behind the
          quest, not just the reward. Collapsible so the card stays compact. */}
      <details className="pm-quest-why mt-3">
        <summary
          className="font-pixel cursor-pointer select-none text-[10px] leading-relaxed hover:underline"
          style={{ color: "var(--color-forest)" }}
        >
          {locale === "id" ? "Mengapa ini penting" : "Why this matters"}
        </summary>
        <div className="mt-2 rounded-xl px-3 py-2 text-xs leading-5" style={WELL_STYLE}>
          <p>{locale === "id" ? QUEST_COPY_ID[quest.quest_key].why : QUEST_WHY[quest.quest_key]}</p>
          {locale === "en" && <p className="mt-1.5">{WHY_CARDS[def.triggerMood].why}</p>}
        </div>
      </details>
    </article>
  );
}

/**
 * "Today's Event" banner — deterministic per (plant, WIB day), so this server
 * component renders the same event on every request today with no hydration
 * concerns. Challenges show their reward; boosts show their multiplier;
 * flavor days are dialogue-only and show no pill.
 *
 * Keeps its amber identity (the farm home's "verifying" amber family:
 * #FFF7DF / #E8C46B / #7A5B12) inside the standard pixel panel frame.
 */
function DailyEventBanner({ event, locale }: { event: DailyEvent; locale: AppLocale }) {
  const localized = locale === "id" ? DAILY_EVENT_COPY_ID[event.id] : null;
  const pill =
    event.kind === "daily_challenge" && event.challengeXp
      ? `+${event.challengeXp} XP`
      : event.kind === "xp_boost" && event.xpMultiplier
        ? locale === "id" ? `×${event.xpMultiplier} XP misi hari ini` : `×${event.xpMultiplier} quest XP today`
        : null;

  return (
    <section
      aria-label="Today's event"
      className="pm-panel pm-daily-event mt-5 mb-4"
      style={{ background: "#FFF7DF", borderColor: "#E8C46B" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" role="img" aria-hidden="true">
          {event.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-pixel text-[10px] uppercase leading-relaxed" style={{ color: "#A97B12" }}>
              {locale === "id" ? "Acara Hari Ini" : "Today's Event"}
            </p>
            {pill && (
              <span className="pm-chip shrink-0" style={XP_CHIP_STYLE}>
                {pill}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold" style={{ color: "#7A5B12" }}>
            {localized?.name ?? event.name}
          </p>
          <p className="mt-0.5 text-xs leading-5" style={{ color: "#555555" }}>
            {localized?.description ?? event.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function HistoryItem({ quest, locale }: { quest: QuestRow; locale: AppLocale }) {
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const localized = locale === "id" ? QUEST_COPY_ID[quest.quest_key] : def;
  const defaultPill = STATUS_PILL[quest.status] ?? FALLBACK_PILL;
  const pill = locale === "id"
    ? { ...defaultPill, label: quest.status === "COMPLETED" ? "✓ Selesai" : quest.status === "FAILED" ? "Gagal" : "Kedaluwarsa" }
    : defaultPill;
  const when = formatWhen(quest.completed_at ?? quest.expired_at ?? quest.created_at, locale);

  return (
    // History rows share the panel family, compacted — sprout border (not
    // grass) keeps them visually quieter than active quests.
    <li className="pm-panel flex items-center gap-3" style={{ padding: "12px 16px" }}>
      <span className="text-2xl leading-none" role="img" aria-hidden="true">
        {def.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{localized.title}</p>
        <p className="mt-0.5 text-xs" style={{ color: "#777777" }}>
          {when ?? "—"}
          {quest.status === "COMPLETED" && <span> · +{quest.xp_reward} XP</span>}
        </p>
      </div>
      {quest.status === "COMPLETED" ? (
        // Only a COMPLETED pill ever reads the just-completed flag (see
        // quest-progress.tsx's sweep() and .pm-done-pill-stamp in
        // globals.css) — other statuses never get a stamped entrance.
        <QuestDonePill questId={quest.id} label={pill.label} style={pill.style} />
      ) : (
        <span className="pm-chip shrink-0" style={pill.style}>
          {pill.label}
        </span>
      )}
    </li>
  );
}

export default async function QuestsPage() {
  const locale = await getRequestLocale();
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        locale={locale}
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
  // the response (lib/tick-gate.ts); QuestCelebration's realtime channel and
  // the next navigation surface its completions.
  maybeScheduleGameTick(PLANT_ID);

  // The active crop profile carries the thresholds the engine verifies against
  // (same source as /monitoring). The hero card hands it to the client island
  // so a sandbox sensor edit is judged by the plant's real numbers, not a
  // default. Never fatal: null falls back to the default profile.
  let cropProfile: CropProfile | null = null;

  let active: QuestRow[];
  let history: QuestRow[];
  try {
    const [quests, past, plant] = await Promise.all([
      getActiveQuests(supabase, PLANT_ID),
      getQuestHistory(supabase, PLANT_ID, 20),
      getPlant(supabase, PLANT_ID).catch(() => null),
    ]);
    active = quests;
    history = past;
    if (plant?.status === "ok") cropProfile = getCropProfile(plant.plant.crop_profile_key ?? null);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        locale={locale}
        title="Couldn't load quests"
        lines={[message, "Check that supabase/milestone3.sql has been run."]}
      />
    );
  }

  // Cheat quest board (feature 4): localized titles for every quest so the
  // presenter can jump stages. Client panel self-hides unless the sandbox is on.
  const cheatKeys = Object.keys(QUEST_DEFINITIONS) as QuestKey[];
  const cheatTitleFor = (key: QuestKey) =>
    locale === "id" ? QUEST_COPY_ID[key].title : QUEST_DEFINITIONS[key].title;
  // BALANCE_SOIL_ACIDIC and BALANCE_SOIL_ALKALINE deliberately share the title
  // "Balance My Soil" — a player only ever sees the one that triggered. The
  // board lists ALL of them at once, so identical rows left the presenter
  // guessing which was which; the trigger mood is what actually separates them.
  const cheatTitleCounts = new Map<string, number>();
  for (const key of cheatKeys) {
    const title = cheatTitleFor(key);
    cheatTitleCounts.set(title, (cheatTitleCounts.get(title) ?? 0) + 1);
  }
  const cheatQuests: CheatQuestItem[] = cheatKeys.map((key) => {
    const title = cheatTitleFor(key);
    return {
      key,
      title: (cheatTitleCounts.get(title) ?? 0) > 1
        ? `${title} · ${QUEST_DEFINITIONS[key].triggerMood}`
        : title,
      emoji: QUEST_DEFINITIONS[key].emoji,
      xp: QUEST_DEFINITIONS[key].xpReward,
    };
  });

  // Measure/padding come from the shell contract (.reno-route-content > main).
  return (
    <main className="mx-auto w-full flex-1">
      {/* Realtime completion banner (dopamine spec §3) — presentation-only
          island; the server snapshot below primes it so old history never
          celebrates on load. */}
      <QuestCelebration
        plantId={PLANT_ID}
        locale={locale}
        initialStatuses={[...active, ...history].map((quest) => ({
          id: quest.id,
          status: quest.status,
        }))}
      />
      <PageHeader
        icon="🎯"
        eyebrow={locale === "id" ? "Perawatan hari ini" : "Today's care"}
        title={locale === "id" ? "Misi" : "Quests"}
        description={locale === "id"
          ? "Perawatan nyata yang diverifikasi sensor — bukan sekadar menekan tombol."
          : "Real care, verified by sensors — no tap-to-win."}
      />

      <CheatQuestPanel locale={locale} quests={cheatQuests} />

      <section aria-label="Active quests" className="flex flex-col gap-3">
        {active.length === 0 ? (
          <div className="pm-panel text-center">
            <span className="text-3xl" role="img" aria-hidden="true">
              🌿
            </span>
            <p className="mt-2 text-sm font-medium">
              {locale === "id" ? "Belum ada misi aktif — tanaman sedang nyaman." : "No active quest right now — I'm just vibing."}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#777777" }}>
              {locale === "id" ? "Misi baru muncul saat kondisi tanaman berubah." : "A new quest appears when my mood changes."}
            </p>
          </div>
        ) : (
          active.map((quest, index) => <ActiveQuestCard key={quest.id} quest={quest} locale={locale} featured={index === 0} cropProfile={cropProfile} />)
        )}
      </section>

      <DailyEventBanner event={getDailyEvent(PLANT_ID)} locale={locale} />

      <details className="pm-quest-history-more mt-6">
        <summary>{locale === "id" ? `BUKA BUKU MISI · ${history.length}` : `OPEN MISSION BOOK · ${history.length}`}</summary>
        <section aria-label="Quest history" className="mt-3">
        {history.length === 0 ? (
          <p className="pm-panel text-center text-sm" style={{ color: "#777777" }}>
            {locale === "id" ? "Belum ada misi selesai — cerita kita segera dimulai!" : "No completed quests yet — our story starts soon!"}
          </p>
        ) : (
          <>
          <ul className="flex flex-col gap-2">
            {history.slice(0, 3).map((quest) => (
              <HistoryItem key={quest.id} quest={quest} locale={locale} />
            ))}
          </ul>
          {history.length > 3 && <details className="pm-quest-history-more mt-3"><summary>{locale === "id" ? `LIHAT ${history.length - 3} RIWAYAT LAINNYA` : `VIEW ${history.length - 3} MORE ADVENTURES`}</summary><ul className="mt-3 flex flex-col gap-2">{history.slice(3).map((quest) => <HistoryItem key={quest.id} quest={quest} locale={locale} />)}</ul></details>}
          </>
        )}
        </section>
      </details>
    </main>
  );
}
