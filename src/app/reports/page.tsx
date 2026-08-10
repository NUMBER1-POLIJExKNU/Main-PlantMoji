// Weekly report (handoff §22, §33, Phase 15) — plain stat tiles computed
// from history on every open. No weekly_reports table, no chart library.

import Link from "next/link";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import { fetchPlant, type PlantFetchResult } from "@/lib/plants";
import { getWeeklyReportNarration } from "@/lib/plant-messages";
import { computeWeeklyReport } from "@/lib/weekly-report";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { maybeScheduleGameTick } from "@/lib/tick-gate";
import { STREAK_TIMEZONE, type WeeklyReport } from "@/types/game";

// The report window is capped at "now" — always render fresh.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

/** 66840s → "18h 34m" / "18j 34mnt"; 1500s → "25m" / "25mnt"; 0 → "0m" / "0mnt". */
function formatDuration(totalSeconds: number, locale: AppLocale): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (locale === "id") {
    return hours > 0 ? `${hours}j ${minutes}mnt` : `${minutes}mnt`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatWeekRange(report: WeeklyReport, locale: AppLocale): string {
  const startMs = Date.parse(report.weekStart);
  const endMs = Date.parse(report.weekEnd);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return locale === "id" ? "Minggu ini" : "This week";
  }
  const weekDateFormat = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: STREAK_TIMEZONE,
  });
  return `${weekDateFormat.format(new Date(startMs))} – ${weekDateFormat.format(new Date(endMs))}`;
}

// Muted ink tints derived from the farm text color #243421 (spec §2.5).
const INK_MUTED = "#5B6B57";
const INK_FAINT = "#93A08F";

/** Farm surface tile: .pm-panel with a palette accent border and the big
 *  number in Press Start 2P. Accents are inline because the pm-* contract
 *  classes are unlayered CSS (Tailwind utilities can't override them). */
