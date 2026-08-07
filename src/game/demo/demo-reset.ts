import type { SupabaseClient } from "@supabase/supabase-js";

const RESET_EPOCH = "1970-01-01T00:00:00Z";

export const DEMO_RESET_TABLES = [
  "xp_rewards",
  "bond_events",
  "plant_badges",
  "quests",
  "device_events",
] as const;

export class DemoResetError extends Error {
  constructor(
    message: string,
    public readonly kind: "unknown-plant" | "database",
  ) {
    super(message);
    this.name = "DemoResetError";
  }
}

/**
 * Restores only game progress to the fresh-demo baseline. Sensor readings and
 * manual growth records are intentionally outside this function's scope.
 */
export async function resetDemoProgress(supabase: SupabaseClient, plantId: string) {
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .maybeSingle();

  if (plantError) {
    throw new DemoResetError(`plant lookup failed: ${plantError.message}`, "database");
  }
  if (!plant) throw new DemoResetError(`unknown plantId: ${plantId}`, "unknown-plant");

  const cleared: Record<string, number> = {};
  for (const table of DEMO_RESET_TABLES) {
    const { data, count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("plant_id", plantId)
      .select("*");
    if (error) {
      throw new DemoResetError(`failed to clear ${table}: ${error.message}`, "database");
    }
    cleared[table] = count ?? data?.length ?? 0;
  }

  const nowIso = new Date().toISOString();
  const { error: bondError } = await supabase.from("bond_state").upsert(
    {
      plant_id: plantId,
      total_xp: 0,
      bond_level: 1,
      current_streak: 0,
      longest_streak: 0,
      last_qualified_date: null,
      current_chapter: 1,
      updated_at: nowIso,
    },
    { onConflict: "plant_id" },
  );
  if (bondError) {
    throw new DemoResetError(`failed to reset bond_state: ${bondError.message}`, "database");
  }

  const { error: plantResetError } = await supabase
    .from("plants")
    .update({ current_state: "Happy", state_changed_at: RESET_EPOCH })
    .eq("id", plantId);
  if (plantResetError) {
    throw new DemoResetError(`failed to reset plants: ${plantResetError.message}`, "database");
  }

  return { plantId, cleared };
}
