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
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
          Plant Monitoring
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Live readings from the plant&apos;s sensors, refreshed every 10 seconds.
        </p>
      </header>

      <MonitoringLive />

      <p className="mt-6 text-center text-xs leading-5 text-zinc-400 dark:text-zinc-500">
        Soil moisture and lux appear once the hardware team&apos;s new flow starts logging them
        (columns added by supabase/milestone6-monitoring.sql).
      </p>
    </main>
  );
}
