import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import {
  CROP_PROFILES,
  evaluateCropEnvironment,
  getCropProfile,
  type AdvisoryStatus,
} from "@/lib/crop-profiles";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { getRequestLocale } from "@/lib/i18n-server";
import type { AppLocale } from "@/lib/i18n";
import { getPlant } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { updateCropProfile } from "./actions";
import EnvironmentExplanationLive from "@/components/environment-explanation-live";
import CropExplorer from "@/components/crop-explorer";
import { getJemberCropCatalog } from "@/lib/jember-crop-catalog";
import { compareEnvironmentToCrops } from "@/lib/environment-analyzer";
import { getEnvironmentDemoPreset, type EnvironmentDemoPreset, ENVIRONMENT_DEMO_PRESETS } from "@/lib/environment-demo";

export const dynamic = "force-dynamic";
const PLANT_ID = "plant-01";

// Status pills in farm tints: sprout green / harvest amber / warning red /
// muted bg tint — each pixel-bordered so color never stands alone.
const STATUS_STYLE: Record<AdvisoryStatus, string> = {
  Optimal: "border-[#A5CE97] bg-[#E8F6E0] text-[#397A2B]",
  Low: "border-[#E8C46B] bg-[#FFF7DF] text-[#7A5B12]",
  High: "border-[#F3B1B1] bg-[#FFE9E9] text-[#C24141]",
  Waiting: "border-[#BCD3B4] bg-[#F4FAF1] text-[#6B7A66]",
};

const STATUS_COPY: Record<AppLocale, Record<AdvisoryStatus, string>> = {
  id: { Optimal: "Optimal", Low: "Rendah", High: "Tinggi", Waiting: "Menunggu" },
  en: { Optimal: "Optimal", Low: "Low", High: "High", Waiting: "Waiting" },
};

const PAGE_COPY = {
  id: {
    eyebrow: "Profil tanaman",
    title: "Tanaman",
    intro: "Pilih profil tanaman yang didukung dan lihat status sensor terbaru di satu tempat.",
    profile: "Profil tanaman",
    save: "Simpan profil",
    variety: "Stroberi umum · varietas belum diketahui",
    note: "Panduan profil untuk kit kelas. Kebutuhan dapat berbeda menurut varietas dan kalibrasi sensor.",
    temperature: "Suhu",
    humidity: "Kelembapan udara",
    soilPh: "pH tanah",
    light: "Cahaya",
    guide: "Panduan",
    waiting: "Menunggu sensor",
    tolerated: "ditoleransi",
    recommended: "disarankan",
    lightGuide: "LDR minimal 30% saat jam pencahayaan",
    ldrNote: "LDR menampilkan tingkat cahaya relatif 0–100%. Nilai ini bukan lux dan tidak mengukur PPFD, DLI, atau kecukupan cahaya agronomis.",
    latest: "Pembacaan terakhir",
    sources: "Sumber panduan",
  },
  en: {
    eyebrow: "Crop profile",
    title: "Plants",
    intro: "See crop-specific environment guidelines and the latest sensor status in one place.",
    profile: "Crop profile",
    save: "Save profile",
    variety: "General strawberry · variety unknown",
    note: "General guidance for indoor potted strawberries. Needs can vary by variety and sensor calibration.",
    temperature: "Temperature",
    humidity: "Air humidity",
    soilPh: "Soil pH",
    light: "Light",
    guide: "Guide",
    waiting: "Waiting for sensors",
    tolerated: "tolerated",
    recommended: "recommended",
    lightGuide: "LDR at least 30% during lighting hours",
    ldrNote: "The LDR reports a relative 0–100% light level. It is not lux and does not measure PPFD, DLI, or agronomic light sufficiency.",
    latest: "Latest reading",
    sources: "Guide sources",
  },
} as const;

