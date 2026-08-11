import { fetchPlant } from "@/lib/plants";
import { getWeeklyReportNarration } from "@/lib/plant-messages";
import { normalizeLocale } from "@/lib/i18n";
import type { WeeklyReport } from "@/types/game";

/**
 * POST /api/weekly-report-narration — client-side upgrade path for the
 * reports page's plant note (see src/components/weekly-narration-live.tsx).
 * The report shape is computed server-side once already (reports/page.tsx),
 * so the client hands it straight back here instead of this route
 * re-running the weekly history scan; this route only adds the live-Gemini
 * call (getWeeklyReportNarration), cached per report shape (handoff §24).
 */

const PLANT_ID = "plant-01";

function isValidReport(value: unknown): value is WeeklyReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.weekStart === "string" &&
    typeof r.weekEnd === "string" &&
    typeof r.healthySeconds === "number" &&
    typeof r.questsCompleted === "number" &&
    typeof r.overheatingEvents === "number" &&
    typeof r.tooColdEvents === "number" &&
    typeof r.humidAirEvents === "number" &&
    typeof r.bondLevel === "number" &&
    typeof r.totalXp === "number" &&
    typeof r.currentStreak === "number"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const locale = normalizeLocale(input.locale);
  if (!isValidReport(input.report)) {
    return Response.json({ ok: false, error: "invalid_report" }, { status: 400 });
  }

  // fetchPlant never rejects (it returns status objects).
  const plantResult = await fetchPlant(PLANT_ID);
  if (plantResult.status !== "ok") {
    return Response.json({ ok: false, error: "unavailable" }, { status: 404 });
  }

  const narration = await getWeeklyReportNarration(plantResult.plant, input.report, locale);
  return Response.json({ ok: true, narration });
}
