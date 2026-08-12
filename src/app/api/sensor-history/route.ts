import { getServerSupabaseForBulkRead } from "@/lib/supabase/server";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase-errors";
import { clampMinutes, downsample } from "@/components/sensor-gauge";

/**
 * GET /api/sensor-history?plantId=&minutes= — feeds the /monitoring
 * dashboard: the latest sensor_readings row (all columns, for the gauges)
 * plus a light history window (for the chart), downsampled to ≤500 rows.
 *
 * Missing table (ops team's v5 schema not run) is a setup state, not an
 * error: 200 with { latest: null, history: [] }. Missing light_lux column
 * (milestone6-monitoring.sql not run) falls back to the v5 `light` column.
 */

const HISTORY_CAP = 500;
// Rows fetched before downsampling; PostgREST caps responses at 1000 anyway.
const FETCH_LIMIT = 1000;

interface HistoryRow {
  recorded_at: string;
  light: number | null;
  light_lux: number | null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("plantId");
  const plantId =
    requested && /^[A-Za-z0-9_-]{1,64}$/.test(requested) ? requested : "plant-01";
  const minutes = clampMinutes(params.get("minutes"));

  // Bulk read: an hour of readings is hundreds of rows and the page-render
  // timeout misjudges it as a dead project (see lib/supabase/server.ts).
  const supabase = getServerSupabaseForBulkRead();
  if (!supabase) {
    return Response.json({ ok: false, error: "no_env" }, { status: 503 });
  }

  // History is fetched newest-first so the row limit keeps the MOST RECENT
  // readings, then reversed to ascending for the chart.
  const sinceIso = new Date(Date.now() - minutes * 60_000).toISOString();
  const historyQuery = (columns: string) =>
    supabase
      .from("sensor_readings")
      .select(columns)
      .eq("plant_id", plantId)
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: false })
      .limit(FETCH_LIMIT);

  // latest + the (usual) with-lux history query are independent reads of the
  // same table — run them concurrently instead of serially (this route is
  // polled every 5s by live-activity-bar.tsx and every 10s by
  // monitoring-live.tsx). The light_lux-missing fallback below stays
  // sequential since it only fires after seeing withLux's error.
  const [latestResult, withLux] = await Promise.all([
    supabase
      .from("sensor_readings")
      .select("*")
      .eq("plant_id", plantId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    historyQuery("recorded_at, light, light_lux"),
  ]);

  // The two reads are independent, so one failing must not throw the other
  // away. It used to: any `latest` error became a 500, the client dropped the
  // whole payload on !res.ok, and the light chart — which needs only `history`
  // — went blank while the gauges above it kept showing the previous poll's
  // numbers. `latest` is the one that fails in practice: this route is polled
  // every 5s by the activity bar and every 10s by /monitoring, and overlapping
  // requests abort each other ("AbortError: This operation was aborted").
  //
  // Each half is now reported on its own. A missing table stays a setup state
  // rather than an error, exactly as before.
  if (latestResult.error && !isMissingTableError(latestResult.error)) {
    console.error("sensor-history latest failed:", latestResult.error.message);
  }
  const latest = latestResult.error ? null : latestResult.data ?? null;

  let rows: HistoryRow[] | null = null;
  if (!withLux.error) {
    rows = (withLux.data ?? []) as unknown as HistoryRow[];
  } else if (isMissingColumnError(withLux.error)) {
    const withoutLux = await historyQuery("recorded_at, light");
    if (withoutLux.error) {
      console.error("sensor-history fallback failed:", withoutLux.error.message);
    } else {
      rows = ((withoutLux.data ?? []) as unknown as Omit<HistoryRow, "light_lux">[]).map(
        (row) => ({ ...row, light_lux: null }),
      );
    }
  } else if (isMissingTableError(withLux.error)) {
    rows = [];
  } else {
    console.error("sensor-history history failed:", withLux.error.message);
  }

  // Only when BOTH halves are unusable is there nothing to answer with.
  if (rows === null && latest === null) {
    return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
  rows = rows ?? [];

  rows.reverse();
  return Response.json({
    latest,
    history: downsample(rows, HISTORY_CAP),
  });
}
