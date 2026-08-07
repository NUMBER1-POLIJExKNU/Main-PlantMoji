import Notice from "@/components/notice";
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

export const dynamic = "force-dynamic";
const PLANT_ID = "plant-01";

const STATUS_STYLE: Record<AdvisoryStatus, string> = {
  Optimal: "bg-green-100 text-green-800",
  Low: "bg-amber-100 text-amber-800",
  High: "bg-rose-100 text-rose-800",
  Waiting: "bg-zinc-100 text-zinc-500",
};

const STATUS_COPY: Record<AppLocale, Record<AdvisoryStatus, string>> = {
  id: { Optimal: "Optimal", Low: "Rendah", High: "Tinggi", Waiting: "Menunggu" },
  en: { Optimal: "Optimal", Low: "Low", High: "High", Waiting: "Waiting" },
};

const PAGE_COPY = {
  id: {
    eyebrow: "Profil tanaman",
    title: "Tanaman",
    intro: "Lihat panduan lingkungan stroberi dan pembacaan sensor terbaru di satu tempat.",
    profile: "Profil tanaman",
    save: "Simpan profil",
    variety: "Stroberi umum · varietas belum diketahui",
    note: "Panduan umum untuk stroberi dalam pot di dalam ruangan. Kebutuhan dapat berbeda menurut varietas dan kalibrasi sensor.",
    temperature: "Suhu",
    humidity: "Kelembapan udara",
    soilPh: "pH tanah",
    light: "Cahaya",
    guide: "Panduan",
    waiting: "Menunggu sensor",
    tolerated: "ditoleransi",
    recommended: "disarankan",
    lightGuide: "LDR harus 1 saat jam pencahayaan",
    ldrNote: "LDR hanya membaca terang (1) atau gelap (0). Nilai ini tidak mengukur intensitas cahaya atau kecukupan DLI.",
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
    lightGuide: "LDR 1 during lighting hours",
    ldrNote: "The LDR only detects bright (1) or dark (0). It does not indicate light intensity or DLI sufficiency.",
    latest: "Latest reading",
    sources: "Guide sources",
  },
} as const;

function Metric({ icon, label, guideLabel, guide, value, status, locale }: {
  icon: string; label: string; guideLabel: string; guide: string; value: string; status: AdvisoryStatus; locale: AppLocale;
}) {
  return (
    <article className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><span className="text-2xl">{icon}</span><h2 className="mt-2">{label}</h2></div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[status]}`}>{STATUS_COPY[locale][status]}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm opacity-70">{guideLabel}: {guide}</p>
    </article>
  );
}

export default async function PlantsPage() {
  const locale = await getRequestLocale();
  const copy = PAGE_COPY[locale];
  const supabase = getServerSupabase();
  if (!supabase) return <Notice title="Connecting..." lines={["Check your Supabase environment variables."]} />;
  const result = await getPlant(supabase, PLANT_ID);
  if (result.status !== "ok") {
    return <Notice title="Couldn't load crop info" lines={[result.status === "error" ? result.message : "Check the migrations and the plant-01 seed."]} />;
  }

  const profile = getCropProfile(result.plant.crop_profile_key);
  const snapshot = await getLatestSensorSnapshot(supabase, PLANT_ID);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const isLightingHours = hour >= profile.light.lightingHours.start && hour < profile.light.lightingHours.end;
  const states = evaluateCropEnvironment(snapshot, profile, isLightingHours);
  const shown = (value: number | null | undefined, suffix: string) => value == null ? copy.waiting : `${value}${suffix}`;

  return (
    <main>
      <header className="mb-7">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] opacity-60">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="mt-3">{copy.intro}</p>
      </header>

      <form action={updateCropProfile} className="mb-6 rounded-2xl border border-white/90 bg-white/75 p-5">
        <input type="hidden" name="plantId" value={result.plant.id} />
        <label className="block font-bold" htmlFor="cropProfileKey">{copy.profile}</label>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <select id="cropProfileKey" name="cropProfileKey" defaultValue={profile.key} className="w-full p-3">
            {Object.values(CROP_PROFILES).map((item) => <option key={item.key} value={item.key}>{locale === "id" && item.key === "strawberry" ? `Stroberi — ${copy.variety}` : `${item.displayName} — ${item.varietyLabel}`}</option>)}
          </select>
          <button type="submit" className="px-6 py-3">{copy.save}</button>
        </div>
        <div className="mt-5 rounded-xl bg-green-50/80 p-4">
          <p className="font-bold">🍓 {locale === "id" ? "Stroberi" : profile.displayName} <span className="font-normal">({profile.scientificName})</span></p>
          <p>{locale === "id" ? copy.variety : profile.varietyLabel} · {locale === "id" ? "profil" : "profile"} v{profile.version}</p>
          <p className="mt-2 text-sm opacity-75">{locale === "id" ? copy.note : profile.guidanceNote}</p>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric locale={locale} guideLabel={copy.guide} icon="🌡️" label={copy.temperature} guide={`${profile.temperature.tolerated.min}–${profile.temperature.tolerated.max}°C ${copy.tolerated} · ${profile.temperature.recommended.min}–${profile.temperature.recommended.max}°C ${copy.recommended}`} value={shown(snapshot?.temperature, "°C")} status={states.temperature} />
        <Metric locale={locale} guideLabel={copy.guide} icon="💧" label={copy.humidity} guide={`${profile.airHumidity.recommended.min}–${profile.airHumidity.recommended.max}% RH`} value={shown(snapshot?.humidity, "%")} status={states.airHumidity} />
        <Metric locale={locale} guideLabel={copy.guide} icon="🧪" label={copy.soilPh} guide={`${profile.soilPh.recommended.min}–${profile.soilPh.recommended.max}`} value={shown(snapshot?.soilPh, "")} status={states.soilPh} />
        <Metric locale={locale} guideLabel={copy.guide} icon="☀️" label={copy.light} guide={`${copy.lightGuide} ${profile.light.lightingHours.start}:00–${profile.light.lightingHours.end}:00`} value={shown(snapshot?.light, "")} status={states.light} />
      </section>
      <p className="mt-5 text-sm opacity-70">{copy.ldrNote}{snapshot?.recordedAt ? ` ${copy.latest}: ${snapshot.recordedAt}` : ""}</p>
      <p className="mt-2 text-sm opacity-70">
        {copy.sources}: <a className="underline" href="https://ohceac.osu.edu/CEBPI-Environment" target="_blank" rel="noreferrer">Ohio State CEA</a>{" · "}
        <a className="underline" href="https://extension.umn.edu/strawberry-farming/strawberry-nutrient-management" target="_blank" rel="noreferrer">UMN Extension</a>{" · "}
        <a className="underline" href="https://extension.psu.edu/strawberry-production" target="_blank" rel="noreferrer">Penn State Extension</a>
      </p>
    </main>
  );
}
