// /monitoring — live sensor dashboard, replicating the hardware team's
// Node-RED dashboard (DESIGN/dashboard.png) with English labels.

import type { Metadata } from "next";
import MonitoringLive from "@/components/monitoring-live";
import PageHeader from "@/components/page-header";
import { getRequestLocale } from "@/lib/i18n-server";
import { getCropProfile, type CropProfile } from "@/lib/crop-profiles";
import { getPlant } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";

// Live data screen — never prerender a stale snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plant Monitoring — PlantMoji",
};

const PLANT_ID = "plant-01";

/**
 * Sensor HUD spec (docs/superpowers/specs/2026-08-09-sensor-hud-stat-cards-design.md):
 * the monitoring dashboard's comfort band/legend must come from the SAME
 * source of truth the game engine uses (crop-profiles.ts), threaded through
 * whatever path already gets this page its data — here that's a server
 * component prop, exactly like plants/page.tsx already does with
 * `getCropProfile(plant.crop_profile_key)`. No new endpoint, no hand-typed
 * numbers. Never throws: any failure (no env, missing table, unknown plant)
 * resolves to null, and MonitoringLive renders the charts unchanged with no
 * band/legend, per spec.
 */
async function loadActiveCropProfile(plantId: string): Promise<CropProfile | null> {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return null;
    const result = await getPlant(supabase, plantId);
    if (result.status !== "ok") return null;
    return getCropProfile(result.plant.crop_profile_key);
  } catch (error) {
    console.error("monitoring: active crop profile lookup failed:", error);
    return null;
  }
}

export default async function MonitoringPage() {
  const locale = await getRequestLocale();
  const cropProfile = await loadActiveCropProfile(PLANT_ID);

  // Farm look: pixel heading on the sky, gauges/chart in .pm-panel cards
  // (the shell centers <main> at its reading measure). MonitoringLive itself
  // deliberately keeps its English sensor labels — it replicates the
  // hardware team's Node-RED dashboard (see that file's header comment) —
  // so only this page's chrome copy is localized here.
  return (
    <main className="mx-auto w-full">
      <PageHeader
        icon="📈"
        eyebrow={locale === "id" ? "Sensor langsung" : "Live sensors"}
        title={locale === "id" ? "Pemantauan" : "Monitoring"}
        description={locale === "id"
          ? "Pembacaan langsung dari sensor tanaman, diperbarui setiap 10 detik."
          : "Live readings from the plant's sensors, refreshed every 10 seconds."}
      />

      <MonitoringLive locale={locale} plantId={PLANT_ID} cropProfile={cropProfile} />

      <p className="mt-6 text-center text-xs leading-5 text-[#57684F]">
        {locale === "id"
          ? "Cahaya ditampilkan sebagai persentase relatif 0–100%. Lux hanya muncul bila perangkat memiliki konversi lux yang tervalidasi."
          : "Light is shown as a relative 0–100% value. Lux appears only when the device provides a validated lux conversion."}
      </p>
    </main>
  );
}