function Metric({ icon, label, guideLabel, guide, value, status, locale }: {
  icon: string; label: string; guideLabel: string; guide: string; value: string; status: AdvisoryStatus; locale: AppLocale;
}) {
  return (
    <article className="pm-panel">
      {/* flex-wrap: the badge is shrink-proof, so on tight cards it must drop
          below the title — otherwise the title column collapses and the
          route-wide overflow-wrap:anywhere shatters words mid-syllable. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><span className="text-2xl">{icon}</span><h2 className="mt-2 pm-heading text-xs">{label}</h2></div>
        <span className={`shrink-0 rounded-full border-2 px-3 py-1 [font-family:var(--pm-font-pixel)] text-[9px] leading-relaxed ${STATUS_STYLE[status]}`}>{STATUS_COPY[locale][status]}</span>
      </div>
      <p className="mt-3 [font-family:var(--pm-font-pixel)] text-base leading-relaxed text-[#243421]">{value}</p>
      <p className="mt-1 text-sm opacity-70">{guideLabel}: {guide}</p>
    </article>
  );
}

export default async function PlantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requestedDemo = (await searchParams).demo;
  const demoPreset = typeof requestedDemo === "string" && requestedDemo in ENVIRONMENT_DEMO_PRESETS ? requestedDemo as EnvironmentDemoPreset : null;
  const locale = await getRequestLocale();
  const copy = PAGE_COPY[locale];
  const supabase = getServerSupabase();
  if (!supabase) return <Notice locale={locale} title="Connecting..." lines={["Check your Supabase environment variables."]} />;
  // Independent queries in parallel. Neither ever rejects (both map failures
  // to status objects / null), so the error Notice below still depends only
  // on getPlant — identical behavior, one round-trip instead of two.
  const [result, realSnapshot, explorerCrops] = await Promise.all([
    getPlant(supabase, PLANT_ID),
    getLatestSensorSnapshot(supabase, PLANT_ID),
    getJemberCropCatalog(supabase, locale),
  ]);
  const snapshot = demoPreset ? getEnvironmentDemoPreset(demoPreset) : realSnapshot;
  if (result.status !== "ok") {
    return <Notice locale={locale} title="Couldn't load crop info" lines={[result.status === "error" ? result.message : "Check the migrations and the plant-01 seed."]} />;
  }

  const profile = getCropProfile(result.plant.crop_profile_key);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const isLightingHours = hour >= profile.light.lightingHours.start && hour < profile.light.lightingHours.end;
  const states = evaluateCropEnvironment(snapshot, profile, isLightingHours);
  // Instant, meaningful first paint (no live-Gemini wait during server
  // render): the deterministic template mirrors explainEnvironment()'s own
  // no-AI fallback (src/lib/environment-explanation.ts). The AI-flavored
  // version streams in client-side after mount via EnvironmentExplanationLive.
  const deterministicExplanation = locale === "id"
    ? `Penganalisis aturan menemukan: suhu ${states.temperature.toLowerCase()}, kelembapan udara ${states.airHumidity.toLowerCase()}, pH tanah ${states.soilPh.toLowerCase()}, dan cahaya ${states.light.toLowerCase()}. Ikuti panduan sensor yang ditandai dan minta bantuan orang dewasa untuk perubahan pH.`
    : `The deterministic analyzer found: temperature ${states.temperature.toLowerCase()}, air humidity ${states.airHumidity.toLowerCase()}, soil pH ${states.soilPh.toLowerCase()}, and light ${states.light.toLowerCase()}. Follow the highlighted sensor guidance and ask an adult for any pH adjustment.`;
  const shown = (value: number | null | undefined, suffix: string) => value == null ? copy.waiting : `${value}${suffix}`;

  return (
    <main>
      <PageHeader icon="🌱" eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
      <CropExplorer locale={locale} initialSnapshot={snapshot} initialCrops={explorerCrops} initialResults={compareEnvironmentToCrops(snapshot, explorerCrops)} initialDemoPreset={demoPreset} />

      <details className="pm-crop-reference-tools">
      <summary>⚙️ {locale === "id" ? "Profil dan referensi tanaman" : "Crop profile and references"}</summary>
      <div>
      <form action={updateCropProfile} className="pm-panel mb-6">
        <input type="hidden" name="plantId" value={result.plant.id} />
        <label className="block font-bold" htmlFor="cropProfileKey">{copy.profile}</label>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <select id="cropProfileKey" name="cropProfileKey" defaultValue={profile.key} className="w-full p-3">
            {Object.values(CROP_PROFILES).map((item) => <option key={item.key} value={item.key}>{locale === "id" && item.key === "strawberry" ? `Stroberi — ${copy.variety}` : `${item.displayName} — ${item.varietyLabel}`}</option>)}
          </select>
          <button type="submit" className="pm-btn pm-btn-primary">{copy.save}</button>
        </div>
        <div className="mt-5 rounded-xl border-2 border-dashed border-[#BCD3B4] bg-[#F4FAF1] p-4">
          <p className="font-bold">🌱 {profile.displayName} <span className="font-normal">({profile.scientificName})</span></p>
          <p>{profile.varietyLabel} · {locale === "id" ? "profil" : "profile"} v{profile.version}</p>
          <p className="mt-2 text-sm opacity-75">{profile.guidanceNote}</p>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric locale={locale} guideLabel={copy.guide} icon="🌡️" label={copy.temperature} guide={`${profile.temperature.tolerated.min}–${profile.temperature.tolerated.max}°C ${copy.tolerated} · ${profile.temperature.recommended.min}–${profile.temperature.recommended.max}°C ${copy.recommended}`} value={shown(snapshot?.temperature, "°C")} status={states.temperature} />
        <Metric locale={locale} guideLabel={copy.guide} icon="💧" label={copy.humidity} guide={`${profile.airHumidity.recommended.min}–${profile.airHumidity.recommended.max}% RH`} value={shown(snapshot?.humidity, "%")} status={states.airHumidity} />
        <Metric locale={locale} guideLabel={copy.guide} icon="🧪" label={copy.soilPh} guide={`${profile.soilPh.recommended.min}–${profile.soilPh.recommended.max}`} value={shown(snapshot?.soilPh, "")} status={states.soilPh} />
        <Metric locale={locale} guideLabel={copy.guide} icon="☀️" label={copy.light} guide={`${copy.lightGuide} ${profile.light.lightingHours.start}:00–${profile.light.lightingHours.end}:00`} value={shown(snapshot?.light, "%")} status={states.light} />
      </section>
      <section className="pm-panel mt-5" aria-labelledby="environment-explanation-title">
        <h2 id="environment-explanation-title" className="pm-heading text-xs">✨ {locale === "id" ? "Penjelasan lingkungan" : "Environment explanation"}</h2>
        <EnvironmentExplanationLive cropKey={profile.key} locale={locale} demo={demoPreset !== null} demoPreset={demoPreset} fallback={deterministicExplanation} />
        <p className="mt-2 text-[11px] opacity-65">{locale === "id" ? "Status ditentukan oleh penganalisis aturan; AI hanya menjelaskan hasilnya." : "Statuses are decided by the deterministic analyzer; AI only explains its results."}</p>
      </section>
      <p className="mt-5 text-sm opacity-70">{copy.ldrNote}{snapshot?.recordedAt ? ` ${copy.latest}: ${snapshot.recordedAt}` : ""}</p>
      <p className="mt-2 text-sm opacity-70">{copy.sources}: {profile.key === "strawberry" ? "Ohio State CEA · UMN Extension · Penn State Extension" : "Kementerian Pertanian · BPS Kabupaten Jember 2025"}</p>
      </div>
      </details>
    </main>
  );
}
