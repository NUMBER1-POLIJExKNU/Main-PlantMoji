// Weekly report computation (handoff §22, Phase 15).
//
// There is NO weekly_reports table — the report is reconstructed from
// history (device_events, quests, bond_state) every time the page opens.
// This module only READS; it never writes, so idempotency is trivial.
//
// Engine convention: takes the SupabaseClient as its first parameter so the
// caller decides server-only-ness and tests can inject a fake client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_TIMEZONE, type WeeklyReport } from "@/types/game";
import { normalizeMood, type PlantMood } from "@/types/events";

const DAY_MS = 24 * 60 * 60 * 1000;
/** WIB (Asia/Jakarta) is a fixed UTC+7 offset — Indonesia observes no DST,
 *  so whole-day arithmetic on UTC epoch ms is safe. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** en-US short weekday names → days since the Monday of that WIB week. */
const DAYS_SINCE_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

// ── Week window (pure) ──────────────────────────────────────────────────

export interface WeekWindow {
  /** Monday 00:00 WIB of the week containing `reference`, as UTC epoch ms. */
  startMs: number;
  /** min(now, next Monday 00:00 WIB), clamped to be >= startMs. */
  endMs: number;
}

/**
 * The WIB (STREAK_TIMEZONE) week window containing `reference`.
 * `now` is injectable for tests; an in-progress week is capped at `now`,
 * a fully elapsed week runs through its next-Monday boundary.
 */
export function wibWeekWindow(reference: Date, now: Date = new Date()): WeekWindow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STREAK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(reference);

  let year = 0;
  let month = 1;
  let day = 1;
  let weekday = "Mon";
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "weekday") weekday = part.value;
  }

  // UTC instant of WIB midnight on the reference's WIB calendar date.
  const wibMidnightUtcMs = Date.UTC(year, month - 1, day) - WIB_OFFSET_MS;
  const startMs = wibMidnightUtcMs - (DAYS_SINCE_MONDAY[weekday] ?? 0) * DAY_MS;
  const nextMondayMs = startMs + 7 * DAY_MS;
  const endMs = Math.max(startMs, Math.min(now.getTime(), nextMondayMs));
  return { startMs, endMs };
}

// ── Healthy-time interval math (pure) ───────────────────────────────────

export type TimelineEvent =
  | { atMs: number; kind: "state"; mood: PlantMood | null }
  | { atMs: number; kind: "sensor"; online: boolean };

export interface HealthyTimeline {
  windowStartMs: number;
  windowEndMs: number;
  /** Plant mood at window start; null = unknown → never counts as healthy. */
  moodAtStart: PlantMood | null;
  /** Sensor connectivity at window start (false while a SENSOR_OFFLINE from
   *  before the window is still unclosed). */
  sensorOnlineAtStart: boolean;
  /** Events inside the window, ascending by atMs. */
  events: TimelineEvent[];
}

/**
 * Sweeps the reconstructed timeline and sums the seconds where the plant was
 * Happy AND the sensor was connected. Sensor-disconnected spans never count
 * as healthy even if the last known mood was Happy (handoff §22, §45); an
 * unclosed SENSOR_OFFLINE excludes through the window end.
 */
export function computeHealthySeconds(timeline: HealthyTimeline): number {
  const { windowStartMs, windowEndMs } = timeline;
  let mood = timeline.moodAtStart;
  let online = timeline.sensorOnlineAtStart;
  let cursor = windowStartMs;
  let healthyMs = 0;

  const accumulateTo = (untilMs: number) => {
    const until = Math.min(Math.max(untilMs, windowStartMs), windowEndMs);
    if (until > cursor) {
      if (mood === "Happy" && online) healthyMs += until - cursor;
      cursor = until;
    }
  };

  for (const event of timeline.events) {
    accumulateTo(event.atMs);
    if (event.kind === "state") mood = event.mood;
    else online = event.online;
  }
  accumulateTo(windowEndMs);

  return Math.floor(healthyMs / 1000);
}

// ── DB access ───────────────────────────────────────────────────────────

interface DeviceEventRow {
  type: string;
  occurred_at: string;
  data: Record<string, unknown> | null;
}

interface BondStateSlice {
  total_xp: number;
  bond_level: number;
  current_streak: number;
}

const TIMELINE_EVENT_TYPES = [
  "PLANT_STATE_CHANGED",
  "SENSOR_OFFLINE",
  "SENSOR_ONLINE",
] as const;

