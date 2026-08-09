"use client";

import { useState } from "react";
import type { EnvironmentAnalysis } from "@/lib/environment-analyzer";
import type { AppLocale } from "@/lib/i18n";
import type { ExplorerCrop } from "@/lib/jember-crop-catalog";
import type { SensorSnapshot } from "@/lib/crop-profiles";

interface ScanPayload { ok: true; source: "sensor" | "demo"; snapshot: SensorSnapshot; crops: ExplorerCrop[]; results: EnvironmentAnalysis[] }

const COPY = {
  id: { title: "Penjelajah Tanaman Jember", intro: "Bandingkan kondisi yang diukur PlantMoji dengan referensi tanaman yang terhubung dengan Jember.", scan: "PINDAI TEMPAT INI", scanning: "Membaca sensor…", ready: "Lingkungan siap ✓", demoMode: "Gunakan data demo", demoBadge: "DATA VIRTUAL · TIDAK DISIMPAN", matches: "KECOCOKAN LINGKUNGAN", measured: "kondisi terukur cocok", change: "Apa yang harus saya ubah?", whyMatch: "Mengapa ini cocok?", noData: "Belum ada pembacaan sensor nyata. Periksa sambungan sensor atau aktifkan data demo.", disclaimer: "Ini perbandingan kondisi yang diukur, bukan prediksi hasil panen atau jaminan tanaman akan berhasil.", reference: "Referensi — perlu tinjauan lokal", active: "Disetujui untuk aturan otomatis", draft: "Draf pendidikan", notEval: "Belum dinilai", match: "Cocok", mismatch: "Tidak cocok", current: "Saat ini", range: "Rentang referensi", excellent: "Sangat cocok", good: "Cocok", partial: "Cocok sebagian", challenging: "Menantang", notEnough: "Data belum cukup", ai: "AI hanya menjelaskan. Kecocokan dihitung oleh aturan tetap." },
  en: { title: "Jember Crop Explorer", intro: "Compare PlantMoji’s measured conditions with reference profiles connected to Jember.", scan: "SCAN THIS PLACE", scanning: "Reading sensors…", ready: "Environment ready ✓", demoMode: "Use demo data", demoBadge: "VIRTUAL DATA · NOT SAVED", matches: "ENVIRONMENT MATCHES", measured: "measured conditions matched", change: "What should I change?", whyMatch: "Why does this match?", noData: "No real sensor reading is available yet. Check the sensor connection or enable demo data.", disclaimer: "This compares measured conditions only. It is not a yield prediction or a guarantee that a crop will succeed.", reference: "Reference — local review needed", active: "Approved for automatic rules", draft: "Educational draft", notEval: "Not evaluated", match: "Match", mismatch: "Mismatch", current: "Current", range: "Reference range", excellent: "Excellent match", good: "Good match", partial: "Partial match", challenging: "Challenging", notEnough: "Not enough data", ai: "AI only explains. Fixed rules calculate every match." },
} as const;

const PARAMS = { temperature: ["🌡️", "Suhu", "Temperature"], airHumidity: ["💧", "Kelembapan udara", "Air humidity"], light: ["☀️", "Cahaya", "Light"], soilPh: ["🧪", "pH tanah", "Soil pH"] } as const;

function valueWithUnit(parameter: keyof typeof PARAMS, value: number | null) {
  if (value === null) return "—";
  if (parameter === "temperature") return `${value}°C`;
  if (parameter === "airHumidity" || parameter === "light") return `${value}%`;
  return String(value);
}

