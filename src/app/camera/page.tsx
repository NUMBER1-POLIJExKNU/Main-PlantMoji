// Camera AI — growth photo diary capture screen (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Server component: resolves locale + Supabase setup states (the same
// Notice ladder as /diary) and probes the plant-photos bucket ONCE so the
// client can render the operator "coming soon" note with the camera input
// disabled when milestone19 hasn't been run (spec §Error handling).

import CameraCapture from "@/components/camera-capture";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import { getRequestLocale } from "@/lib/i18n-server";
import { getPlant } from "@/lib/queries";
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
        title="Supabase connection error"
        lines={[result.message, "Double-check your URL and key values."]}
      />
    );
  }
  if (result.status === "not-found") {
    return (
      <Notice
        title={`No data for ${PLANT_ID}`}
        lines={["Run supabase/milestone1.sql in the Supabase SQL Editor."]}
      />
    );
  }

  // Bucket probe: list() errors when milestone19 hasn't created the bucket.
  // Cheap (limit 1) and server-side only — the browser never sees storage
  // credentials beyond the public read URL.
  const probe = await supabase.storage.from("plant-photos").list("", { limit: 1 });
  const bucketReady = !probe.error;

  return (
    <main className="mx-auto w-full">
      <PageHeader icon="📷" title={copy.title} description={copy.description} />
      <div className="mx-auto w-full max-w-[640px]">
        <CameraCapture locale={locale} bucketReady={bucketReady} />
      </div>
    </main>
  );
}
