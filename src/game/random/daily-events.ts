// Daily events — "random" surprise days that need no scheduler.
//
// The trick: the day's event is a pure function of (WIB calendar date,
// plantId). A tiny stable hash over `${plantId}|${dateString}` picks from a
// fixed pool, so every request, replay, and restart computes the SAME event
// for the same day (handoff Correction 4 / §28 — deterministic from
// timestamps, no server timers, idempotent by construction), while different
// days naturally vary.
//
// §23 guardrail: no entry here fabricates plant facts. Boost days change XP
// math only; challenge days pay out ONLY when the event router verifies the
// outcome against real persisted data; flavor days are pure language — the
// plant hums or reminisces, it never claims rain, weather, or sensor state.
//
// Local color: the demo plant physically lives in Jember, East Java (hence
// STREAK_TIMEZONE = Asia/Jakarta), so the pool celebrates real Jember life —
// sawah (rice paddies), coffee-and-cacao plantation country, the Coffee and
// Cocoa Research Institute, the Jember Fashion Carnaval, the volcanic soil
// between Mount Argopuro and Mount Raung. Rules for that flavor: everything
// user-visible stays English (Indonesian words appear only glossed, e.g.
// "sawah (rice paddies)"); days are phrased as celebrations or daydreams,
// never as claims about today's actual weather or the plant's sensors (§23);
// no invented farmers or quotes (§43); and the plant stays a basil — Jember's
// coffee is a neighbor to admire, not what Jamkachu is.

import { STREAK_TIMEZONE } from "@/types/game";
import { dayString } from "@/game/progression/streak-engine";

export interface DailyEvent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  kind: "xp_boost" | "daily_challenge" | "flavor";
  /** Only for kind 'xp_boost': multiplier on quest XP earned today (>1). */
  xpMultiplier?: number;
  /** Only for kind 'daily_challenge': one-time XP paid when verified. */
  challengeXp?: number;
}

/**
 * The fixed event pool. Order matters: the hash indexes into this array, so
 * inserting/reordering entries reshuffles which day gets which event (past
 * awards stay safe — reward keys embed the event id, not the index).
 */
export const DAILY_EVENT_POOL: DailyEvent[] = [
  {
    id: "GOLDEN_HOUR",
    name: "Golden Hour over the Sawah",
    description:
      "A day in honor of Jember's golden-hour light over the sawah (rice paddies) — quest XP is worth 1.5× all day.",
    emoji: "✨",
    kind: "xp_boost",
    xpMultiplier: 1.5,
  },
  {
    id: "DOUBLE_CARE",
    name: "Caretaker's Day",
    description:
      "Jember's coffee and cacao country runs on careful hands — in their honor, quest XP is worth 1.25× today.",
    emoji: "🤲",
    kind: "xp_boost",
    xpMultiplier: 1.25,
  },
  {
    id: "STEADY_DAY",
    name: "Steady Hands",
    description:
      "Tend me the way Jember's plantation rows are tended — keep me out of problem moods through the daytime (06:00–18:00) today for +15 XP.",
    emoji: "🧘",
    kind: "daily_challenge",
    challengeXp: 15,
  },
  {
    id: "JOURNAL_DAY",
    name: "Field Notes Day",
    description:
      "Jember hosts Indonesia's Coffee and Cocoa Research Institute — do some research of your own and log a growth record today for +10 XP.",
    emoji: "📓",
    kind: "daily_challenge",
    challengeXp: 10,
  },
  {
    id: "QUEST_FINISHER",
    name: "Little Panen Day",
    description:
      "Bring in a little panen (harvest) of our own — complete any quest today for +10 bonus XP.",
    emoji: "🎯",
    kind: "daily_challenge",
    challengeXp: 10,
  },
  {
    id: "CARNAVAL_DAY",
    name: "Carnaval Day",
    description:
      "I'm daydreaming about the Jember Fashion Carnaval — expect me to strike a pose or hum a parade tune.",
    emoji: "🎭",
    kind: "flavor",
  },
  {
    id: "PASAR_PAGI_DAY",
    name: "Market Morning",
    description:
      "I'm imagining the bustle of a pasar pagi (morning market) — baskets, chatter, fresh greens. I may talk your ear off today.",
    emoji: "🧺",
    kind: "flavor",
  },
  {
    id: "MOUNTAIN_MIST_DAY",
    name: "Mountain Mist Day",
    description:
      "My thoughts are drifting to the green slopes between Mount Argopuro and Mount Raung — somewhere misty and high today.",
    emoji: "⛰️",
    kind: "flavor",
  },
  {
    id: "VOLCANIC_SOIL_DAY",
    name: "Volcano-Soil Pride Day",
    description:
      "Jember's farmland grows rich on old volcanic soil — today I'm feeling extra proud to grow here.",
    emoji: "🌋",
    kind: "flavor",
  },
];

/**
 * FNV-1a 32-bit — tiny, dependency-free, and stable across platforms and
 * restarts (unlike anything seeded from Math.random or process state).
 * Exported so tests can pin the plantId|date → event mapping directly.
 */
export function hashDailyKey(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned so the modulo below can never see a negative index.
  return hash >>> 0;
}

function assertValidDate(date: Date, caller: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${caller}: invalid Date`);
  }
}

/**
 * The daily event for `plantId` on the WIB calendar day containing `date`
 * (default: now). Deterministic: same plant + same WIB day → same event, on
 * every server, every replay, every restart. The day boundary is midnight in
 * STREAK_TIMEZONE (Asia/Jakarta) — same calendar the streak and seasonal
 * engines count in — via the shared Intl-based dayString.
 */
export function getDailyEvent(plantId: string, date: Date = new Date()): DailyEvent {
  assertValidDate(date, "getDailyEvent");
  const day = dayString(date);
  return DAILY_EVENT_POOL[hashDailyKey(`${plantId}|${day}`) % DAILY_EVENT_POOL.length];
}

/**
 * e.g. "daily-challenge:plant-01:2026-08-07:JOURNAL_DAY" — deterministic per
 * (plant, WIB day, event), so the xp_rewards ledger turns re-verification
 * into a no-op (handoff §28). Embedding the event id keeps historical awards
 * unambiguous even if the pool is ever reordered.
 */
export function dailyChallengeRewardKey(
  plantId: string,
  dateString: string,
  eventId: string,
): string {
  return `daily-challenge:${plantId}:${dateString}:${eventId}`;
}

/** Quest-XP multiplier contributed by `event`: 1 unless it is an xp_boost. */
export function dailyBoostMultiplier(event: DailyEvent): number {
  return event.kind === "xp_boost" && event.xpMultiplier ? event.xpMultiplier : 1;
}

// ── WIB clock helper (for challenge windows) ────────────────────────────
// Built once at module load — Intl.DateTimeFormat construction is expensive
// (same reasoning as seasonal-events.ts). h23 keeps midnight as 0, not 24.

const WIB_HOUR_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: STREAK_TIMEZONE,
  hour: "numeric",
  hourCycle: "h23",
});

/** Hour of `date` on the WIB wall clock, 0–23. */
export function wibHour(date: Date): number {
  return Number(WIB_HOUR_FORMAT.format(date));
}
