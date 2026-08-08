"use client";

// Live monitoring panel: fetches /api/sensor-history on mount and every 10s,
// renders the three gauges + the light chart. Follows the quest-progress
// timer conventions: no sync setState in the effect body (the first fetch is
// deferred through requestAnimationFrame; all setState happens in async
// callbacks), and "last updated" is client-only state so hydration matches.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import SensorGauge from "@/components/sensor-gauge";
import type { LightMode, LightPoint } from "@/components/light-chart";

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

export default function MonitoringLive({ plantId = "plant-01" }: { plantId?: string }) {
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

  // Prefer real lux history; fall back to the old flow's binary light column.
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
        out.push({ t, value: row.light > 0 ? 1 : 0 });
      }
    }
    return out;
  }, [history, hasLux]);
  const mode: LightMode = hasLux ? "lux" : "binary";

  return (
    <div>
      <p className="mb-2 text-right text-xs tabular-nums text-[#57684F]">
        {updatedAt ? `Last updated ${updatedAt}` : "Connecting to sensors…"}
      </p>

      {state === "no-env" && (
        <p className="mb-3 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] px-3 py-2 text-xs leading-5 text-[#7A5B12]">
          Supabase environment variables are not set — copy .env.local.example to .env.local and
          restart the dev server. Live readings will appear here.
        </p>
      )}
      {state === "error" && (
        <p className="mb-3 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] px-3 py-2 text-xs leading-5 text-[#7A5B12]">
          Couldn&apos;t reach the sensor API — retrying every 10 seconds.
        </p>
      )}

      {/* Arc colors adopt the farm palette — water blue / forest green /
          soil brown, mirroring what each sensor measures. Hue never carries
          identity on its own: each gauge stays fully text-labeled. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SensorGauge
          label="Air Temperature"
          value={num(latest?.temperature)}
          min={0}
          max={50}
          unit="°C"
          colorClass="text-[#4DA1ED]"
        />
        <SensorGauge
          label="Air Humidity"
          value={num(latest?.humidity)}
          min={0}
          max={100}
          unit="%"
          colorClass="text-[#397A2B]"
        />
        <SensorGauge
          label="Soil Moisture"
          value={num(latest?.soil_moisture)}
          min={0}
          max={100}
          unit="%"
          colorClass="text-[#AA7E55]"
        />
      </div>

      <section className="pm-panel mt-4">
        <h2 className="pm-heading mb-2 text-center text-xs">
          {mode === "lux" ? "Light Intensity (Lux)" : "Light (on/off)"}
        </h2>
        {points.length > 0 ? (
          <LightChart points={points} mode={mode} />
        ) : (
          <div className="flex h-[260px] items-center justify-center text-sm text-[#57684F]">
            Waiting for sensors…
          </div>
        )}
      </section>
    </div>
  );
}
