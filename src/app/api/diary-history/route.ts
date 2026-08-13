import { getServerSupabase } from "@/lib/supabase/server";
import { isMissingTableError } from "@/lib/supabase-errors";

/**
 * GET /api/diary-history?plantId=&limit= — feeds the Flutter "Diary" screen.
 * Text-only view of the `growth_records` table (handoff §14/§35): no photo,
 * no height/leaf numbers, just the note the caretaker wrote plus the stage
 * it was recorded at. Newest first.
 *
 * Default limit is 1 (the mobile app only shows the latest entry) but a
 * caller can ask for more (e.g. ?limit=5) up to DIARY_HISTORY_CAP.
 *
 * Missing table (milestone5-growth-records.sql not run) is a setup state,
 * not an error: 200 with an empty array, same convention as sensor-history.
 */

const DEFAULT_LIMIT = 1;
const DIARY_HISTORY_CAP = 20;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

interface DiaryRow {
  id: string;
  recorded_at: string;
  stage: string;
  note: string | null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("plantId");
  const plantId =
    requested && /^[A-Za-z0-9_-]{1,64}$/.test(requested) ? requested : "plant-01";

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.trunc(rawLimit), DIARY_HISTORY_CAP)
      : DEFAULT_LIMIT;

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("growth_records")
    .select("id, recorded_at, stage, note")
    .eq("plant_id", plantId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      return Response.json([]);
    }
    console.error("diary-history query failed:", error.message);
    return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  }

  const rows = (data ?? []) as DiaryRow[];

  // Text-only shape the Flutter DiaryEntry model expects: date, stage, quote.
  const entries = rows.map((row) => ({
    id: row.id,
    date: dateFormat.format(new Date(row.recorded_at)),
    stage: row.stage,
    quote: row.note ?? "",
  }));

  return Response.json(entries);
}
