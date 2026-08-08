// Quests screen (handoff §33) — active quest cards with live time progress
// plus completed/expired history. Mobile-first companion feel, not a
// dashboard. Styled in the farm design language (public/farm) via the shared
// pm-* shell utilities: white surface panels, pixel headings, yellow XP chips.

import type { CSSProperties } from "react";
import Notice from "@/components/notice";
import QuestCelebration from "@/components/quest-celebration";
import QuestProgress from "@/components/quest-progress";
import { QUEST_WHY, WHY_CARDS } from "@/game/education/why-cards";
import { runGameTick } from "@/game/events/event-router";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getActiveQuests, getQuestHistory } from "@/game/quests/quest-engine";
import { getDailyEvent, type DailyEvent } from "@/game/random/daily-events";
import { getServerSupabase } from "@/lib/supabase/server";
import { DAILY_EVENT_COPY_ID, MOOD_COPY, QUEST_COPY_ID, type AppLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { MOOD_LABELS } from "@/types/events";
import { STREAK_TIMEZONE, type QuestRow, type QuestStatus } from "@/types/game";

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

function ActiveQuestCard({ quest, locale }: { quest: QuestRow; locale: AppLocale }) {
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const localized = locale === "id" ? QUEST_COPY_ID[quest.quest_key] : def;
  const verifying = quest.status === "VERIFYING" && quest.verifying_since != null;

  return (
    // Active quests get the grass-green border accent — same white surface
    // family as every farm panel, but clearly "alive" next to history rows.
    <article className="pm-panel" style={{ borderColor: "var(--color-grass)" }}>
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
          <p className="mt-2 text-sm leading-6" style={{ color: "#555555" }}>
            {localized.description}
          </p>
        </div>
      </div>

      {quest.status === "ACTIVE" && def.kind === "maintain" && (
        <QuestProgress
          mode="maintain"
          sinceIso={quest.started_at}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
          locale={locale}
        />
      )}

      {verifying && (
        <QuestProgress
          mode="verifying"
          sinceIso={quest.verifying_since as string}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
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
      <details className="mt-3">
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
        ? `×${event.xpMultiplier} quest XP today`
        : null;

  return (
    <section
      aria-label="Today's event"
      className="pm-panel mb-4"
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
      <span className="pm-chip shrink-0" style={pill.style}>
        {pill.label}
      </span>
    </li>
  );
}

export default async function QuestsPage() {
  const locale = await getRequestLocale();
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

  // Lazy timestamp sweep FIRST (handoff Correction 4): time-based quest
  // completions land on page load, not on a server timer. Never let a sweep
  // failure break rendering.
  try {
    await runGameTick(PLANT_ID);
  } catch {
    // Ignored — the page still renders current quest state.
  }

  let active: QuestRow[];
  let history: QuestRow[];
  try {
    [active, history] = await Promise.all([
      getActiveQuests(supabase, PLANT_ID),
      getQuestHistory(supabase, PLANT_ID, 20),
    ]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        title="Couldn't load quests"
        lines={[message, "Check that supabase/milestone3.sql has been run."]}
      />
    );
  }

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
      <header className="mb-6 flex flex-col gap-2">
        <span className="text-4xl" role="img" aria-hidden="true">
          🎯
        </span>
        <h1 className="pm-heading text-lg">{locale === "id" ? "Misi" : "Quests"}</h1>
        <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.75 }}>
          {locale === "id" ? "Perawatan nyata yang diverifikasi sensor — bukan sekadar menekan tombol." : "Real care, verified by sensors — no tap-to-win."}
        </p>
      </header>

      <DailyEventBanner event={getDailyEvent(PLANT_ID)} locale={locale} />

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
          active.map((quest) => <ActiveQuestCard key={quest.id} quest={quest} locale={locale} />)
        )}
      </section>

      <section aria-label="Quest history" className="mt-8">
        <h2 className="pm-heading mb-3 text-xs uppercase tracking-wide">
          {locale === "id" ? "Riwayat" : "History"}
        </h2>
        {history.length === 0 ? (
          <p className="pm-panel text-center text-sm" style={{ color: "#777777" }}>
            {locale === "id" ? "Belum ada misi selesai — cerita kita segera dimulai!" : "No completed quests yet — our story starts soon!"}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((quest) => (
              <HistoryItem key={quest.id} quest={quest} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
