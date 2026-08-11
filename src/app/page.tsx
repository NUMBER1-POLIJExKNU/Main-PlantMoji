import PlantHome from "@/components/plant-home";
import Notice from "@/components/notice";
import { fetchBondState, fetchPlant, fetchTopActiveQuest } from "@/lib/plants";
import { getHomeMoodMessage } from "@/lib/plant-messages";
import { maybeScheduleGameTick } from "@/lib/tick-gate";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { getRequestLocale } from "@/lib/i18n-server";
import { getServerSupabase } from "@/lib/supabase/server";

// The plant's live state must always be read fresh from Supabase.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function Home() {
  // Lazy sweep, deferred: awaiting it here blocked every render on the
  // engine's Supabase sweep. It now runs after the response
  // (lib/tick-gate.ts); PlantHome's realtime subscriptions and the next
  // navigation surface any completions it lands.
  maybeScheduleGameTick(PLANT_ID);

  const supabase = getServerSupabase();
  // Independent queries in parallel (speed fix 2026-08-11): fetchPlant used
  // to be awaited alone before the other four started, serializing a full
  // round trip that didn't need to block them. None of these four reject
  // (bond/quest/snapshot map failures to null, getRequestLocale never
  // rejects) and fetchPlant maps its own failures to status objects instead
  // of throwing, so this Promise.all effectively never rejects.
  const [result, bond, quest, snapshot, locale] = await Promise.all([
    fetchPlant(PLANT_ID),
    fetchBondState(PLANT_ID),
    fetchTopActiveQuest(PLANT_ID),
    supabase ? getLatestSensorSnapshot(supabase, PLANT_ID) : null,
    getRequestLocale(),
  ]);

  if (result.status === "no-env") {
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

  if (result.status === "no-schema") {
    return (
      <Notice
        title="Supabase tables don't exist yet"
        lines={[
          "Environment variables are connected, but the schema hasn't been run.",
          "In Supabase Dashboard → SQL Editor, run these two files in order:",
          "1) supabase/milestone1.sql   2) supabase/milestone3.sql",
          "Then refresh this page and Jamkachu will appear.",
        ]}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <Notice
        title={`No data for ${PLANT_ID}`}
        lines={[
          "Run supabase/milestone1.sql in the Supabase SQL Editor",
          "to create the plants table and the Jamkachu (plant-01) seed data.",
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

  // AI-personalized when GEMINI_API_KEY is set (cached per mood change,
  // handoff §24); deterministic template otherwise — never blocks on
  // failure. Computed after the batch above since it needs result.plant,
  // one of that batch's own outputs.
  const moodMessage = await getHomeMoodMessage(result.plant);

  return (
    <PlantHome
      initialPlant={result.plant}
      initialBond={bond}
      initialQuest={quest}
      initialMoodMessage={moodMessage}
      initialSnapshot={snapshot}
      locale={locale}
    />
  );
}
