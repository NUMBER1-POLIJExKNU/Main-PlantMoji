// /monitoring — live sensor dashboard, replicating the hardware team's
// Node-RED dashboard (DESIGN/dashboard.png) with English labels.

import type { Metadata } from "next";
import MonitoringLive from "@/components/monitoring-live";

// Live data screen — never prerender a stale snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plant Monitoring — PlantMoji",
};

export default function MonitoringPage() {
  // Farm look: pixel heading on the sky, gauges/chart in .pm-panel cards
  // (the shell centers <main> at its reading measure).
  return (
    <main className="mx-auto w-full">
      <header className="mb-6">
        <h1 className="pm-heading text-lg">📈 Plant Monitoring</h1>
        <p className="mt-1 text-sm text-[#57684F]">
          Live readings from the plant&apos;s sensors, refreshed every 10 seconds.
        </p>
      </header>

      <MonitoringLive />

      <p className="mt-6 text-center text-xs leading-5 text-[#57684F]">
        Soil moisture and lux appear once the hardware team&apos;s new flow starts logging them
        (columns added by supabase/milestone6-monitoring.sql).
      </p>
    </main>
  );
}