export default function CropExplorer({ locale, initialSnapshot, initialCrops, initialResults }: { locale: AppLocale; initialSnapshot: SensorSnapshot | null; initialCrops: ExplorerCrop[]; initialResults: EnvironmentAnalysis[] }) {
  const c = COPY[locale];
  const [data, setData] = useState<ScanPayload | null>(initialSnapshot && initialCrops.length ? { ok: true, source: "sensor", snapshot: initialSnapshot, crops: initialCrops, results: initialResults } : null);
  const [demoMode, setDemoMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState(initialResults[0]?.cropKey ?? "");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);

  const scan = async () => {
    setScanning(true); setError(false); setExplanation("");
    try {
      const response = await fetch(`/api/environment-scan?locale=${locale}${demoMode ? "&demo=1" : ""}`, { cache: "no-store" });
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
      const response = await fetch("/api/environment-explanation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cropKey: selected.cropKey, locale, demo: data?.source === "demo" }) });
      const result = await response.json() as { explanation?: string };
      setExplanation(result.explanation ?? c.noData);
    } catch { setExplanation(c.noData); }
    finally { setExplaining(false); }
  };

  return <section className="pm-panel mb-6 overflow-hidden" aria-labelledby="crop-explorer-title">
    <div className="text-center"><p className="text-4xl" aria-hidden="true">🛰️🌱</p><h2 id="crop-explorer-title" className="pm-heading mt-3 text-sm">{c.title}</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 opacity-75">{c.intro}</p><label className="mx-auto mt-4 flex w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-[#BCD3B4] bg-[#F4FAF1] px-3 py-2 text-xs"><input type="checkbox" checked={demoMode} onChange={(event) => { setDemoMode(event.target.checked); setData(null); setError(false); setExplanation(""); }} /> {c.demoMode}</label><button type="button" className="pm-btn pm-btn-primary mt-4" onClick={scan} disabled={scanning}>{scanning ? c.scanning : c.scan}</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl border-2 border-[#E8C46B] bg-[#FFF7DF] p-3 text-sm">{c.noData}</p>}
    {data && !scanning && <div className="mt-6"><p className="text-center font-bold text-[#397A2B]">{c.ready}</p>{data.source === "demo" && <p className="mx-auto mt-2 w-fit rounded-full border-2 border-[#E8C46B] bg-[#FFF7DF] px-3 py-1 text-center text-[10px] font-bold text-[#7A5B12]">{c.demoBadge}</p>}<div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4"><span>🌡️ {data.snapshot.temperature ?? "—"}°C</span><span>💧 {data.snapshot.humidity ?? "—"}%</span><span>☀️ {data.snapshot.light ?? "—"}%</span><span>🧪 {data.snapshot.soilPh ?? "—"}</span></div>
      <h3 className="pm-heading mt-7 text-xs">{c.matches}</h3><div className="mt-3 grid gap-3 md:grid-cols-3">{data.results.map((item) => <button type="button" key={item.cropKey} onClick={() => { setSelectedKey(item.cropKey); setExplanation(""); }} className={`rounded-xl border-2 p-4 text-left ${selected?.cropKey === item.cropKey ? "border-[#397A2B] bg-[#E8F6E0]" : "border-[#BCD3B4] bg-white"}`}><strong>{item.cropName}</strong><span className="mt-2 block text-sm">{item.matchedConditions} / {item.evaluatedConditions} {c.measured}</span><span className="mt-1 block text-xs font-bold text-[#397A2B]">{item.label === "excellent" ? c.excellent : item.label === "good" ? c.good : item.label === "partial" ? c.partial : item.label === "challenging" ? c.challenging : c.notEnough}</span><span className="mt-1 block text-[11px] opacity-65">{item.profileStatus === "active" ? c.active : item.profileStatus === "reference_only" ? c.reference : c.draft}</span></button>)}</div>
      {selected && crop && <article className="mt-5 rounded-xl border-2 border-[#A5CE97] bg-[#F4FAF1] p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="pm-heading text-xs">{selected.cropName}</h3><i className="text-xs">{crop.scientificName}</i></div><p className="mt-2 text-sm opacity-75">{crop.educationNote}</p><div className="mt-4 grid gap-2 md:grid-cols-2">{Object.entries(selected.conditions).map(([key, condition]) => { const parameter = key as keyof typeof PARAMS; const p = PARAMS[parameter]; const range = condition.preferredMin === null && condition.preferredMax === null ? "—" : `${valueWithUnit(parameter, condition.preferredMin)}–${valueWithUnit(parameter, condition.preferredMax)}`; return <div key={key} className="rounded-lg bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span>{p[0]} {locale === "id" ? p[1] : p[2]}</span><strong>{condition.status === "match" ? `✅ ${c.match}` : condition.status === "mismatch" ? `⚠️ ${c.mismatch}` : `➖ ${c.notEval}`}</strong></div><p className="mt-1 text-xs opacity-65">{c.current}: {valueWithUnit(parameter, condition.current)} · {c.range}: {range}</p></div>; })}</div><button type="button" className="pm-btn pm-btn-primary mt-4" onClick={explain} disabled={explaining}>{explaining ? "…" : selected.largestMismatch ? c.change : c.whyMatch}</button>{explanation && <div className="mt-4 rounded-xl border-2 border-dashed border-[#E8C46B] bg-[#FFF7DF] p-4"><p>{explanation}</p><p className="mt-2 text-[11px] opacity-65">{c.ai}</p></div>}</article>}
      <p className="mt-4 text-xs opacity-65">{c.disclaimer}</p></div>}
  </section>;
}
