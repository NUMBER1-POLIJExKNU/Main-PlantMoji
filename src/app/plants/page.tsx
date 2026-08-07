import Notice from "@/components/notice";
import {
  CROP_PROFILES,
  evaluateCropEnvironment,
  getCropProfile,
  type AdvisoryStatus,
} from "@/lib/crop-profiles";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
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

function Metric({ icon, label, guide, value, status }: {
  icon: string; label: string; guide: string; value: string; status: AdvisoryStatus;
}) {
  return (
    <article className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><span className="text-2xl">{icon}</span><h2 className="mt-2">{label}</h2></div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[status]}`}>{status}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm opacity-70">Guide: {guide}</p>
    </article>
  );
}

export default async function PlantsPage() {
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
  const shown = (value: number | null | undefined, suffix: string) => value == null ? "Waiting for sensors" : `${value}${suffix}`;

  return (
    <main>
      <header className="mb-7">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] opacity-60">Crop profile</p>
        <h1>Plants</h1>
        <p className="mt-3">See crop-specific environment guidelines and the latest sensor status in one place.</p>
      </header>

      <form action={updateCropProfile} className="mb-6 rounded-2xl border border-white/90 bg-white/75 p-5">
        <input type="hidden" name="plantId" value={result.plant.id} />
        <label className="block font-bold" htmlFor="cropProfileKey">Crop profile</label>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <select id="cropProfileKey" name="cropProfileKey" defaultValue={profile.key} className="w-full p-3">
            {Object.values(CROP_PROFILES).map((item) => <option key={item.key} value={item.key}>{item.displayName} — {item.varietyLabel}</option>)}
          </select>
          <button type="submit" className="px-6 py-3">Save profile</button>
        </div>
        <div className="mt-5 rounded-xl bg-green-50/80 p-4">
          <p className="font-bold">🍓 {profile.displayName} <span className="font-normal">({profile.scientificName})</span></p>
          <p>{profile.varietyLabel} · profile v{profile.version}</p>
          <p className="mt-2 text-sm opacity-75">{profile.guidanceNote}</p>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon="🌡️" label="Temperature" guide={`${profile.temperature.tolerated.min}–${profile.temperature.tolerated.max}°C tolerated · ${profile.temperature.recommended.min}–${profile.temperature.recommended.max}°C recommended`} value={shown(snapshot?.temperature, "°C")} status={states.temperature} />
        <Metric icon="💧" label="Air humidity" guide={`${profile.airHumidity.recommended.min}–${profile.airHumidity.recommended.max}% RH`} value={shown(snapshot?.humidity, "%")} status={states.airHumidity} />
        <Metric icon="🧪" label="Soil pH" guide={`${profile.soilPh.recommended.min}–${profile.soilPh.recommended.max}`} value={shown(snapshot?.soilPh, "")} status={states.soilPh} />
        <Metric icon="☀️" label="Light" guide={`LDR 1 during lighting hours ${profile.light.lightingHours.start}:00–${profile.light.lightingHours.end}:00`} value={shown(snapshot?.light, "")} status={states.light} />
      </section>
      <p className="mt-5 text-sm opacity-70">The LDR only detects bright (1) / dark (0). It does not indicate light intensity or DLI sufficiency.{snapshot?.recordedAt ? ` Latest reading: ${snapshot.recordedAt}` : ""}</p>
      <p className="mt-2 text-sm opacity-70">
        Guide sources: <a className="underline" href="https://ohceac.osu.edu/CEBPI-Environment" target="_blank" rel="noreferrer">Ohio State CEA</a>{" · "}
        <a className="underline" href="https://extension.umn.edu/strawberry-farming/strawberry-nutrient-management" target="_blank" rel="noreferrer">UMN Extension</a>{" · "}
        <a className="underline" href="https://extension.psu.edu/strawberry-production" target="_blank" rel="noreferrer">Penn State Extension</a>
      </p>
    </main>
  );
}