function StatTile({
  emoji,
  label,
  value,
  sub,
  accent,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="pm-panel flex flex-col gap-1" style={{ borderColor: accent }}>
      <span className="text-2xl leading-none" role="img" aria-hidden="true">
        {emoji}
      </span>
      <p className="pm-heading mt-1 text-sm tabular-nums">{value}</p>
      <p className="text-xs font-semibold" style={{ color: INK_MUTED }}>
        {label}
      </p>
      {sub && (
        <p className="text-[11px]" style={{ color: INK_FAINT }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function ReportsPage() {
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

  // Lazy timestamp sweep (handoff Correction 4), deferred: awaiting it here
  // blocked every render on the engine's Supabase sweep. It now runs after
  // the response (lib/tick-gate.ts); a completion it lands shows up on the
  // next open — the report is a summary, not a live feed.
  maybeScheduleGameTick(PLANT_ID);

  let report: WeeklyReport;
  let plantResult: PlantFetchResult;
  try {
    // fetchPlant never rejects (it returns status objects), so this
    // Promise.all can only fail via computeWeeklyReport — the Notice below
    // keeps its exact meaning.
    [report, plantResult] = await Promise.all([
      computeWeeklyReport(supabase, PLANT_ID),
      fetchPlant(PLANT_ID),
    ]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <Notice
        title="Couldn't load the weekly report"
        lines={[message, "Check that supabase/milestone3.sql has been run."]}
      />
    );
  }

  // AI-personalized when GEMINI_API_KEY is set (cached per report shape,
  // handoff §24); deterministic template otherwise — never blocks on
  // failure. No plant row (e.g. schema not seeded yet) simply skips the
  // narration — the stat tiles below still render from `report`.
  const narration =
    plantResult.status === "ok"
      ? await getWeeklyReportNarration(plantResult.plant, report)
      : null;
  const nextGoal = report.overheatingEvents > 0
    ? (locale === "id" ? "Kurangi kejadian panas dan jaga tempat tetap teduh." : "Reduce heat events and keep the garden comfortably shaded.")
    : report.questsCompleted === 0
      ? (locale === "id" ? "Selesaikan satu misi perawatan bersama Jamkachu." : "Complete one care quest with Jamkachu.")
      : (locale === "id" ? "Pertahankan kondisi nyaman dan lanjutkan rentetan harian." : "Keep conditions comfortable and continue the daily streak.");

  // Sizing/backdrop comes from the farm shell contract: .reno-route-content
  // centers this <main> at 720px directly on the sky, and .pm-panel tiles
  // inside supply the surfaces.
  return (
    <main className="w-full">
      <PageHeader
        icon="📊"
        eyebrow={locale === "id" ? "Ringkasan perawatan" : "Care recap"}
        title={locale === "id" ? "Laporan" : "Reports"}
        description={locale === "id"
          ? "Lihat pola perawatan dan perkembangan ikatan minggu ini."
          : "See this week's care pattern and bond progress."}
        meta={<span className="pm-chip">🗓️ {formatWeekRange(report, locale)}</span>}
      />

      {narration && plantResult.status === "ok" && (
        <section aria-label="Plant's note" className="pm-report-jam-note mb-6">
          <div className="pm-report-jamkachu" aria-hidden="true"><i /><i /><b /><b /></div>
          <p className="pm-heading mb-2 text-center text-[9px] uppercase" style={{ color: INK_MUTED }}>
            {locale === "id"
              ? `Sepatah kata dari ${plantResult.plant.name}`
              : `A word from ${plantResult.plant.name}`}
          </p>
          <div
            className="pm-panel pm-report-speech text-center text-sm leading-6"
            style={{ borderColor: "var(--color-grass-light)" }}
          >
            <span aria-hidden="true">&ldquo;</span>
            {narration}
            <span aria-hidden="true">&rdquo;</span>
          </div>
        </section>
      )}

      <section className="pm-panel mb-6 grid grid-cols-[auto_1fr] items-center gap-3" style={{ borderColor: "var(--color-yellow)", background: "linear-gradient(135deg,#FFF7CF,var(--color-surface))" }}><span className="grid size-12 place-items-center rounded-xl border-[3px] border-[#243421] bg-[#FFDE6A] text-2xl" aria-hidden="true">🎯</span><div><small className="pm-heading block text-[9px] text-[#8A6512]">{locale === "id" ? "TARGET BERIKUTNYA" : "NEXT GOAL"}</small><strong className="mt-1 block text-sm leading-5">{nextGoal}</strong></div></section>

      <section aria-label="Weekly stats" className="grid grid-cols-2 gap-3">
        <StatTile
          emoji="💚"
          label={locale === "id" ? "Waktu sehat" : "Healthy time"}
          value={formatDuration(report.healthySeconds, locale)}
          sub={locale === "id" ? "terverifikasi sensor" : "sensor-verified"}
          accent="var(--color-grass)"
        />
        <StatTile
          emoji="🎯"
          label={locale === "id" ? "Misi selesai" : "Quests completed"}
          value={String(report.questsCompleted)}
          accent="var(--color-yellow)"
        />
        <StatTile
          emoji="🔥"
          label={locale === "id" ? "Kejadian kepanasan" : "Overheating events"}
          value={String(report.overheatingEvents)}
          sub={locale === "id" ? "entri kondisi, bukan sampel data" : "state entries, not samples"}
          accent="#F08A6B"
        />
        <StatTile
          emoji="🤝"
          label={locale === "id" ? "Level ikatan" : "Bond level"}
          value={`Lv.${report.bondLevel}`}
          sub={
            report.currentStreak > 0
              ? locale === "id"
                ? `🔥 ${report.currentStreak} hari beruntun`
                : `🔥 ${report.currentStreak}-day streak`
              : locale === "id"
                ? `Total ${report.totalXp} XP`
                : `${report.totalXp} XP total`
          }
          accent="var(--color-water)"
        />
      </section>

      {/* .pm-btn centers its content; space-between must be inline since the
          unlayered pm-* contract beats Tailwind utilities. */}
      <Link href="/monitoring" className="pm-btn mt-4 w-full" style={{ justifyContent: "space-between" }}>
        <span>{locale === "id" ? "Pemantauan langsung" : "Live monitoring"}</span>
        <span aria-hidden="true">→</span>
      </Link>

      <p className="mt-6 text-center text-xs leading-5" style={{ color: INK_MUTED }}>
        {locale === "id"
          ? "Dihitung langsung dari riwayat minggu ini — waktu sehat tidak menghitung saat sensor offline."
          : "Computed live from this week's history — healthy time excludes sensor-offline periods."}
      </p>
    </main>
  );
}
