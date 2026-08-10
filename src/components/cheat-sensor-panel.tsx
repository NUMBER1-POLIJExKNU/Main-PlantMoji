"use client";

// Cheat sensor editor (feature 6): on the Monitoring screen, lets a presenter
// set the four sensor values during a classroom demo. Client-only — it writes
// to the shared cheat store (localStorage), never to Supabase or hardware, so
// the values also drive My Garden's mascot. Renders nothing unless the
// sandbox is active.

import type { AppLocale } from "@/lib/i18n";
import { useCheat } from "@/lib/pm-cheat";

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

  const setVital = (key: keyof typeof v, raw: string) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    api.set({ vitals: { [key]: num } });
  };

  const field = (key: keyof typeof v, label: string, step: number, min?: number, max?: number) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium">{label}</span>
      <input
        type="number"
        defaultValue={v[key]}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setVital(key, e.target.value)}
        className="w-24 rounded-lg border-2 px-2 py-1 text-right text-[13px] tabular-nums"
        style={{ borderColor: "#C2618A", background: "#fff", color: "#3a2600" }}
      />
    </label>
  );

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
        {field("humidity", t.hum, 1, 0, 100)}
        {field("light", t.light, 1, 0, 100)}
        {field("soilPh", t.ph, 0.1, 0, 14)}
      </div>
      <p className="text-[10px] leading-4" style={{ color: "#7A5B12" }}>
        {t.note}
      </p>
    </section>
  );
}
