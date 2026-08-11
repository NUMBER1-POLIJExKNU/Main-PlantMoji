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

interface Payload { latest: Reading | null; history: unknown[] }
type StreamState = "connecting" | "live" | "stale" | "offline";

function shown(value: number | null | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return `—${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

export default function LiveActivityBar({ locale, plantId = "plant-01" }: { locale: AppLocale; plantId?: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [requestOk, setRequestOk] = useState<boolean | null>(null);
  const [now, setNow] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let previousStamp: string | null = null;
    const load = async () => {
      try {
        const response = await fetch(`/api/sensor-history?plantId=${encodeURIComponent(plantId)}&minutes=60`, { cache: "no-store" });
        if (!response.ok) throw new Error("sensor stream unavailable");
        const next = await response.json() as Payload;
        if (cancelled) return;
        const stamp = next.latest?.recorded_at ?? null;
        if (stamp && stamp !== previousStamp) setPulse((value) => value + 1);
        previousStamp = stamp;
        setPayload(next);
        setRequestOk(true);
      } catch {
        if (!cancelled) setRequestOk(false);
      }
    };
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 5_000);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => { cancelled = true; window.clearTimeout(first); window.clearInterval(poll); window.clearInterval(clock); };
  }, [plantId]);

  const ageSeconds = useMemo(() => {
    const stamp = payload?.latest?.recorded_at;
    if (!stamp || !now) return null;
    const ms = Date.parse(stamp);
    return Number.isFinite(ms) ? Math.max(0, (now - ms) / 1000) : null;
  }, [now, payload?.latest?.recorded_at]);
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
    <div className="pm-live-source"><i key={pulse} aria-hidden="true" /><strong>{label}</strong><span>{demo ? (locale === "id" ? "demo" : "demo") : ageSeconds == null ? "—" : `${ageSeconds.toFixed(1)}s`}</span></div>
    <div className="pm-live-values" aria-live="polite">
      <span>🌡 {shown(demo ? demo.temperature : latest?.temperature, "°")}</span><span>💧 {shown(demo ? demo.humidity : latest?.humidity, "%")}</span><span>🧪 {shown(demo ? demo.soilPh : latest?.soil_ph, "")}</span><span>☀ {shown(demo ? demo.light : latest?.light, "%")}</span>
    </div>
    <small>{demo ? (locale === "id" ? "nilai demo" : "demo values") : locale === "id" ? `${payload?.history?.length ?? 0} sampel · 60 mnt` : `${payload?.history?.length ?? 0} samples · 60 min`}</small>
  </aside>;
}
