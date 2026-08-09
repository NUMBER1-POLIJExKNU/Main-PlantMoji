"use client";

import { useRef, useState } from "react";
import type { EnvironmentAnalysis } from "@/lib/environment-analyzer";
import type { AppLocale } from "@/lib/i18n";
import type { ExplorerCrop } from "@/lib/jember-crop-catalog";
import type { SensorSnapshot } from "@/lib/crop-profiles";
import type { EnvironmentDemoPreset } from "@/lib/environment-demo";

interface ScanPayload { ok: true; source: "sensor" | "demo"; snapshot: SensorSnapshot; crops: ExplorerCrop[]; results: EnvironmentAnalysis[] }

const COPY = {
  id: { title: "Penjelajah Tanaman Jember", intro: "Ukur tempatmu, pilih tanaman, lalu lihat kondisi apa yang sudah cocok.", step1: "1 · PINDAI LINGKUNGAN", step2: "2 · PILIH TANAMAN", step3: "3 · CEK KONDISI", scan: "PINDAI LINGKUNGANKU", scanAgain: "PINDAI ULANG", scanning: "Membaca sensor…", ready: "Lingkungan siap ✓", demoMode: "Sensor belum tersambung? Pakai data demo", demoBadge: "DATA VIRTUAL · TIDAK DISIMPAN", matches: "PALING DEKAT DENGAN LINGKUNGANMU", measured: "kondisi cocok", change: "Apa yang harus saya ubah?", whyMatch: "Mengapa semua cocok?", noData: "Belum ada pembacaan sensor nyata. Periksa sambungan sensor atau aktifkan data demo.", disclaimer: "Urutan ini hanya membandingkan kondisi yang diukur—bukan prediksi hasil panen atau jaminan tanaman berhasil.", reference: "Referensi · perlu tinjauan lokal", active: "Profil terverifikasi", draft: "Draf pembelajaran", notEval: "Belum diukur", match: "Sudah cocok", mismatch: "Perlu perhatian", current: "Terukur", range: "Acuan", excellent: "Sangat dekat", good: "Cukup dekat", partial: "Sebagian cocok", challenging: "Banyak perbedaan", notEnough: "Data belum cukup", ai: "Aturan tetap menghitung hasil. AI hanya membantu menjelaskannya.", selected: "DIPILIH", rank: "peringkat", mainMismatch: "Perbedaan utama" },
  en: { title: "Jember Crop Explorer", intro: "Measure your place, choose a crop, and see which conditions already match.", step1: "1 · SCAN ENVIRONMENT", step2: "2 · CHOOSE A CROP", step3: "3 · CHECK CONDITIONS", scan: "SCAN MY ENVIRONMENT", scanAgain: "SCAN AGAIN", scanning: "Reading sensors…", ready: "Environment ready ✓", demoMode: "No sensor connected? Use demo data", demoBadge: "VIRTUAL DATA · NOT SAVED", matches: "CLOSEST TO YOUR ENVIRONMENT", measured: "conditions match", change: "What should I change?", whyMatch: "Why do they all match?", noData: "No real sensor reading is available yet. Check the sensor connection or enable demo data.", disclaimer: "This ranking compares measured conditions only—it is not a yield prediction or a guarantee that a crop will succeed.", reference: "Reference · local review needed", active: "Verified profile", draft: "Learning draft", notEval: "Not measured", match: "Matches", mismatch: "Needs attention", current: "Measured", range: "Reference", excellent: "Very close", good: "Close", partial: "Some match", challenging: "Many differences", notEnough: "Not enough data", ai: "Fixed rules calculate the result. AI only helps explain it.", selected: "SELECTED", rank: "rank", mainMismatch: "Main difference" },
} as const;

const PARAMS = { temperature: ["🌡️", "Suhu", "Temperature"], airHumidity: ["💧", "Kelembapan udara", "Air humidity"], light: ["☀️", "Cahaya", "Light"], soilPh: ["🧪", "pH tanah", "Soil pH"] } as const;

function valueWithUnit(parameter: keyof typeof PARAMS, value: number | null) {
  if (value === null) return "—";
  if (parameter === "temperature") return `${value}°C`;
  if (parameter === "airHumidity" || parameter === "light") return `${value}%`;
  return String(value);
}

