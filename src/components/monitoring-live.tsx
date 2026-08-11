"use client";

// Live monitoring panel: fetches /api/sensor-history on mount and every 10s,
// renders the three gauges + the light chart. Follows the quest-progress
// timer conventions: no sync setState in the effect body (the first fetch is
// deferred through requestAnimationFrame; all setState happens in async
// callbacks), and "last updated" is client-only state so hydration matches.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { LightMode, LightPoint } from "@/components/light-chart";
import type { AppLocale } from "@/lib/i18n";
import { hasSufficientLight, LIGHT_PERCENT_MAX } from "@/lib/light-sensor";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat } from "@/lib/pm-cheat";

const REFRESH_MS = 10_000;

// recharts is the heaviest dependency in the app; light-chart.tsx pulls it
// in, so it's loaded on demand (client-only, no SSR) instead of shipping in
// the initial /monitoring bundle. Only type-only imports of light-chart.tsx
// remain above — those are erased at compile time and carry no runtime cost,
// so this file has no static value import of the recharts-bearing module.
const LightChart = dynamic(() => import("@/components/light-chart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] w-full motion-safe:animate-pulse items-center justify-center text-sm text-[#57684F]">
      …
    </div>
  ),
});

// Local copy of light-chart's formatTime: keeping this here (instead of a
// static import from light-chart.tsx) means "Last updated" formatting never
// pulls the recharts-bearing module into this file's static import graph.
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** 1717082973000 → "20:14:33" (viewer's local time). Mirrors light-chart.tsx's formatTime. */
function formatTime(ms: number): string {
  return timeFormat.format(new Date(ms));
}

interface LatestReading {
  recorded_at?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  soil_ph?: number | null;
  soil_moisture?: number | null;
  light?: number | null;
  light_lux?: number | null;
}

interface HistoryRow {
  recorded_at: string;
  light: number | null;
  light_lux: number | null;
}

interface SensorHistoryPayload {
  latest: LatestReading | null;
  history: HistoryRow[];
}

type FetchState = "loading" | "ok" | "no-env" | "error";

/** Supabase numerics arrive as JSON numbers; anything else → null. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const COPY = {
  id: { demo: "MODE CURANG · NILAI DEMO", demoNote: "Nilai demo", live: "SENSOR AKTIF", connecting: "MENGHUBUNGKAN SENSOR", retrying: "MENCOBA LAGI", updated: "Diperbarui", real: "Pembacaan lingkungan saat ini", intro: "Empat pengukuran yang digunakan PlantMoji untuk memahami lingkungan.", temperature: "Suhu", humidity: "Kelembapan udara", soilPh: "pH tanah", light: "Cahaya", noSensor: "Belum ada data", sufficient: "Cukup", low: "Rendah", trend: "Riwayat cahaya · 1 jam", waiting: "Menunggu pembacaan sensor…", noEnv: "Kebun belum dapat menerima pembacaan langsung. Coba lagi sebentar.", error: "Sensor belum dapat dijangkau. PlantMoji akan mencoba lagi secara otomatis.", idealRanges: "Rentang ideal", liveWord: "Langsung" },
  en: { demo: "CHEAT MODE · DEMO VALUES", demoNote: "Demo value", live: "SENSORS LIVE", connecting: "CONNECTING SENSORS", retrying: "RETRYING", updated: "Updated", real: "Current environment", intro: "The four measurements PlantMoji uses to understand the environment.", temperature: "Temperature", humidity: "Air humidity", soilPh: "Soil pH", light: "Light", noSensor: "No data yet", sufficient: "Sufficient", low: "Low", trend: "Light history · 1 hour", waiting: "Waiting for sensor readings…", noEnv: "The garden cannot receive live readings yet. Try again in a moment.", error: "The sensors cannot be reached yet. PlantMoji will retry automatically.", idealRanges: "Ideal ranges", liveWord: "Live" },
} as const;

function ReadingCard({ icon, label, value, unit, accent, note, liveNote }: { icon: string; label: string; value: number | null; unit: string; accent: string; note?: string; liveNote: string }) {
  return (
    <article className="pm-panel pm-monitor-reading" style={{ "--sensor-accent": accent } as CSSProperties}>
      <div className="pm-monitor-reading-head"><span aria-hidden="true">{icon}</span><h2>{label}</h2></div>
      <div className="pm-monitor-reading-value">{value == null ? "—" : value}<small>{value == null ? "" : unit}</small></div>
      <div className="pm-monitor-reading-foot"><span className={value == null ? "is-waiting" : "is-live"} />{note ?? liveNote}</div>
    </article>
  );
}

interface ComfortRange {
  min: number;
  max: number;
}

interface ComfortRanges {
  temperature: ComfortRange;
  humidity: ComfortRange;
  soilPh: ComfortRange;
  /** 0–100 calibrated percent scale (milestone15) — never lux. */
  light: ComfortRange;
}

