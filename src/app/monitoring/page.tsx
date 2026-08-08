// /monitoring — live sensor dashboard, replicating the hardware team's
// Node-RED dashboard (DESIGN/dashboard.png) with English labels.

import type { Metadata } from "next";
import MonitoringLive from "@/components/monitoring-live";
import PageHeader from "@/components/page-header";
import { getRequestLocale } from "@/lib/i18n-server";

// Live data screen — never prerender a stale snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plant Monitoring — PlantMoji",
};

export default async function MonitoringPage() {
  const locale = await getRequestLocale();

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
        title={locale === "id" ? "Dashboard Tanaman" : "Plant Dashboard"}
        description={locale === "id"
          ? "Pembacaan langsung dari sensor tanaman, diperbarui setiap 10 detik."
          : "Live readings from the plant's sensors, refreshed every 10 seconds."}
      />

      <MonitoringLive />

      <p className="mt-6 text-center text-xs leading-5 text-[#57684F]">
        {locale === "id"
          ? "Kelembapan tanah dan lux akan muncul begitu alur baru dari tim perangkat keras mulai mencatatnya (kolom ditambahkan lewat supabase/milestone6-monitoring.sql)."
          : "Soil moisture and lux appear once the hardware team's new flow starts logging them (columns added by supabase/milestone6-monitoring.sql)."}
      </p>
    </main>
  );
}
