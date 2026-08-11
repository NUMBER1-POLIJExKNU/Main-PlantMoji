// Camera AI — Live Guardian watch screen (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md;
// supersedes the photo-diary capture screen that lived here).
//
// Server component: locale + the same Supabase Notice ladder as /diary,
// then ONE camera_events probe decides whether events persist/fan out
// (milestone19). The guardian runs fully locally either way — the mini
// Jamkachu reacts on-device even with no migration and no network.

import "./camera.css";
import "./camera-sparkles.css";
import CameraGuardian, { type GuardianFeedItem } from "@/components/camera-guardian";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import { getRequestLocale } from "@/lib/i18n-server";
import { getPlant } from "@/lib/queries";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { getServerSupabase } from "@/lib/supabase/server";
import { CAMERA_COPY } from "./copy";

export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function CameraPage() {
  const locale = await getRequestLocale();
  const copy = CAMERA_COPY[locale];
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        locale={locale}
        title="Connecting..."
        lines={[
          "Supabase environment variables are not set yet.",
          "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
          "Full steps: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  const result = await getPlant(supabase, PLANT_ID);
  if (result.status === "no-schema") {
    return (
      <Notice
        locale={locale}
        title="Supabase tables don't exist yet"
        lines={[
          "Environment variables are connected, but the schema hasn't been run.",
          "In Supabase Dashboard → SQL Editor, run supabase/milestone1.sql first.",
          "Then refresh this page.",
        ]}
      />
    );
  }
  if (result.status === "error") {
    return (
      <Notice
        locale={locale}
        title="Supabase connection error"
        lines={[result.message, "Double-check your URL and key values."]}
      />
    );
  }
  if (result.status === "not-found") {
    return (
      <Notice
        locale={locale}
        title={`No data for ${PLANT_ID}`}
        lines={["Run supabase/milestone1.sql in the Supabase SQL Editor."]}
      />
    );
  }

  const initialSnapshot = await getLatestSensorSnapshot(supabase, PLANT_ID);

  // milestone19 probe + recent-events seed: the SELECT errors while
  // camera_events is missing → guardianReady=false → local-only mode with
  // an honest operator note (never a crash).
  const probe = await supabase
    .from("camera_events")
    .select("kind, occurred_at, note")
    .eq("plant_id", PLANT_ID)
    .order("occurred_at", { ascending: false })
    .limit(8);
  const guardianReady = !probe.error;
  const initialEvents: GuardianFeedItem[] = guardianReady
    ? ((probe.data ?? []) as Array<{ kind: string; occurred_at: string; note: unknown }>).map(
        (row) => ({
          kind: row.kind === "pest_advice" ? ("pest_advice" as const) : ("touch" as const),
          at: String(row.occurred_at),
          message:
            typeof (row.note as { message?: unknown } | null)?.message === "string"
              ? ((row.note as { message: string }).message)
              : null,
        }),
      )
    : [];

  return (
    <main className="mx-auto w-full">
      <PageHeader icon="📷" eyebrow={locale === "id" ? "AMATI DENGAN AMAN" : "OBSERVE SAFELY"} title={copy.title} description={copy.description} />
      <div className="mx-auto w-full max-w-[720px]">
        <CameraGuardian
          locale={locale}
          plantId={PLANT_ID}
          guardianReady={guardianReady}
          scanConfigured={Boolean(process.env.GEMINI_API_KEY)}
          initialEvents={initialEvents}
          initialSnapshot={initialSnapshot}
        />
      </div>
    </main>
  );
}