/**
 * Sensor HUD spec (2026-08-09): the comfort band shown behind each chart's
 * series line, and the range-legend card, must read the SAME thresholds the
 * quest engine reads off the active crop profile (`@/lib/crop-profiles`) —
 * never a hand-typed display number, so a profile change moves the engine
 * and this UI together. Display rule: one clean min–max line per sensor,
 * using the RECOVER-side threshold on whichever edge the profile defines
 * enter/recover hysteresis for (quest-engine.ts reads the identical fields
 * — overheating.recoverAtOrBelow, dryAir.recoverAtOrAbove); the profile's
 * `recommended` bound fills the edge that has no hysteresis concept.
 */
function comfortRangesFromProfile(profile: CropProfile): ComfortRanges {
  // recommended.{min,max} on every axis — the SAME fields the farm HUD's
  // gauge band and /plants "Ideal" rows print, so all three surfaces show
  // one identical range (review fix: no recover-side/recommended mix).
  return {
    temperature: {
      min: profile.temperature.recommended.min,
      max: profile.temperature.recommended.max,
    },
    humidity: {
      min: profile.airHumidity.recommended.min,
      max: profile.airHumidity.recommended.max,
    },
    soilPh: {
      min: profile.soilPh.recommended.min,
      max: profile.soilPh.recommended.max,
    },
    light: {
      min: profile.light.minimumPercentDuringLightingHours,
      max: LIGHT_PERCENT_MAX,
    },
  };
}

function formatRange({ min, max }: ComfortRange, unit: string): string {
  return `${min}–${max}${unit}`;
}

/** Compact card listing all four suitable ranges for the active crop —
 * renders nothing when `ranges` is null (profile unavailable), per spec. */
