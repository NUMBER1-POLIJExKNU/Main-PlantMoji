// Seasonal events — handoff §23.
//
// MVP is pure TypeScript config: no scheduler service, no I/O, no database.
// An event is "active" when the current calendar date in STREAK_TIMEZONE
// (Asia/Jakarta, WIB — same zone the streak engine counts days in) falls
// inside its inclusive start..end window, and — for recurring weekend-style
// bonuses — the WIB weekday matches `daysOfWeek`.
//
// Windows follow Jember's real climate calendar: musim kemarau (the dry
// season) roughly May–October, musim hujan (the rainy season) roughly
// November–April.
//
// Deliberately NOT included (handoff §23 caution): a live "Rainy Day" event.
// The handoff forbids claiming rain is falling without actual weather data, a
// rain sensor, or manual activation. The MUSIM_HUJAN event below stays inside
// that rule: it is a fixed calendar-season window, framed as the season —
// it never asserts rain at any particular moment.

import { STREAK_TIMEZONE } from "@/types/game";

export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  /** Inclusive first active calendar date, 'YYYY-MM-DD' in STREAK_TIMEZONE. */
  start: string;
  /** Inclusive last active calendar date, 'YYYY-MM-DD' in STREAK_TIMEZONE. */
  end: string;
  /** Multiplier applied to base XP while active (e.g. 1.2 = +20%). */
  xpMultiplier: number;
  /**
   * Optional weekday filter, 0–6 Sunday-based (JS Date convention), evaluated
   * in STREAK_TIMEZONE. When set, the event is only active on those weekdays
   * within the start..end window — e.g. [0, 6] for a weekend bonus.
   */
  daysOfWeek?: number[];
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    // The handoff §23 example event — dates and multiplier kept verbatim,
    // copy localized to Jember's dry season.
    id: "HOT_WEATHER",
    name: "Musim Kemarau Heat Challenge",
    description:
      "August is deep musim kemarau (the dry season) in Jember. Keep your plant cool through the heat — care quests award 20% bonus XP all month.",
    start: "2026-08-01",
    end: "2026-08-31",
    xpMultiplier: 1.2,
  },
  {
    id: "WEEKEND_GROWTH",
    name: "Weekend Growth Bonus",
    description:
      "Slow weekend mornings are for tending — care quests award 10% bonus XP every Saturday and Sunday.",
    start: "2026-08-01",
    end: "2026-12-31",
    xpMultiplier: 1.1,
    daysOfWeek: [0, 6],
  },
  {
    // Jember's rainy season, as a fixed calendar window (see header note —
    // this is a season, never a claim that rain is falling right now).
    id: "MUSIM_HUJAN",
    name: "Musim Hujan Growing Season",
    description:
      "Musim hujan (the rainy season) settles over Jember. Out in the fields the rain does part of the watering — but growth still takes teamwork, and a windowsill plant counts on you. Care quests award 15% bonus XP all season.",
    start: "2026-11-01",
    end: "2027-04-30",
    xpMultiplier: 1.15,
  },
];

// ── WIB calendar helpers ────────────────────────────────────────────────
//
// Intl.DateTimeFormat instances are comparatively expensive to construct, so
// build them once at module load. 'en-CA' formats dates as YYYY-MM-DD (no
// manual part reassembly — same trick as the streak engine); 'en-US' short
// weekday names are stable "Sun".."Sat" tokens.

const WIB_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: STREAK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WIB_WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: STREAK_TIMEZONE,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function assertValidDate(date: Date, caller: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${caller}: invalid Date`);
  }
}

/** Calendar date of `date` in STREAK_TIMEZONE as 'YYYY-MM-DD'. */
function wibDayString(date: Date): string {
  return WIB_DATE_FORMAT.format(date);
}

/** Weekday of `date` in STREAK_TIMEZONE, 0–6 Sunday-based. */
function wibWeekday(date: Date): number {
  return WEEKDAY_INDEX[WIB_WEEKDAY_FORMAT.format(date)];
}

// ── Queries ─────────────────────────────────────────────────────────────

/**
 * Events active at `date` (default: now): the WIB calendar date lies inside
 * the inclusive start..end window and, if `daysOfWeek` is set, the WIB
 * weekday matches. 'YYYY-MM-DD' strings compare correctly lexicographically.
 */
export function getActiveSeasonalEvents(date: Date = new Date()): SeasonalEvent[] {
  assertValidDate(date, "getActiveSeasonalEvents");
  const day = wibDayString(date);
  const weekday = wibWeekday(date);

  return SEASONAL_EVENTS.filter(
    (event) =>
      event.start <= day &&
      day <= event.end &&
      (event.daysOfWeek === undefined || event.daysOfWeek.includes(weekday)),
  );
}

/**
 * Applies the seasonal XP bonus to `baseAmount`.
 *
 * When multiple events overlap, only the HIGHEST multiplier applies — bonuses
 * never stack (e.g. a weekend inside Hot Weather month is ×1.2, not ×1.32).
 * With no active event the amount passes through unchanged. The result is
 * rounded to a whole XP amount; `active` lists every concurrently active
 * event so callers can surface all of them in the UI.
 */
export function applySeasonalMultiplier(
  baseAmount: number,
  date?: Date,
): { amount: number; active: SeasonalEvent[] } {
  const active = getActiveSeasonalEvents(date);
  const multiplier = active.reduce((max, event) => Math.max(max, event.xpMultiplier), 1);
  return { amount: Math.round(baseAmount * multiplier), active };
}
