"use client";

// Shared client access to the developer clock override (public/farm/
// devclock.js → window.PMClock). Client-only: everything here reads one
// integer out of localStorage, never Supabase and never the hardware.
//
// Consumers must go through devNow() rather than reading window.PMClock
// directly, for two reasons: the script may not have parsed yet (React
// routes load it beforeInteractive, but a test renderer or a stale cached
// HTML shell will not have it), and the fallback has to be `new Date()`
// everywhere — an override that is merely absent must look exactly like an
// override set to zero.

import { useEffect, useState } from "react";

export interface PMClockApi {
  /** Milliseconds added to real time. 0 = no override. */
  offsetMs: () => number;
  isActive: () => boolean;
  /** Real time + offset. NOT a patched Date.now — see devclock.js. */
  now: () => Date;
  wib: () => { date: string; hour: number; minute: number } | null;
  realWib: () => { date: string; hour: number; minute: number } | null;
  /** "HH:MM" of the effective / real WIB wall clock. */
  label: () => string;
  realLabel: () => string;
  setOffsetMs: (value: number) => void;
  /** Shift so WIB reads hour:minute right now, then let it run at 1x. */
  setWibTime: (hour: number, minute?: number) => void;
  clear: () => void;
  onChange: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    PMClock?: PMClockApi;
  }
}

/**
 * The Date that every WIB-derived readout should be built from.
 *
 * Only "what time of day is it in Jember?" questions may use this. Anything
 * measuring ELAPSED time — cooldowns, throttles, rate limits, animation —
 * must keep using Date.now(), which the override deliberately leaves alone.
 */
export function devNow(): Date {
  if (typeof window === "undefined") return new Date();
  try {
    return window.PMClock?.now() ?? new Date();
  } catch {
    return new Date();
  }
}

/**
 * The raw shift, for the rare caller that already holds a timestamp and needs
 * the wall-clock version of it. Prefer devNow(); this exists because some
 * components derive BOTH an elapsed-time value and a time-of-day value from a
 * single `now` state, and only the second one may be shifted.
 */
export function devClockOffsetMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    return window.PMClock?.offsetMs() ?? 0;
  } catch {
    return 0;
  }
}

/** Live view of the override for panels that display or edit it. */
export function useDevClock(): { active: boolean; api: PMClockApi | null; tick: number } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const api = window.PMClock;
    if (!api) return;
    const bump = () => setTick((n) => n + 1);
    const unsubscribe = api.onChange(bump);
    // The effective minute rolls over on its own; without this the panel
    // would show a frozen "now" until the next edit.
    const id = window.setInterval(bump, 20_000);
    return () => {
      unsubscribe();
      window.clearInterval(id);
    };
  }, []);

  const api = typeof window === "undefined" ? null : window.PMClock ?? null;
  return { active: Boolean(api?.isActive()), api, tick };
}