function RangeLegend({
  displayName,
  ranges,
  c,
}: {
  displayName: string;
  ranges: ComfortRanges;
  c: (typeof COPY)[AppLocale];
}) {
  const rows = [
    { icon: "🌡️", label: c.temperature, value: formatRange(ranges.temperature, "°C") },
    { icon: "💧", label: c.humidity, value: formatRange(ranges.humidity, "%") },
    { icon: "🧪", label: c.soilPh, value: formatRange(ranges.soilPh, "") },
    { icon: "☀️", label: c.light, value: formatRange(ranges.light, "%") },
  ];
  return (
    <section className="pm-panel">
      <div className="flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">🌱</span>
        <div>
          <h2 className="pm-heading text-xs">{displayName} · {c.idealRanges}</h2>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-xs sm:flex-col sm:items-start sm:gap-1">
            <span className="flex items-center gap-1.5 opacity-80"><span aria-hidden="true">{row.icon}</span>{row.label}</span>
            <span className="tabular-nums font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MonitoringLive({
  plantId = "plant-01",
  locale = "id",
  cropProfile = null,
}: {
  plantId?: string;
  locale?: AppLocale;
  /** The plant's active crop profile (server-fetched — see monitoring/page.tsx),
   * or null when unavailable. Source of truth for the comfort band + legend;
   * never invented client-side. */
  cropProfile?: CropProfile | null;
}) {
  const [payload, setPayload] = useState<SensorHistoryPayload | null>(null);
  const [state, setState] = useState<FetchState>("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(
          `/api/sensor-history?plantId=${encodeURIComponent(plantId)}&minutes=60`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.status === 503) {
          setState("no-env");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const data = (await res.json()) as SensorHistoryPayload;
        if (cancelled) return;
        // Previous data is only ever replaced, never cleared — no skeleton
        // flash on refetch.
        setPayload(data);
        setState("ok");
        setUpdatedAt(formatTime(Date.now()));
      } catch {
        if (!cancelled) setState("error");
      } finally {
        inFlight = false;
      }
    };

    const raf = requestAnimationFrame(() => {
      void load();
    });
    const id = setInterval(() => {
      void load();
    }, REFRESH_MS);
    // Re-prime on tab refocus instead of waiting up to REFRESH_MS for the
    // next tick — the inFlight guard above keeps this a no-op if a poll is
    // already in progress.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [plantId]);

  const latest = payload?.latest ?? null;
  const history = useMemo(() => payload?.history ?? [], [payload]);

  // Prefer real lux history when supplied; otherwise plot Node-RED's relative
  // 0–100% light value without relabeling it as lux.
  const hasLux = useMemo(
    () => history.some((row) => typeof row.light_lux === "number"),
    [history],
  );
  const points = useMemo<LightPoint[]>(() => {
    const out: LightPoint[] = [];
    for (const row of history) {
      const t = Date.parse(row.recorded_at);
      if (!Number.isFinite(t)) continue;
      if (hasLux) {
        if (typeof row.light_lux === "number") out.push({ t, value: row.light_lux });
      } else if (typeof row.light === "number") {
        out.push({ t, value: row.light });
      }
    }
    return out;
  }, [history, hasLux]);
  const mode: LightMode = hasLux ? "lux" : "percent";
  const ranges = useMemo(
    () => (cropProfile ? comfortRangesFromProfile(cropProfile) : null),
    [cropProfile],
  );
  const c = COPY[locale];
  // Classroom sandbox: the editor above this panel was writing to the store
  // while these cards kept rendering the real feed and labelling it "Live
  // reading", so a demo showed two different temperatures at once. When the
  // sandbox owns the screen it owns these cards too. Client-only — nothing
  // here reaches Supabase or hardware, and the fetch loop is left running so
  // exiting the sandbox snaps straight back to the real numbers.
  const { active: cheatActive, state: cheatState } = useCheat();
  const demo = cheatActive && cheatState ? cheatState.vitals : null;
  const temperature = demo ? demo.temperature : num(latest?.temperature);
  const humidity = demo ? demo.humidity : num(latest?.humidity);
  const soilPh = demo ? demo.soilPh : num(latest?.soil_ph);
  const light = demo ? demo.light : num(latest?.light);
  const readingNote = demo ? c.demoNote : undefined;
  const statusLabel = demo
    ? c.demo
    : state === "ok" ? c.live : state === "loading" ? c.connecting : c.retrying;

  return (
    <div className="pm-monitor-dashboard">
      <section className="pm-monitor-status" aria-live="polite">
        <div><span className={`pm-monitor-status-dot ${state === "ok" ? "is-live" : ""}`} /><strong>{statusLabel}</strong></div>
        <span className="tabular-nums">{updatedAt ? `${c.updated} ${updatedAt}` : c.connecting}</span>
      </section>

      {state === "no-env" && (
        <p className="mb-3 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] px-3 py-2 text-xs leading-5 text-[#7A5B12]">
          {c.noEnv}
        </p>
      )}
      {state === "error" && (
        <p className="mb-3 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] px-3 py-2 text-xs leading-5 text-[#7A5B12]">
          {c.error}
        </p>
      )}

      <div className="pm-monitor-reading-grid">
        {/* liveNote is the short dedicated "live" word (id "Langsung" / en
            "Live") — the status bar above already says sensors are live, so
            the cards no longer repeat the "Current environment" sentence.
            readingNote overrides it with the demo-data note in demo mode. */}
        <ReadingCard icon="🌡️" label={c.temperature} value={temperature} unit="°C" accent="#EF8B6C" liveNote={c.liveWord} note={temperature == null ? c.noSensor : readingNote} />
        <ReadingCard icon="💧" label={c.humidity} value={humidity} unit="%" accent="#4DA1ED" liveNote={c.liveWord} note={humidity == null ? c.noSensor : readingNote} />
        <ReadingCard icon="🧪" label={c.soilPh} value={soilPh} unit="" accent="#AA7E55" liveNote={c.liveWord} note={soilPh == null ? c.noSensor : readingNote} />
        <ReadingCard icon="☀️" label={c.light} value={light} unit="%" accent="#F2C84B" liveNote={c.liveWord} note={light == null ? c.noSensor : readingNote ?? (hasSufficientLight(light) ? c.sufficient : c.low)} />
      </div>

      {ranges && cropProfile && (
        <RangeLegend displayName={cropProfile.displayName} ranges={ranges} c={c} />
      )}

      <section className="pm-panel pm-monitor-chart">
        <div className="pm-monitor-chart-head"><div><span>☀️</span><div><h2>{c.trend}</h2><p>{mode === "lux" ? "Lux" : "0–100%"}</p></div></div></div>
        {points.length > 0 ? (
          // The comfort band only overlays the calibrated 0–100% percent
          // scale (milestone15) — a "lux" chart has no matching profile
          // range, so no band is passed and LightChart draws unchanged.
          <LightChart points={points} mode={mode} band={mode === "percent" ? ranges?.light : undefined} />
        ) : (
          <div className="flex h-[260px] items-center justify-center text-sm text-[#57684F]">
            {c.waiting}
          </div>
        )}
      </section>
    </div>
  );
}
