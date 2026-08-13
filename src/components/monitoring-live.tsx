"use client";

// Live monitoring panel: fetches /api/sensor-history on mount and every 10s,
// renders the three gauges + the light chart. Follows the quest-progress
// timer conventions: no sync setState in the effect body (the first fetch is
// deferred through requestAnimationFrame; all setState happens in async
// callbacks), and "last updated" is client-only state so hydration matches.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import SensorHistoryCharts, { type HistorySample, type SeriesKey } from "@/components/sensor-history-charts";
import type { AppLocale } from "@/lib/i18n";
import { hasSufficientLight, LIGHT_PERCENT_MAX } from "@/lib/light-sensor";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat } from "@/lib/pm-cheat";

const REFRESH_MS = 10_000;

/**
 * How old the newest reading may be before the kit counts as offline.
 *
 * `state === "ok"` only ever meant "the HTTP request succeeded". The history
 * route answers 200 with the last stored row no matter how old it is, so a
 * kit that stopped pushing hours ago still lit the green "SENSORS LIVE" dot
 * over its own final numbers — and the "Updated" stamp beside it showed the
 * time of the FETCH, which made a dead feed look freshly delivered.
 *
 * Measured against this kit: 1000 consecutive rows push at a 2.0s median,
 * worst observed gap 3.5s, and zero gaps over 60s. Three minutes is ~90x the
 * median and ~50x the worst real gap, so a Wi-Fi blip or a Node-RED restart
 * cannot trip it, while a genuinely dead device is admitted within one demo
 * breath. Also comfortably longer than REFRESH_MS, so the label cannot
 * flicker between two polls.
 */
export const SENSOR_STALE_AFTER_MS = 3 * 60_000;

// The history charts are plain SVG (see sensor-history-charts.tsx) — small
// enough to import statically, and with no recharts there is no longer a
// heavyweight module to keep out of this route's bundle.
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
  temperature: number | null;
  humidity: number | null;
  soil_ph: number | null;
  light: number | null;
  light_lux: number | null;
}

interface SensorHistoryPayload {
  latest: LatestReading | null;
  history: HistoryRow[];
}

type FetchState = "loading" | "ok" | "no-env" | "error";

export type SensorStatus = "demo" | "connecting" | "retrying" | "offline" | "live";

/**
 * ONE derived state feeds the status dot, the status label, the timestamp
 * beside it, and all four reading cards.
 *
 * Deriving them separately is exactly what produced the bug this replaces:
 * the dot read `state === "ok"` (the HTTP call worked) and lit green, the
 * timestamp printed the poll clock, and the four cards printed their numbers
 * with a "Live" note — all sitting above a history chart that correctly said
 * "no readings in the last hour". Same shape as camera-guardian's resultView,
 * and for the same reason.
 *
 * Pure and exported so the threshold is testable without a DOM.
 */
export function sensorStatus({ state, lastReadingMs, nowMs, demo }: {
  state: FetchState;
  /** epoch ms of the newest stored reading; null = none, or unparseable. */
  lastReadingMs: number | null;
  nowMs: number;
  demo: boolean;
}): SensorStatus {
  if (demo) return "demo"; // sandbox values have no recorded_at and never go stale
  if (state === "loading") return "connecting";
  if (state !== "ok") return "retrying"; // error + no-env keep their own banners
  // Unknown age is never reported as fresh.
  if (lastReadingMs === null) return "offline";
  return nowMs - lastReadingMs > SENSOR_STALE_AFTER_MS ? "offline" : "live";
}

