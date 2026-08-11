// Plant-voiced messages (handoff §24): home-screen mood line, plus the
// weekly report narration.
//
// Both combine a deterministic template (the mood templates live in
// "@/game/personality/templates"; the weekly report template lives in this
// file) with the optional AI voice ("@/lib/ai"). The template is the
// PERMANENT fallback: each function always has one in hand and returns it
// whenever AI is off, fails, or has already failed for the current entry.
//
// §24 rule — AI is called on meaningful events only. Each cache key pins an
// entry to one specific CHANGE (a mood change, or a week's report shape), so
// that change costs at most one API call no matter how many times the page
// renders.

import "server-only";

import { generateAiMessage } from "@/lib/ai";
import { getMoodMessage } from "@/game/personality/templates";
import { personalityDialogueCandidates } from "@/game/personality/dialogue-bank";
import type { AppLocale } from "@/lib/i18n";
import { normalizePersonality } from "@/types/game";
import type { PersonalityId, WeeklyReport } from "@/types/game";
import type { Plant } from "@/types/plant";

// ── Module-level cache (per server process) ─────────────────────────────

const MAX_CACHE_ENTRIES = 50;

/** Settled AI results by mood entry. A cached null means "the API already
 *  failed for this entry" — kept so we don't retry on every page load. */
const settledCache = new Map<string, string | null>();

/** In-flight calls, so concurrent page loads of the same mood entry share
 *  one API call. Entries self-clean when the call settles (≤ ~4s — the
 *  generateAiMessage timeout), so this map needs no size cap. */
const inFlightCache = new Map<string, Promise<string | null>>();

function cacheKey(plant: Plant, personality: string, locale: AppLocale): string {
  return `${plant.id}|${plant.current_state}|${personality}|${locale}|${plant.state_changed_at}`;
}

/** Oldest-first eviction via Map insertion order (re-setting an existing key
 *  does not move it, which is fine — older entries are stale mood entries). */
function evictOldest(): void {
  while (settledCache.size > MAX_CACHE_ENTRIES) {
    const oldest = settledCache.keys().next().value;
    if (oldest === undefined) return;
    settledCache.delete(oldest);
  }
}

// Same settled/in-flight + eviction pattern as the mood cache above, kept in
// separate maps since the key shape (and cadence — once per week, not once
// per mood change) differs from getHomeMoodMessage's.
const reportSettledCache = new Map<string, string | null>();
const reportInFlightCache = new Map<string, Promise<string | null>>();

function reportCacheKey(plant: Plant, personality: string, locale: AppLocale, report: WeeklyReport): string {
  return `${plant.id}|${personality}|${locale}|${report.weekStart}|${report.questsCompleted}|${report.bondLevel}`;
}

function evictOldestReport(): void {
  while (reportSettledCache.size > MAX_CACHE_ENTRIES) {
    const oldest = reportSettledCache.keys().next().value;
    if (oldest === undefined) return;
    reportSettledCache.delete(oldest);
  }
}

// ── Weekly report fallback template (§24 permanent fallback) ────────────

/** 66840s → "18h 34m"; 1500s → "25m"; 0 → "0m". Mirrors reports/page.tsx's
 *  formatDuration so the AI-off line reads the same as the stat tile. */
function healthyHoursLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

interface ReportFallbackParams {
  healthyLabel: string;
  questsCompleted: number;
  questWord: string;
  bondLevel: number;
}

/** One personality-flavored line per voice, built only from real report
 *  fields — never invents a number the caller didn't provide. */
const WEEKLY_REPORT_TEMPLATES: Record<PersonalityId, (p: ReportFallbackParams) => string> = {
  cute: (p) =>
    `This week I was healthy for ${p.healthyLabel}, we finished ${p.questsCompleted} ${p.questWord} together, and our bond is Level ${p.bondLevel} now — thank you for taking care of me!`,
  calm: (p) =>
    `This week: ${p.healthyLabel} healthy, ${p.questsCompleted} ${p.questWord} completed, bond at level ${p.bondLevel}.`,
  funny: (p) =>
    `${p.healthyLabel} of feeling great, ${p.questsCompleted} ${p.questWord} down, and bond Level ${p.bondLevel} — not bad for a plant that can’t even walk!`,
  energetic: (p) =>
    `Huge week! ${p.healthyLabel} healthy, ${p.questsCompleted} ${p.questWord} smashed, bond Level ${p.bondLevel} — let’s keep this up!`,
  shy: (p) =>
    `Um… I was healthy for ${p.healthyLabel} this week… we finished ${p.questsCompleted} ${p.questWord}… and our bond is Level ${p.bondLevel} now… thank you…`,
};

const WEEKLY_REPORT_TEMPLATES_ID: Record<PersonalityId, (p: ReportFallbackParams) => string> = {
  cute: (p) => `Minggu ini aku sehat selama ${p.healthyLabel}, kita menyelesaikan ${p.questsCompleted} misi, dan ikatan kita sekarang Level ${p.bondLevel} — terima kasih sudah merawatku!`,
  calm: (p) => `Minggu ini: sehat ${p.healthyLabel}, ${p.questsCompleted} misi selesai, dan ikatan kita Level ${p.bondLevel}.`,
  funny: (p) => `Sehat ${p.healthyLabel}, ${p.questsCompleted} misi beres, dan ikatan Level ${p.bondLevel} — lumayan untuk tanaman yang tidak bisa jalan!`,
  energetic: (p) => `Minggu yang hebat! Sehat ${p.healthyLabel}, ${p.questsCompleted} misi tuntas, ikatan Level ${p.bondLevel} — lanjutkan!`,
  shy: (p) => `Hmm… minggu ini aku sehat selama ${p.healthyLabel}… kita menyelesaikan ${p.questsCompleted} misi… dan ikatan kita sekarang Level ${p.bondLevel}… terima kasih…`,
};

