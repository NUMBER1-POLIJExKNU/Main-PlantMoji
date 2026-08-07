// Quests screen (handoff §33) — active quest cards with live time progress
// plus completed/expired history. Mobile-first companion feel, not a
// dashboard.

import Notice from "@/components/notice";
import QuestProgress from "@/components/quest-progress";
import { QUEST_WHY, WHY_CARDS } from "@/game/education/why-cards";
import { runGameTick } from "@/game/events/event-router";
import { QUEST_DEFINITIONS } from "@/game/quests/quest-definitions";
import { getActiveQuests, getQuestHistory } from "@/game/quests/quest-engine";
import { getServerSupabase } from "@/lib/supabase/server";
import { MOOD_LABELS } from "@/types/events";
import { STREAK_TIMEZONE, type QuestRow, type QuestStatus } from "@/types/game";

// Quest timing is timestamp-based — always render fresh from Supabase.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

const historyDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: STREAK_TIMEZONE,
});

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return historyDateFormat.format(new Date(ms));
}

const FALLBACK_PILL = {
  label: "Expired",
  className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_PILL: Partial<Record<QuestStatus, { label: string; className: string }>> = {
  COMPLETED: {
    label: "✓ Done",
    className: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300",
  },
  EXPIRED: FALLBACK_PILL,
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  },
};

function ActiveQuestCard({ quest }: { quest: QuestRow }) {
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const verifying = quest.status === "VERIFYING" && quest.verifying_since != null;

  return (
    <article className="rounded-2xl border border-green-200/70 bg-green-50/80 p-5 shadow-sm dark:border-green-900/60 dark:bg-green-950/40">
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" role="img" aria-hidden="true">
          {def.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {def.title}
            </h2>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              +{quest.xp_reward} XP
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
            {def.description}
          </p>
        </div>
      </div>

      {quest.status === "ACTIVE" && def.kind === "maintain" && (
        <QuestProgress
          mode="maintain"
          sinceIso={quest.started_at}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
        />
      )}

      {verifying && (
        <QuestProgress
          mode="verifying"
          sinceIso={quest.verifying_since as string}
          requiredSeconds={def.requiredSeconds}
          plantId={PLANT_ID}
        />
      )}

      {quest.status === "ACTIVE" && def.kind === "recovery" && (
        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
          Still {MOOD_LABELS[def.triggerMood]} — once I feel better, a{" "}
          {Math.round(def.requiredSeconds / 60)}-minute check confirms the rescue.
        </p>
      )}

      {/* Educational layer (handoff §2, §51): teach the science behind the
          quest, not just the reward. Collapsible so the card stays compact. */}
      <details className="mt-3">
        <summary className="cursor-pointer select-none text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
          Why this matters
        </summary>
        <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
          <p>{QUEST_WHY[quest.quest_key]}</p>
          <p className="mt-1.5">{WHY_CARDS[def.triggerMood].why}</p>
        </div>
      </details>
    </article>
  );
}

function HistoryItem({ quest }: { quest: QuestRow }) {
  const def = QUEST_DEFINITIONS[quest.quest_key];
  const pill = STATUS_PILL[quest.status] ?? FALLBACK_PILL;
  const when = formatWhen(quest.completed_at ?? quest.expired_at ?? quest.created_at);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-2xl leading-none" role="img" aria-hidden="true">
        {def.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {def.title}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {when ?? "—"}
          {quest.status === "COMPLETED" && <span> · +{quest.xp_reward} XP</span>}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill.className}`}>
        {pill.label}
      </span>
    </li>
  );
}

export default async function QuestsPage() {
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

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-10">
      <header className="mb-6 flex flex-col items-center gap-1 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          🎯
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Quests
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Real care, verified by sensors — no tap-to-win.
        </p>
      </header>

      <section aria-label="Active quests" className="flex flex-col gap-3">
        {active.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-3xl" role="img" aria-hidden="true">
              🌿
            </span>
            <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              No active quest right now — I&apos;m just vibing.
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              A new quest appears when my mood changes.
            </p>
          </div>
        ) : (
          active.map((quest) => <ActiveQuestCard key={quest.id} quest={quest} />)
        )}
      </section>

      <section aria-label="Quest history" className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          History
        </h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200/70 bg-white p-5 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            No completed quests yet — our story starts soon!
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((quest) => (
              <HistoryItem key={quest.id} quest={quest} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
