"use client";

// Cheat sensor editor (feature 6): on the Monitoring screen, lets a presenter
// set the four sensor values during a classroom demo. Client-only — it writes
// to the shared cheat store (localStorage), never to Supabase or hardware, so
// the values also drive My Garden's mascot. Renders nothing unless the
// sandbox is active.

import type { AppLocale } from "@/lib/i18n";
import { useCheat, type CheatVitals } from "@/lib/pm-cheat";
import { SENSOR_LIMITS } from "@/types/raw-sensors";

/** The sandbox edits the same four numbers the hardware reports, so it is held
 *  to the same physical range the ingest endpoint enforces — a demo must never
 *  show a reading the real path would have rejected (200% humidity, pH 20).
 *  Keyed to the store's field names; SENSOR_LIMITS spells pH `soilPH`. */
const LIMITS: Record<keyof CheatVitals, { min: number; max: number }> = {
  temperature: SENSOR_LIMITS.temperature,
  humidity: SENSOR_LIMITS.humidity,
  light: SENSOR_LIMITS.light,
  soilPh: SENSOR_LIMITS.soilPH,
};

const COPY = {
  id: {
    title: "🎛️ Ubah Sensor (Mode Curang)",
    note: "Nilai ini hanya untuk demo — perangkat & data asli tidak berubah.",
    temp: "Suhu (°C)",
    hum: "Kelembapan (%)",
    light: "Cahaya (%)",
    ph: "pH Tanah",
  },
  en: {
    title: "🎛️ Edit Sensors (Cheat Mode)",
    note: "These values are demo-only — real hardware & data stay untouched.",
    temp: "Temp (°C)",
    hum: "Humidity (%)",
    light: "Light (%)",
    ph: "Soil pH",
  },
} as const;

export default function CheatSensorPanel({ locale }: { locale: AppLocale }) {
  const { active, state, api } = useCheat();
  if (!active || !state || !api) return null;
  const t = COPY[locale] ?? COPY.en;
  const v = state.vitals;

  const setVital = (key: keyof CheatVitals, raw: string) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    const { min, max } = LIMITS[key];
    // Clamp what the sandbox stores, but leave the half-typed text alone —
    // rewriting the field on every keystroke would fight the presenter. The
    // blur handler below settles it onto whatever actually landed.
    api.set({ vitals: { [key]: Math.min(max, Math.max(min, num)) } });
  };

  const field = (key: keyof CheatVitals, label: string, step: number) => {
    const { min, max } = LIMITS[key];
    return (
      <label className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium">{label}</span>
        <input
          type="number"
          defaultValue={v[key]}
          step={step}
          min={min}
          max={max}
          title={`${min} – ${max}`}
          onChange={(e) => setVital(key, e.target.value)}
          onBlur={(e) => { e.target.value = String(v[key]); }}
          className="w-24 rounded-lg border-2 px-2 py-1 text-right text-[13px] tabular-nums"
          style={{ borderColor: "#C2618A", background: "#fff", color: "#3a2600" }}
        />
      </label>
    );
  };

  return (
    <section
      className="pm-panel mb-5 flex flex-col gap-2"
      style={{ borderColor: "#C2618A", background: "linear-gradient(135deg,#FFF1D6,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#8A2B5B" }}>
        {t.title}
      </h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2">
        {field("temperature", t.temp, 0.1)}
        {field("humidity", t.hum, 1)}
        {field("light", t.light, 1)}
        {field("soilPh", t.ph, 0.1)}
      </div>
      <p className="text-[10px] leading-4" style={{ color: "#7A5B12" }}>
        {t.note}
      </p>
    </section>
  );
}
