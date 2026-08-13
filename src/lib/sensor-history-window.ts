// Which slice of sensor_readings the /monitoring history chart is given.
//
// Pure and dependency-free on purpose: /api/sensor-history pulls in
// `server-only` through the Supabase client, so a test reaching for this rule
// alongside the client-side chart could not import it from the route.

/**
 * Fewest rows worth charting before the window reaches further back.
 *
 * Anchoring on the newest reading (below) keeps the chart alive while a kit
 * is switched off. It does not cover the other direction: a kit switched back
 * ON after a long outage has only a handful of fresh rows inside its own
 * hour, and the rest of the axis would be the same empty box. When the
 * anchored window is that thin the rule keeps taking older rows — reaching
 * back across the outage — so the new readings are drawn continuing the last
 * known history instead of floating alone.
 *
 * 60 is one point per minute of the nominal hour: enough that the result
 * reads as a line rather than a dot, and small enough that a genuinely short
 * history is not padded with ancient data it does not need.
 */
export const MIN_HISTORY_POINTS = 60;

/**
 * Trim newest-first `rows` to the requested window, measured back from the
 * NEWEST ROW rather than from now, and widened when that leaves too little to
 * chart.
 *
 * The window used to be `recorded_at >= now - minutes`, which tied the chart
 * to the viewer's clock instead of to the data: switch the kit off and the
 * window slid off the end of the readings until, an hour later, the card was
 * an empty box — precisely when someone would want to see what the sensors
 * last recorded.
 *
 * Three shapes come out of this, all non-empty whenever any row exists:
 *   live kit         — the newest row is ~now, so the window is the live hour;
 *   kit switched off — the window is the hour it recorded before stopping;
 *   kit switched on  — the fresh rows plus enough older ones to reach back
 *                      across the outage, i.e. the splice the chart draws
 *                      with a visible break rather than a straight line.
 */
export function windowFromNewest<T extends { recorded_at: string }>(
  rows: T[],
  minutes: number,
): T[] {
  if (rows.length === 0) return rows;
  const anchor = Date.parse(rows[0].recorded_at);
  // Unparseable newest timestamp: no meaningful window to cut, so hand back
  // what we have rather than silently emptying the chart.
  if (!Number.isFinite(anchor)) return rows;
  const floor = anchor - minutes * 60_000;
  const windowed = rows.filter((row) => {
    const t = Date.parse(row.recorded_at);
    return Number.isFinite(t) && t >= floor;
  });
  return windowed.length >= MIN_HISTORY_POINTS ? windowed : rows.slice(0, MIN_HISTORY_POINTS);
}