function buildWeeklyReportFallback(personality: PersonalityId, report: WeeklyReport, locale: AppLocale): string {
  const templates = locale === "id" ? WEEKLY_REPORT_TEMPLATES_ID : WEEKLY_REPORT_TEMPLATES;
  return templates[personality]({
    healthyLabel: healthyHoursLabel(report.healthySeconds),
    questsCompleted: report.questsCompleted,
    questWord: report.questsCompleted === 1 ? "quest" : "quests",
    bondLevel: report.bondLevel,
  });
}

/** Compact factual line for the AI prompt (handoff §24 — AI may only restate
 *  verified facts, never invent them). Kept well under buildFacts's 400-char
 *  cap for WEEKLY_REPORT. */
function buildReportSummary(report: WeeklyReport): string {
  return (
    `Healthy time this week: ${healthyHoursLabel(report.healthySeconds)}. ` +
    `Quests completed: ${report.questsCompleted}. ` +
    `Overheating events: ${report.overheatingEvents}. ` +
    `Too-cold events: ${report.tooColdEvents}. ` +
    `Humid-air events: ${report.humidAirEvents}. ` +
    `Bond level: ${report.bondLevel} (${report.totalXp} total XP). ` +
    `Current streak: ${report.currentStreak} day(s).`
  );
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Plant-voiced line for the plant's current mood, AI-flavored when possible.
 *
 * Always resolves to a displayable string; never throws. Without an
 * GEMINI_API_KEY this is fully synchronous in effect — the deterministic
 * template is returned without touching the cache or awaiting anything.
 */
export async function getHomeMoodMessage(plant: Plant, locale: AppLocale = "en"): Promise<string> {
  const personality = normalizePersonality(plant.personality);
  const template = locale === "id"
    ? personalityDialogueCandidates(personality, plant.current_state, locale, plant.state_changed_at, 1)[0]
    : getMoodMessage(personality, plant.current_state, plant.state_changed_at);

  try {
    // generateAiMessage guards too, but returning here skips a pointless
    // await/cache round-trip in the common key-less (demo/offline) setup.
    if (!process.env.GEMINI_API_KEY) return template;

    const key = cacheKey(plant, personality, locale);

    if (settledCache.has(key)) {
      return settledCache.get(key) ?? template;
    }

    let pending = inFlightCache.get(key);
    if (!pending) {
      pending = generateAiMessage({
        kind: "MOOD",
        personality,
        plantName: plant.name,
        mood: plant.current_state,
        locale,
      });
      inFlightCache.set(key, pending);
    }

    // generateAiMessage never throws, so this promise always resolves.
    const aiMessage = await pending;

    inFlightCache.delete(key);
    settledCache.set(key, aiMessage);
    evictOldest();

    return aiMessage ?? template;
  } catch {
    // Unreachable by contract; kept so a future regression in the AI layer
    // can only ever degrade to the template, never break the home page.
    return template;
  }
}

/**
 * Synchronous, AI-free counterpart to getWeeklyReportNarration: exactly the
 * deterministic line getWeeklyReportNarration falls back to when there's no
 * GEMINI_API_KEY. Used by reports/page.tsx (speed fix 2026-08-11) so the
 * page renders instantly instead of awaiting a live Gemini call during
 * server render; the AI-flavored upgrade streams in client-side via
 * WeeklyNarrationLive → POST /api/weekly-report-narration, which calls
 * getWeeklyReportNarration itself and lands in the SAME settled/in-flight
 * cache above — so a repeat visit for an unchanged report still costs at
 * most one API call.
 */
export function getWeeklyReportFallback(plant: Plant, report: WeeklyReport, locale: AppLocale = "en"): string {
  const personality = normalizePersonality(plant.personality);
  return buildWeeklyReportFallback(personality, report, locale);
}

/**
 * Plant-voiced one-liner summarizing the week's report, AI-flavored when
 * possible. Always resolves to a displayable string; never throws. Without
 * a GEMINI_API_KEY this is fully synchronous in effect — the
 * deterministic template is returned without touching the cache or awaiting
 * anything. Cached per plant/personality/week/quest-count/bond-level, so an
 * unchanged report costs at most one API call no matter how many times the
 * reports page renders.
 */
export async function getWeeklyReportNarration(
  plant: Plant,
  report: WeeklyReport,
  locale: AppLocale = "en",
): Promise<string> {
  const personality = normalizePersonality(plant.personality);
  const fallback = buildWeeklyReportFallback(personality, report, locale);

  try {
    // generateAiMessage guards too, but returning here skips a pointless
    // await/cache round-trip in the common key-less (demo/offline) setup.
    if (!process.env.GEMINI_API_KEY) return fallback;

    const key = reportCacheKey(plant, personality, locale, report);

    if (reportSettledCache.has(key)) {
      return reportSettledCache.get(key) ?? fallback;
    }

    let pending = reportInFlightCache.get(key);
    if (!pending) {
      pending = generateAiMessage({
        kind: "WEEKLY_REPORT",
        personality,
        plantName: plant.name,
        reportSummary: buildReportSummary(report),
        locale,
      });
      reportInFlightCache.set(key, pending);
    }

    // generateAiMessage never throws, so this promise always resolves.
    const aiMessage = await pending;

    reportInFlightCache.delete(key);
    reportSettledCache.set(key, aiMessage);
    evictOldestReport();

    return aiMessage ?? fallback;
  } catch {
    // Unreachable by contract; kept so a future regression in the AI layer
    // can only ever degrade to the template, never break the reports page.
    return fallback;
  }
}