export default function CropExplorer({ locale, initialSnapshot, initialCrops, initialResults, initialDemoPreset = null }: { locale: AppLocale; initialSnapshot: SensorSnapshot | null; initialCrops: ExplorerCrop[]; initialResults: EnvironmentAnalysis[]; initialDemoPreset?: EnvironmentDemoPreset | null }) {
  const c = COPY[locale];
  const [data, setData] = useState<ScanPayload | null>(initialSnapshot && initialCrops.length ? { ok: true, source: initialDemoPreset ? "demo" : "sensor", snapshot: initialSnapshot, crops: initialCrops, results: initialResults } : null);
  const [demoMode, setDemoMode] = useState(initialDemoPreset !== null);
  const [selectedKey, setSelectedKey] = useState(initialResults[0]?.cropKey ?? "");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);
  const detailRef = useRef<HTMLElement>(null);

  const scan = async () => {
    setScanning(true); setError(false); setExplanation("");
    try {
      const response = await fetch(`/api/environment-scan?locale=${locale}${demoMode ? `&demo=${initialDemoPreset ?? "1"}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const next = await response.json() as ScanPayload;
      setData(next); setSelectedKey(next.results[0]?.cropKey ?? "");
    } catch { setError(true); }
    finally { window.setTimeout(() => setScanning(false), 450); }
  };
  const selected = data?.results.find((item) => item.cropKey === selectedKey) ?? data?.results[0];
  const crop = data?.crops.find((item) => item.key === selected?.cropKey);
  const explain = async () => {
    if (!selected) return;
    setExplaining(true);
    try {
      const response = await fetch("/api/environment-explanation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cropKey: selected.cropKey, locale, demo: data?.source === "demo", demoPreset: initialDemoPreset }) });
      const result = await response.json() as { explanation?: string };
      setExplanation(result.explanation ?? c.noData);
    } catch { setExplanation(c.noData); }
    finally { setExplaining(false); }
  };

  const chooseCrop = (key: string) => {
    setSelectedKey(key);
    setExplanation("");
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <section className="pm-crop-explorer mb-6" aria-labelledby="crop-explorer-title">
    <div className="pm-crop-scan-hero"><div className="pm-crop-radar" aria-hidden="true"><span>🌱</span></div><div><p className="pm-crop-step">{c.step1}</p><h2 id="crop-explorer-title" className="pm-heading">{c.title}</h2><p>{c.intro}</p></div><button type="button" className="pm-btn pm-btn-primary pm-crop-scan-button" onClick={scan} disabled={scanning}>{scanning ? c.scanning : data ? c.scanAgain : c.scan}</button></div>
    <label className="pm-crop-demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => { setDemoMode(event.target.checked); setData(null); setError(false); setExplanation(""); }} /> <span>{c.demoMode}</span></label>
    {error && <p role="alert" className="mt-4 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] p-3 text-sm">{c.noData}</p>}
    {data && !scanning && <div className="pm-crop-results"><div className="pm-crop-snapshot-head"><strong>✅ {c.ready}</strong>{data.source === "demo" && <b>{c.demoBadge}</b>}</div><div className="pm-crop-snapshot">{Object.entries(PARAMS).map(([key, p]) => { const value = key === "airHumidity" ? data.snapshot.humidity : data.snapshot[key as "temperature" | "light" | "soilPh"]; return <span key={key}><i>{p[0]}</i><small>{locale === "id" ? p[1] : p[2]}</small><strong>{valueWithUnit(key as keyof typeof PARAMS, value ?? null)}</strong></span>; })}</div>
      <div className="pm-crop-section-head"><p className="pm-crop-step">{c.step2}</p><h3>{c.matches}</h3></div><div className="pm-crop-rank-grid">{data.results.map((item, index) => <button type="button" key={item.cropKey} onClick={() => chooseCrop(item.cropKey)} aria-pressed={selected?.cropKey === item.cropKey} className={selected?.cropKey === item.cropKey ? "is-selected" : ""}><span className="pm-crop-rank">#{index + 1}</span><strong>{item.cropName}</strong><span className="pm-crop-score"><b>{item.matchedConditions}/{item.evaluatedConditions}</b> {c.measured}</span><span className="pm-crop-label">{item.label === "excellent" ? c.excellent : item.label === "good" ? c.good : item.label === "partial" ? c.partial : item.label === "challenging" ? c.challenging : c.notEnough}</span>{item.largestMismatch && <small>{c.mainMismatch}: {locale === "id" ? PARAMS[item.largestMismatch.parameter][1] : PARAMS[item.largestMismatch.parameter][2]} {item.largestMismatch.direction === "high" ? "↑" : "↓"}</small>}<em>{item.profileStatus === "active" ? c.active : item.profileStatus === "reference_only" ? c.reference : c.draft}</em>{selected?.cropKey === item.cropKey && <i className="pm-crop-selected">✓ {c.selected}</i>}</button>)}</div>
      {selected && crop && <article ref={detailRef} className="pm-crop-detail"><div className="pm-crop-section-head"><p className="pm-crop-step">{c.step3}</p><div className="flex flex-wrap items-baseline justify-between gap-2"><h3>{selected.cropName}</h3><i>{crop.scientificName}</i></div></div><p className="pm-crop-education">{crop.educationNote}</p><div className="pm-crop-condition-grid">{Object.entries(selected.conditions).map(([key, condition]) => { const parameter = key as keyof typeof PARAMS; const p = PARAMS[parameter]; const range = condition.preferredMin === null && condition.preferredMax === null ? "—" : `${valueWithUnit(parameter, condition.preferredMin)}–${valueWithUnit(parameter, condition.preferredMax)}`; return <div key={key} className={`pm-crop-condition is-${condition.status}`}><div><span>{p[0]}</span><strong>{locale === "id" ? p[1] : p[2]}</strong><b>{condition.status === "match" ? `✅ ${c.match}` : condition.status === "mismatch" ? `⚠️ ${c.mismatch}` : `➖ ${c.notEval}`}</b></div><p><span>{c.current}: <strong>{valueWithUnit(parameter, condition.current)}</strong></span><span>{c.range}: <strong>{range}</strong></span></p></div>; })}</div><button type="button" className="pm-btn pm-btn-primary pm-crop-advice-button" onClick={explain} disabled={explaining}>{explaining ? "…" : selected.largestMismatch ? c.change : c.whyMatch}</button>{explanation && <div className="pm-crop-explanation"><span aria-hidden="true">👨‍🌾</span><div><p>{explanation}</p><small>{c.ai}</small></div></div>}</article>}
      <p className="mt-4 text-xs opacity-65">{c.disclaimer}</p></div>}
  </section>;
}
