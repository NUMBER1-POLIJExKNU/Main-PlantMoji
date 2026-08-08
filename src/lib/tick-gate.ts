// Deferred game-tick gate.
//
// Why: pages used to `await runGameTick(...)` inside their server components,
// so EVERY tab switch blocked rendering on the engine's full Supabase sweep.
// No page consumes the tick's result in the same response — quest, badge, and
// chapter changes surface through Supabase realtime subscriptions and on the
// next navigation — so the sweep is scheduled with `after()` from
// 'next/server' to run once the response has been sent, gated per plant so
// rapid tab switches don't stampede the engine. The explicit trigger path
// (POST /api/game-tick) still awaits runGameTick directly.

import { after } from "next/server";
import { runGameTick } from "@/game/events/event-router";

/** Minimum spacing between background sweeps for the same plant. */
const TICK_TTL_MS = 15_000;

interface TickGate {
  /** When the most recent sweep was scheduled (ms epoch). */
  scheduledAt: number;
  /** True while that sweep is still running post-response. */
  inFlight: boolean;
}

// Module-level, per server process. Best-effort by design: multiple server
// instances just mean an occasional extra sweep, and runGameTick is an
// idempotent re-evaluation of persisted timestamps.
const gates = new Map<string, TickGate>();

/**
 * Schedules a background `runGameTick(plantId)` after the current response
 * is sent — unless one is already in flight or ran within the last
 * TICK_TTL_MS. Never blocks rendering and never throws; failures are logged.
 *
 * Call this as the pages' one-line replacement for `await runGameTick(...)`.
 */
export function maybeScheduleGameTick(plantId: string): void {
  const now = Date.now();
  const gate = gates.get(plantId);
  if (gate && (gate.inFlight || now - gate.scheduledAt < TICK_TTL_MS)) return;

  gates.set(plantId, { scheduledAt: now, inFlight: true });
  after(async () => {
    try {
      await runGameTick(plantId);
    } catch (error) {
      console.error(`maybeScheduleGameTick: runGameTick(${plantId}) failed:`, error);
    } finally {
      const current = gates.get(plantId);
      if (current) current.inFlight = false;
    }
  });
}
