"use client";

// Cheat sensor editor (feature 6): on the Monitoring screen, lets a presenter
// change what the plant is feeling during a classroom demo. Client-only — it
// writes to the shared cheat store (localStorage), never to Supabase or
// hardware, so the values also drive My Garden's mascot. Renders nothing
// unless the sandbox is active.
//
// It leads with ACTIONS, not numbers. Typing 34 into a box teaches nothing;
// pressing "put it in the sun" and watching the thermometer climb is the
// lesson. The raw fields are still here, folded away behind "edit by value"
// for when someone needs an exact figure.

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import type { CropProfile } from "@/lib/crop-profiles";
import { useCheat, type CheatVitals, type CheatAction } from "@/lib/pm-cheat";
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
    title: "🎛️ Rawat Tanaman (Mode Curang)",
    note: "Nilai ini hanya untuk demo — perangkat & data asli tidak berubah.",
    held: "Ditahan sampai kamu menekan lawannya.",
    slow: "beberapa hari",
    slowNote: "Suhu dan cahaya berubah seketika, kelembapan dalam hitungan menit — pH tanah butuh berhari-hari. Tombol pH mempercepat waktu.",
    byValue: "atur lewat angka",
    temp: "Suhu (°C)", hum: "Kelembapan (%)", light: "Cahaya (%)", ph: "pH Tanah",
  },
  en: {
    title: "🎛️ Care Actions (Cheat Mode)",
    note: "Demo only — real hardware and data stay untouched.",
    held: "Held until you press its opposite.",
    slow: "days later",
    slowNote: "Temperature and light move at once, humidity within minutes — soil pH takes days. The pH buttons fast-forward that.",
    byValue: "edit by value",
    temp: "Temp (°C)", hum: "Humidity (%)", light: "Light (%)", ph: "Soil pH",
  },
} as const;

export default function CheatSensorPanel({
  locale,
  cropProfile = null,
}: {
  locale: AppLocale;
  /** Active crop, so "put it in the sun" overheats a strawberry and a cayenne
   *  at their own temperatures. Null leaves the store's defaults in place. */
  cropProfile?: CropProfile | null;
}) {
  const { active, state, api } = useCheat();
  const [byValue, setByValue] = useState(false);

  useEffect(() => {
    if (!cropProfile) return;
    window.PMCheat?.setBands({
      temp: {
        recMin: cropProfile.temperature.recommended.min,
        recMax: cropProfile.temperature.recommended.max,
        overheatEnter: cropProfile.temperature.overheating.enterAtOrAbove,
        coldEnter: cropProfile.temperature.cold.enterAtOrBelow,
      },
      humidity: {
        recMin: cropProfile.airHumidity.recommended.min,
        recMax: cropProfile.airHumidity.recommended.max,
        dryEnter: cropProfile.airHumidity.dryAir.enterBelow,
        humidEnter: cropProfile.airHumidity.humidAir.enterAbove,
      },
      ph: { recMin: cropProfile.soilPh.recommended.min, recMax: cropProfile.soilPh.recommended.max },
      light: { min: cropProfile.light.minimumPercentDuringLightingHours },
    });
  }, [cropProfile]);

  if (!active || !state || !api) return null;
  const trial = state.mode === "trial";
  const t = COPY[locale] ?? COPY.en;
  const v = state.vitals;
  const label = (a: CheatAction) => (locale === "id" ? a.id_label : a.en_label);
  const held = (a: CheatAction) => a.kind === "toggle" && !!a.slot && state.actions?.[a.slot] === a.id;

  const actionButton = (a: CheatAction) => (
    <button
      key={a.id}
      type="button"
      onClick={() => api.press(a.id)}
      aria-pressed={a.kind === "toggle" ? held(a) : undefined}
      title={a.kind === "toggle" ? t.held : undefined}
      className="flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-left text-[11px] font-semibold leading-4"
      style={held(a)
        ? { borderColor: "#8A2B5B", background: "#8A2B5B", color: "#fff" }
        : { borderColor: "#E0B0C6", background: "#fff", color: "#3a2600" }}
    >
      <span aria-hidden="true">{a.emoji}</span>
      <span className="min-w-0 flex-1">{label(a)}</span>
      {a.slow && (
        <span className="shrink-0 rounded-md px-1 py-0.5 text-[9px] font-bold" style={{ background: "#FFF1D6", color: "#7A5B12" }}>
          ⏳ {t.slow}
        </span>
      )}
    </button>
  );

  const toggles = api.ACTIONS.filter((a) => a.kind === "toggle");
  const deltas = api.ACTIONS.filter((a) => a.kind === "delta");

  const field = (key: keyof CheatVitals, name: string, step: number) => {
    const { min, max } = LIMITS[key];
    return (
      <label className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium">{name}</span>
        <input
          type="number"
          defaultValue={v[key]}
          step={step}
          min={min}
          max={max}
          title={`${min} – ${max}`}
          onChange={(e) => {
            const num = Number(e.target.value);
            if (!Number.isFinite(num)) return;
            // Clamp what the sandbox stores, but leave the half-typed text
            // alone; the blur handler settles it onto what actually landed.
            api.set({ vitals: { [key]: Math.min(max, Math.max(min, num)) } });
          }}
          onBlur={(e) => { e.target.value = String(v[key]); }}
          className="w-24 rounded-lg border-2 px-2 py-1 text-right text-[13px] tabular-nums"
          style={{ borderColor: "#C2618A", background: "#fff", color: "#3a2600" }}
        />
      </label>
    );
  };

  return (
    <section
      className="pm-panel mb-5 flex flex-col gap-3"
      style={{ borderColor: "#C2618A", background: "linear-gradient(135deg,#FFF1D6,var(--color-surface))" }}
    >
      <h2 className="pm-heading text-xs" style={{ color: "#8A2B5B" }}>{t.title}</h2>

      <div className="grid gap-1.5 sm:grid-cols-2">{toggles.map(actionButton)}</div>
      <div className="grid gap-1.5 sm:grid-cols-2">{deltas.map(actionButton)}</div>

      <p className="text-[10px] leading-4" style={{ color: "#7A5B12" }}>{t.slowNote}</p>
      <p className="text-[10px] leading-4" style={{ color: "#7A5B12" }}>{t.note}</p>

      {/* Trial mode keeps the care buttons — a student should be able to look
          after the plant from Monitoring too — but never the number boxes.
          Typing 34 into a field is exactly the cheat the trial gate exists to
          withhold, and it would also let a hazard be dismissed without
          learning which action answers it. */}
      {!trial && (
        <div>
          <button
            type="button"
            onClick={() => setByValue((open) => !open)}
            aria-expanded={byValue}
            className="cursor-pointer text-[10px] font-semibold underline"
            style={{ color: "#8A2B5B" }}
          >
            {byValue ? "▾" : "▸"} {t.byValue}
          </button>
          {byValue && (
            <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2">
              {field("temperature", t.temp, 0.1)}
              {field("humidity", t.hum, 1)}
              {field("light", t.light, 1)}
              {field("soilPh", t.ph, 0.1)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
