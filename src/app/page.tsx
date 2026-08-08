import PlantHome from "@/components/plant-home";
import Notice from "@/components/notice";
import { fetchBondState, fetchPlant, fetchTopActiveQuest } from "@/lib/plants";
import { getHomeMoodMessage } from "@/lib/plant-messages";
import { maybeScheduleGameTick } from "@/lib/tick-gate";

// The plant's live state must always be read fresh from Supabase.
export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function Home() {
  // Lazy sweep, deferred: awaiting it here blocked every render on the
  // engine's Supabase sweep. It now runs after the response
  // (lib/tick-gate.ts); PlantHome's realtime subscriptions and the next
  // navigation surface any completions it lands.
  maybeScheduleGameTick(PLANT_ID);

  const result = await fetchPlant(PLANT_ID);

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

  const [bond, quest, moodMessage] = await Promise.all([
    fetchBondState(PLANT_ID),
    fetchTopActiveQuest(PLANT_ID),
    // AI-personalized when ANTHROPIC_API_KEY is set (cached per mood change,
    // handoff §24); deterministic template otherwise — never blocks on failure.
    getHomeMoodMessage(result.plant),
  ]);

  return (
    <PlantHome
      initialPlant={result.plant}
      initialBond={bond}
      initialQuest={quest}
      initialMoodMessage={moodMessage}
    />
  );
}
