// Weekly report (handoff §22, §33, Phase 15) — plain stat tiles computed
// from history on every open. No weekly_reports table, no chart library.

import Notice from "@/components/notice";
import { runGameTick } from "@/game/events/event-router";
import { computeWeeklyReport } from "@/lib/weekly-report";
import { getServerSupabase } from "@/lib/supabase/server";
import { STREAK_TIMEZONE, type WeeklyReport } from "@/types/game";

// The report window is capped at "now" — always render fresh.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

const weekDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: STREAK_TIMEZONE,
});

/** 66840s → "18h 34m"; 1500s → "25m"; 0 → "0m". */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatWeekRange(report: WeeklyReport): string {
  const startMs = Date.parse(report.weekStart);
  const endMs = Date.parse(report.weekEnd);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "This week";
  return `${weekDateFormat.format(new Date(startMs))} – ${weekDateFormat.format(new Date(endMs))}`;
}

function StatTile({
  emoji,
  label,
  value,
  sub,
  tint,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  tint: string;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border p-4 shadow-sm ${tint}`}>
      <span className="text-2xl leading-none" role="img" aria-hidden="true">
        {emoji}
      </span>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
      {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function ReportsPage() {
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

  // Lazy timestamp sweep FIRST (handoff Correction 4): pending time-based
  // quest completions land before the report is computed, so "quests
  // completed" is up to date. A sweep failure never breaks the page.
  try {
    await runGameTick(PLANT_ID);
  } catch {
    // Ignored — the report still renders from existing history.
  }

  let report: WeeklyReport;
  try {
    report = await computeWeeklyReport(supabase, PLANT_ID);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        title="주간 리포트를 불러오지 못했습니다"
        lines={[message, "supabase/milestone3.sql이 실행되었는지 확인해 주세요."]}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-24 pt-10">
      <header className="mb-6 flex flex-col items-center gap-1 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          📊
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Weekly Report
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatWeekRange(report)}</p>
      </header>

      <section aria-label="Weekly stats" className="grid grid-cols-2 gap-3">
        <StatTile
          emoji="💚"
          label="Healthy time"
          value={formatDuration(report.healthySeconds)}
          sub="sensor-verified"
          tint="border-green-200/70 bg-green-50/70 dark:border-green-900/60 dark:bg-green-950/40"
        />
        <StatTile
          emoji="🎯"
          label="Quests completed"
          value={String(report.questsCompleted)}
          tint="border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40"
        />
        <StatTile
          emoji="🔥"
          label="Overheating events"
          value={String(report.overheatingEvents)}
          sub="state entries, not samples"
          tint="border-red-200/70 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/40"
        />
        <StatTile
          emoji="🤝"
          label="Bond level"
          value={`Lv.${report.bondLevel}`}
          sub={
            report.currentStreak > 0
              ? `🔥 ${report.currentStreak}-day streak`
              : `${report.totalXp} XP total`
          }
          tint="border-indigo-200/70 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/40"
        />
      </section>

      <p className="mt-6 text-center text-xs leading-5 text-zinc-400 dark:text-zinc-500">
        Computed live from this week&apos;s history — healthy time excludes
        sensor-offline periods.
      </p>
    </main>
  );
}
