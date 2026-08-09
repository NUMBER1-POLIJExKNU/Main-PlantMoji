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
import { hasSufficientLight } from "@/lib/light-sensor";

const REFRESH_MS = 10_000;

// recharts is the heaviest dependency in the app; light-chart.tsx pulls it
// in, so it's loaded on demand (client-only, no SSR) instead of shipping in
// the initial /monitoring bundle. Only type-only imports of light-chart.tsx
// remain above — those are erased at compile time and carry no runtime cost,
// so this file has no static value import of the recharts-bearing module.
const LightChart = dynamic(() => import("@/components/light-chart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] w-full animate-pulse items-center justify-center text-sm text-[#57684F]">
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
  id: { live: "SENSOR AKTIF", connecting: "MENGHUBUNGKAN SENSOR", retrying: "MENCOBA LAGI", updated: "Diperbarui", real: "Pembacaan lingkungan saat ini", intro: "Empat pengukuran yang digunakan PlantMoji untuk memahami lingkungan.", temperature: "Suhu", humidity: "Kelembapan udara", soilPh: "pH tanah", light: "Cahaya", noSensor: "Belum ada data", sufficient: "Cukup", low: "Rendah", trend: "Riwayat cahaya · 1 jam", waiting: "Menunggu pembacaan sensor…", noEnv: "Supabase belum terhubung. Pembacaan langsung akan muncul setelah pengaturan lingkungan selesai.", error: "API sensor belum dapat dijangkau. PlantMoji mencoba lagi setiap 10 detik." },
  en: { live: "SENSORS LIVE", connecting: "CONNECTING SENSORS", retrying: "RETRYING", updated: "Updated", real: "Current environment", intro: "The four measurements PlantMoji uses to understand the environment.", temperature: "Temperature", humidity: "Air humidity", soilPh: "Soil pH", light: "Light", noSensor: "No data yet", sufficient: "Sufficient", low: "Low", trend: "Light history · 1 hour", waiting: "Waiting for sensor readings…", noEnv: "Supabase is not connected. Live readings will appear after environment setup.", error: "The sensor API cannot be reached. PlantMoji retries every 10 seconds." },
} as const;

function ReadingCard({ icon, label, value, unit, accent, note }: { icon: string; label: string; value: number | null; unit: string; accent: string; note?: string }) {
  return (
    <article className="pm-panel pm-monitor-reading" style={{ "--sensor-accent": accent } as CSSProperties}>
      <div className="pm-monitor-reading-head"><span aria-hidden="true">{icon}</span><h2>{label}</h2></div>
      <div className="pm-monitor-reading-value">{value == null ? "—" : value}<small>{value == null ? "" : unit}</small></div>
      <div className="pm-monitor-reading-foot"><span className={value == null ? "is-waiting" : "is-live"} />{note ?? (value == null ? "No data" : "Live reading")}</div>
    </article>
  );
}

export default function MonitoringLive({ plantId = "plant-01", locale = "id" }: { plantId?: string; locale?: AppLocale }) {
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
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearInterval(id);
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
  const c = COPY[locale];
  const temperature = num(latest?.temperature);
  const humidity = num(latest?.humidity);
  const soilPh = num(latest?.soil_ph);
  const light = num(latest?.light);
  const statusLabel = state === "ok" ? c.live : state === "loading" ? c.connecting : c.retrying;

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

      <div className="pm-monitor-intro"><div><span>📡</span><div><h2>{c.real}</h2><p>{c.intro}</p></div></div></div>

      <div className="pm-monitor-reading-grid">
        <ReadingCard icon="🌡️" label={c.temperature} value={temperature} unit="°C" accent="#EF8B6C" note={temperature == null ? c.noSensor : undefined} />
        <ReadingCard icon="💧" label={c.humidity} value={humidity} unit="%" accent="#4DA1ED" note={humidity == null ? c.noSensor : undefined} />
        <ReadingCard icon="🧪" label={c.soilPh} value={soilPh} unit="" accent="#AA7E55" note={soilPh == null ? c.noSensor : undefined} />
        <ReadingCard icon="☀️" label={c.light} value={light} unit="%" accent="#F2C84B" note={light == null ? c.noSensor : hasSufficientLight(light) ? c.sufficient : c.low} />
      </div>

      <section className="pm-panel pm-monitor-chart">
        <div className="pm-monitor-chart-head"><div><span>☀️</span><div><h2>{c.trend}</h2><p>{mode === "lux" ? "Lux" : "0–100%"}</p></div></div></div>
        {points.length > 0 ? (
          <LightChart points={points} mode={mode} />
        ) : (
          <div className="flex h-[260px] items-center justify-center text-sm text-[#57684F]">
            {c.waiting}
          </div>
        )}
      </section>
    </div>
  );
}