/** Supabase numerics arrive as JSON numbers; anything else → null. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const COPY = {
  id: { demo: "MODE CURANG · NILAI DEMO", demoNote: "Nilai demo", live: "SENSOR AKTIF", connecting: "MENGHUBUNGKAN SENSOR", retrying: "MENCOBA LAGI", updated: "Diperbarui", real: "Pembacaan lingkungan saat ini", intro: "Empat pengukuran yang digunakan PlantMoji untuk memahami lingkungan.", temperature: "Suhu", humidity: "Kelembapan udara", soilPh: "pH tanah", light: "Cahaya", noSensor: "Belum ada data", sufficient: "Cukup", low: "Rendah", trend: "Riwayat sensor", trendNote: (mins: number) => `${mins} mnt terakhir · arahkan kursor untuk melihat nilai pada waktu tertentu`, airGroup: "Udara", soilLightGroup: "Tanah & cahaya", waiting: "Menunggu pembacaan sensor…", noRecent: "Belum ada pembacaan dalam 1 jam terakhir.", lastSeen: "Pembacaan terakhir:", noEnv: "Kebun belum dapat menerima pembacaan langsung. Coba lagi sebentar.", error: "Sensor belum dapat dijangkau. PlantMoji akan mencoba lagi secara otomatis.", idealRanges: "Rentang ideal", liveWord: "Langsung", offline: "SENSOR TERPUTUS", staleWord: "Data lama", staleBanner: (at: string) => `Tidak ada pembacaan baru. Angka di bawah ini adalah yang terakhir diterima, pukul ${at}.`, trendFrozen: (at: string, mins: number) => `${mins} mnt terakhir sebelum sensor berhenti, pukul ${at}` },
  en: { demo: "CHEAT MODE · DEMO VALUES", demoNote: "Demo value", live: "SENSORS LIVE", connecting: "CONNECTING SENSORS", retrying: "RETRYING", updated: "Updated", real: "Current environment", intro: "The four measurements PlantMoji uses to understand the environment.", temperature: "Temperature", humidity: "Air humidity", soilPh: "Soil pH", light: "Light", noSensor: "No data yet", sufficient: "Sufficient", low: "Low", trend: "Sensor history", trendNote: (mins: number) => `Last ${mins} min · hover to read the values at any moment`, airGroup: "Air", soilLightGroup: "Soil & light", waiting: "Waiting for sensor readings…", noRecent: "No readings in the last hour.", lastSeen: "Last reading:", noEnv: "The garden cannot receive live readings yet. Try again in a moment.", error: "The sensors cannot be reached yet. PlantMoji will retry automatically.", idealRanges: "Ideal ranges", liveWord: "Live", offline: "SENSORS OFFLINE", staleWord: "Stale", staleBanner: (at: string) => `No new readings arriving. The numbers below are the last ones received, at ${at}.`, trendFrozen: (at: string, mins: number) => `The ${mins} min before the sensors stopped, at ${at}` },
} as const;

function ReadingCard({ icon, label, value, unit, accent, note, liveNote, stale }: { icon: string; label: string; value: number | null; unit: string; accent: string; note?: string; liveNote: string; stale?: boolean }) {
  return (
    <article className="pm-panel pm-monitor-reading" style={{ "--sensor-accent": accent } as CSSProperties}>
      <div className="pm-monitor-reading-head"><span aria-hidden="true">{icon}</span><h2>{label}</h2></div>
      <div className="pm-monitor-reading-value">{value == null ? "—" : value}<small>{value == null ? "" : unit}</small></div>
      {/* A stale card keeps its number — the last known reading is still the
          most useful thing to show — but must never wear the live dot. */}
      <div className="pm-monitor-reading-foot"><span className={value == null ? "is-waiting" : stale ? "is-stale" : "is-live"} />{note ?? liveNote}</div>
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
  const [polledAt, setPolledAt] = useState<number | null>(null);

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
        const at = Date.now();
        setUpdatedAt(formatTime(at));
        // Reading age is measured against the poll clock rather than a
        // Date.now() during render: render must stay pure (react-hooks/purity),
        // and every poll refreshes this anyway, so the age can never be more
        // than REFRESH_MS behind while the page is actually updating.
        setPolledAt(at);
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

  // One sample per row carrying all four sensors, so both panels share an
  // x-axis and a hover index. light stays the calibrated 0–100% value
  // (milestone15); light_lux is deliberately not plotted here — it is null in
  // every row this kit has ever recorded, and a second scale for an empty
  // column would only add an axis nobody can read.
  const samples = useMemo<HistorySample[]>(() => {
    const out: HistorySample[] = [];
    for (const row of history) {
      const t = Date.parse(row.recorded_at);
      if (!Number.isFinite(t)) continue;
      out.push({
        t,
        temperature: num(row.temperature),
        humidity: num(row.humidity),
        soilPh: num(row.soil_ph),
        light: num(row.light),
      });
    }
    return out;
  }, [history]);
  // The newest reading of any age, for telling "never arrived" apart from
  // "arrived, but older than this chart's window".
  const lastReadingMs = useMemo(() => {
    const raw = latest?.recorded_at;
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }, [latest]);
  const lastReadingAt = lastReadingMs === null ? null : formatTime(lastReadingMs);
  // The span the chart ACTUALLY covers, not the hour that was asked for. At a
  // 2s cadence an hour is ~1800 rows and PostgREST hands back at most 1000, so
  // the window has always been the newest ~34 minutes — labelling it "1 hour"
  // was off by half. Read from the samples so it stays honest at any cadence.
  const spanMinutes = samples.length > 1
    ? Math.max(1, Math.round((samples[samples.length - 1].t - samples[0].t) / 60_000))
    : 0;
  const ranges = useMemo(
    () => (cropProfile ? comfortRangesFromProfile(cropProfile) : null),
    [cropProfile],
  );
  // Same object, keyed the way the charts index their series. Derived from
  // `ranges` rather than the profile again, so the bands behind the lines and
  // the numbers in the legend card can never drift apart.
  const historyBands = useMemo<Record<SeriesKey, { min: number; max: number }> | null>(
    () =>
      ranges
        ? { temperature: ranges.temperature, humidity: ranges.humidity, soilPh: ranges.soilPh, light: ranges.light }
        : null,
    [ranges],
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
  // polledAt is null on the server and until the first response lands, and
  // `state` is "loading" for exactly that window, so the first pass is
  // "connecting" on both sides and hydration matches.
  const status = sensorStatus({ state, lastReadingMs, nowMs: polledAt ?? 0, demo: demo !== null });
  const staleReal = status === "offline";
  const readingNote = demo ? c.demoNote : staleReal ? c.staleWord : undefined;
  const statusLabel = {
    demo: c.demo,
    connecting: c.connecting,
    retrying: c.retrying,
    offline: c.offline,
    live: c.live,
  }[status];

  return (
    <div className="pm-monitor-dashboard">
      <section className="pm-monitor-status" aria-live="polite">
        <div><span className={`pm-monitor-status-dot ${status === "live" ? "is-live" : status === "offline" ? "is-stale" : ""}`} /><strong>{statusLabel}</strong></div>
        {/* While the feed is dead, the poll clock is the wrong number to show:
            it reports when the app last ASKED, which is exactly what made a
            three-hour-old reading look current. Show when the data was made. */}
        <span className="tabular-nums">
          {staleReal && lastReadingAt
            ? `${c.lastSeen} ${lastReadingAt}`
            : updatedAt ? `${c.updated} ${updatedAt}` : c.connecting}
        </span>
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
      {/* The cards below keep their last known numbers, so the page has to say
          out loud that they are old — a marked dot alone is too quiet to undo
          the impression four big fresh-looking values give. */}
      {staleReal && lastReadingAt && (
        <p className="mb-3 rounded-xl border-2 border-[#E0A0A0] bg-[#FDF0F0] px-3 py-2 text-xs leading-5 text-[#8A3A3A]">
          {c.staleBanner(lastReadingAt)}
        </p>
      )}

      <div className="pm-monitor-reading-grid">
        {/* liveNote is the short dedicated "live" word (id "Langsung" / en
            "Live") — the status bar above already says sensors are live, so
            the cards no longer repeat the "Current environment" sentence.
            readingNote overrides it with the demo-data note in demo mode. */}
        <ReadingCard icon="🌡️" label={c.temperature} value={temperature} unit="°C" accent="#EF8B6C" liveNote={c.liveWord} stale={staleReal} note={temperature == null ? c.noSensor : readingNote} />
        <ReadingCard icon="💧" label={c.humidity} value={humidity} unit="%" accent="#4DA1ED" liveNote={c.liveWord} stale={staleReal} note={humidity == null ? c.noSensor : readingNote} />
        <ReadingCard icon="🧪" label={c.soilPh} value={soilPh} unit="" accent="#AA7E55" liveNote={c.liveWord} stale={staleReal} note={soilPh == null ? c.noSensor : readingNote} />
        <ReadingCard icon="☀️" label={c.light} value={light} unit="%" accent="#F2C84B" liveNote={c.liveWord} stale={staleReal} note={light == null ? c.noSensor : readingNote ?? (hasSufficientLight(light) ? c.sufficient : c.low)} />
      </div>

      {ranges && cropProfile && (
        <RangeLegend displayName={cropProfile.displayName} ranges={ranges} c={c} />
      )}

      <section className="pm-panel pm-monitor-chart">
        {/* The window is anchored on the newest READING, so while the kit is
            off this chart keeps showing the hour before it stopped instead of
            emptying out. Say so — data on screen with a "· 1 hour" heading
            reads as the current hour, which is the same lie the status bar
            above used to tell. */}
        <div className="pm-monitor-chart-head"><div><span>📈</span><div><h2>{c.trend}</h2><p>{staleReal && lastReadingAt ? c.trendFrozen(lastReadingAt, spanMinutes) : c.trendNote(spanMinutes)}</p></div></div></div>
        {samples.length > 0 ? (
          <SensorHistoryCharts
            samples={samples}
            bands={historyBands}
            copy={{ airGroup: c.airGroup, soilLightGroup: c.soilLightGroup, temperature: c.temperature, humidity: c.humidity, soilPh: c.soilPh, light: c.light }}
          />
        ) : (
          // Two different empty states, because they have different answers.
          // The gauges above read `latest`, which has no age limit and will
          // happily show a reading from days ago; this chart only asks for the
          // last hour. A device that has stopped pushing therefore leaves live
          // numbers on top of a blank box, and "waiting for sensor readings"
          // there is simply wrong — the readings arrived, they are just old.
          <div className="flex h-[260px] flex-col items-center justify-center gap-1.5 px-4 text-center text-sm text-[#57684F]">
            <p>{lastReadingAt ? c.noRecent : c.waiting}</p>
            {lastReadingAt && <p className="text-xs opacity-75">{c.lastSeen} {lastReadingAt}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