async function fetchWindowEvents(
  supabase: SupabaseClient,
  plantId: string,
  fromIso: string,
  toIso: string,
): Promise<DeviceEventRow[]> {
  const { data, error } = await supabase
    .from("device_events")
    .select("type, occurred_at, data")
    .eq("plant_id", plantId)
    .in("type", [...TIMELINE_EVENT_TYPES])
    .gte("occurred_at", fromIso)
    .lt("occurred_at", toIso)
    .order("occurred_at", { ascending: true })
    // State ENTRIES + connectivity edges only (never sensor samples), so one
    // week stays far below this cap.
    .limit(1000);
  if (error) {
    throw new Error(`weekly-report: device_events query failed: ${error.message}`);
  }
  return (data ?? []) as DeviceEventRow[];
}

/** Latest event of the given types strictly before `beforeIso` — defines the
 *  timeline's state at the window start. */
async function fetchLatestBefore(
  supabase: SupabaseClient,
  plantId: string,
  beforeIso: string,
  types: readonly string[],
): Promise<DeviceEventRow | null> {
  const { data, error } = await supabase
    .from("device_events")
    .select("type, occurred_at, data")
    .eq("plant_id", plantId)
    .in("type", [...types])
    .lt("occurred_at", beforeIso)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `weekly-report: latest ${types.join("/")} lookup failed: ${error.message}`,
    );
  }
  return (data as DeviceEventRow | null) ?? null;
}

async function countCompletedQuests(
  supabase: SupabaseClient,
  plantId: string,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("quests")
    .select("id", { count: "exact", head: true })
    .eq("plant_id", plantId)
    .eq("status", "COMPLETED")
    .gte("completed_at", fromIso)
    .lt("completed_at", toIso);
  if (error) {
    throw new Error(`weekly-report: quests count failed: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchBondState(
  supabase: SupabaseClient,
  plantId: string,
): Promise<BondStateSlice | null> {
  const { data, error } = await supabase
    .from("bond_state")
    .select("total_xp, bond_level, current_streak")
    .eq("plant_id", plantId)
    .maybeSingle();
  if (error) {
    throw new Error(`weekly-report: bond_state query failed: ${error.message}`);
  }
  return (data as BondStateSlice | null) ?? null;
}

// ── Report ──────────────────────────────────────────────────────────────

/**
 * Computes the weekly report for the WIB week containing `reference`
 * (default: now). Read-only; gracefully returns zeros on empty history.
 */
export async function computeWeeklyReport(
  supabase: SupabaseClient,
  plantId: string,
  reference: Date = new Date(),
): Promise<WeeklyReport> {
  const { startMs, endMs } = wibWeekWindow(reference);
  const weekStart = new Date(startMs).toISOString();
  const weekEnd = new Date(endMs).toISOString();

  const [windowEvents, lastStateBefore, lastSensorBefore, questsCompleted, bond] =
    await Promise.all([
      fetchWindowEvents(supabase, plantId, weekStart, weekEnd),
      fetchLatestBefore(supabase, plantId, weekStart, ["PLANT_STATE_CHANGED"]),
      fetchLatestBefore(supabase, plantId, weekStart, ["SENSOR_OFFLINE", "SENSOR_ONLINE"]),
      countCompletedQuests(supabase, plantId, weekStart, weekEnd),
      fetchBondState(supabase, plantId),
    ]);

  const events: TimelineEvent[] = [];
  let overheatingEvents = 0;
  for (const row of windowEvents) {
    const atMs = Date.parse(row.occurred_at);
    if (Number.isNaN(atMs)) continue;
    if (row.type === "PLANT_STATE_CHANGED") {
      const mood = normalizeMood(row.data?.currentState);
      // State ENTRY into Overheating — never per-sensor-sample (handoff §45).
      if (mood === "Overheating") overheatingEvents += 1;
      events.push({ atMs, kind: "state", mood });
    } else if (row.type === "SENSOR_OFFLINE") {
      events.push({ atMs, kind: "sensor", online: false });
    } else if (row.type === "SENSOR_ONLINE") {
      events.push({ atMs, kind: "sensor", online: true });
    }
  }

  const healthySeconds = computeHealthySeconds({
    windowStartMs: startMs,
    windowEndMs: endMs,
    // No prior state event → mood unknown → not healthy until the first
    // in-window PLANT_STATE_CHANGED.
    moodAtStart: lastStateBefore ? normalizeMood(lastStateBefore.data?.currentState) : null,
    sensorOnlineAtStart: lastSensorBefore ? lastSensorBefore.type !== "SENSOR_OFFLINE" : true,
    events,
  });

  return {
    weekStart,
    weekEnd,
    healthySeconds,
    questsCompleted,
    overheatingEvents,
    bondLevel: bond?.bond_level ?? 1,
    totalXp: bond?.total_xp ?? 0,
    currentStreak: bond?.current_streak ?? 0,
  };
}
