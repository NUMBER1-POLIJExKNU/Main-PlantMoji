"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import { useCheat } from "@/lib/pm-cheat";

interface Reading {
  recorded_at?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  soil_ph?: number | null;
  light?: number | null;
}

interface Payload { latest: Reading | null; history: { recorded_at?: string | null }[] }
type StreamState = "connecting" | "live" | "stale" | "offline";

function shown(value: number | null | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return `—${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

/**
 * How long ago the newest reading arrived, in units a person can read.
 *
 * This printed `${seconds.toFixed(1)}s` at every scale, so a kit switched off
 * overnight reported "56430.0s" — a number nobody converts in their head, in
 * the one strip whose whole job is answering "is the garden talking to us?"
 * at a glance.
 *
 * Tenths of a second survive under a minute and only there: that range is the
 * live heartbeat, where 0.4s and 12s are meaningfully different. Past a
 * minute this is a duration, and two units is all a duration needs — "4h 37m",
 * never "4h 37m 12s".
 */
export function formatSensorAge(seconds: number, locale: AppLocale): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  // Indonesian: detik / menit / jam / hari. "h" is hari here rather than
  // hours — unambiguous because a reader only sees one locale's ladder.
  const u = locale === "id"
    ? { s: "dt", m: "mnt", h: "j", d: "h" }
    : { s: "s", m: "m", h: "h", d: "d" };
  if (seconds < 60) return `${seconds.toFixed(1)}${u.s}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${u.m} ${Math.floor(seconds % 60)}${u.s}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${u.h} ${minutes % 60}${u.m}`;
  return `${Math.floor(hours / 24)}${u.d} ${hours % 24}${u.h}`;
}

export default function LiveActivityBar({ locale, plantId = "plant-01" }: { locale: AppLocale; plantId?: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [requestOk, setRequestOk] = useState<boolean | null>(null);
  const [now, setNow] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let previousStamp: string | null = null;
    // inFlight skips a tick outright while a request is still pending (a
    // slow response could otherwise overlap the next 5s poll); requestToken
    // is a second guard so that even if a request somehow outlives a newer
    // one, its response can never overwrite state the newer one already set.
    let inFlight = false;
    let requestToken = 0;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      const token = ++requestToken;
      try {
        const response = await fetch(`/api/sensor-history?plantId=${encodeURIComponent(plantId)}&minutes=60`, { cache: "no-store" });
        if (!response.ok) throw new Error("sensor stream unavailable");
        const next = await response.json() as Payload;
        if (cancelled || token !== requestToken) return;
        const stamp = next.latest?.recorded_at ?? null;
        if (stamp && stamp !== previousStamp) setPulse((value) => value + 1);
        previousStamp = stamp;
        setPayload(next);
        setRequestOk(true);
      } catch {
        if (!cancelled && token === requestToken) setRequestOk(false);
      } finally {
        inFlight = false;
      }
    };
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 5_000);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    // Re-prime on tab refocus instead of waiting up to 5s for the next poll
    // tick — a presenter tabbing back mid-demo should see fresh data at once.
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [plantId]);

  const ageSeconds = useMemo(() => {
    const stamp = payload?.latest?.recorded_at;
    if (!stamp || !now) return null;
    const ms = Date.parse(stamp);
    return Number.isFinite(ms) ? Math.max(0, (now - ms) / 1000) : null;
  }, [now, payload?.latest?.recorded_at]);
  const spanMinutes = useMemo(() => {
    const rows = payload?.history ?? [];
    if (rows.length < 2) return 0;
    const first = Date.parse(rows[0].recorded_at ?? "");
    const last = Date.parse(rows[rows.length - 1].recorded_at ?? "");
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
    return Math.max(1, Math.round(Math.abs(last - first) / 60_000));
  }, [payload?.history]);
  const streamState: StreamState = requestOk === null ? "connecting" : !requestOk || ageSeconds == null ? "offline" : ageSeconds <= 30 ? "live" : ageSeconds <= 120 ? "stale" : "offline";
  // This strip sits above every React route, so during a classroom demo it was
  // reporting the real hardware feed a few pixels above the sandbox values —
  // the same contradiction the Monitoring cards had. Mirror the sandbox and say
  // plainly that these are demo numbers. Client-only, and the fetch loop keeps
  // running so leaving the sandbox snaps back to the real stream.
  const { active: cheatActive, state: cheatState } = useCheat();
  const demo = cheatActive && cheatState ? cheatState.vitals : null;
  const state = demo ? "live" : streamState;
  const latest = payload?.latest;
  const label = demo
    ? (locale === "id" ? "MODE CURANG" : "CHEAT MODE")
    : locale === "id"
      ? { connecting: "MENGHUBUNGKAN", live: "SENSOR LANGSUNG", stale: "DATA TERLAMBAT", offline: "SENSOR OFFLINE" }[streamState]
      : { connecting: "CONNECTING", live: "LIVE SENSOR", stale: "STALE DATA", offline: "SENSOR OFFLINE" }[streamState];

  return <aside className={`pm-live-activity is-${state}`} aria-label={locale === "id" ? "Aktivitas sensor langsung" : "Live sensor activity"}>
    <div className="pm-live-source"><i key={pulse} aria-hidden="true" /><strong>{label}</strong><span>{demo ? (locale === "id" ? "demo" : "demo") : ageSeconds == null ? "—" : formatSensorAge(ageSeconds, locale)}</span></div>
    <div className="pm-live-values" aria-live="polite">
      <span>🌡 {shown(demo ? demo.temperature : latest?.temperature, "°")}</span><span>💧 {shown(demo ? demo.humidity : latest?.humidity, "%")}</span><span>🧪 {shown(demo ? demo.soilPh : latest?.soil_ph, "")}</span><span>☀ {shown(demo ? demo.light : latest?.light, "%")}</span>
    </div>
    {/* "60 mnt" was hardcoded and wrong: the route caps at 1000 rows, which at
        a 2s cadence is ~34 minutes, and while the kit is off the window is
        anchored on the last reading instead of on now. Measure it. */}
    <small>{demo ? (locale === "id" ? "nilai demo" : "demo values") : locale === "id" ? `${payload?.history?.length ?? 0} sampel · ${spanMinutes} mnt` : `${payload?.history?.length ?? 0} samples · ${spanMinutes} min`}</small>
  </aside>;
}
