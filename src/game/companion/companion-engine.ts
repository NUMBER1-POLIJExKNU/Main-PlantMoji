import type { SupabaseClient } from "@supabase/supabase-js";
import { isCheckViolation, isMissingTableError } from "@/lib/supabase-errors";
import { COMPANION_STAGES, companionStageForLevel } from "@/types/game";
import type { CompanionStage } from "@/types/game";

const STAGE_RANK = Object.fromEntries(
  COMPANION_STAGES.map((stage, rank) => [stage, rank]),
) as Record<CompanionStage, number>;

function normalizeStage(value: unknown): CompanionStage {
  return (COMPANION_STAGES as readonly unknown[]).includes(value)
    ? value as CompanionStage
    : "Seed";
}

async function readCompanionState(supabase: SupabaseClient, plantId: string) {
  const query = supabase
    .from("companion_state")
    .select("*")
    .eq("plant_id", plantId) as unknown as {
      maybeSingle?: () => Promise<{
        data: Record<string, unknown> | null;
        error: { code?: string; message: string } | null;
      }>;
    };
  if (typeof query.maybeSingle !== "function") return { supported: false as const, data: null };
  const result = await query.maybeSingle();
  if (result.error) {
    if (isMissingTableError(result.error)) return { supported: false as const, data: null };
    throw new Error(`companion: state lookup failed: ${result.error.message}`);
  }
  return { supported: true as const, data: result.data };
}

/**
 * Synchronize the virtual companion to an authoritative Bond Level.
 *
 * Bond Level is the ONLY evolution condition. Care counts, affinity variety,
 * and elapsed days are intentionally absent. The function stays as an app-side
 * fallback for databases that have not installed milestone21's trigger yet;
 * with that trigger installed it becomes an idempotent read/no-op.
 */
export async function syncCompanionForLevel(
  supabase: SupabaseClient,
  plantId: string,
  bondLevel: number,
  now = new Date(),
) {
  const lookup = await readCompanionState(supabase, plantId);
  if (!lookup.supported) return null;

  const target = companionStageForLevel(bondLevel);
  const state = lookup.data ?? {
    plant_id: plantId,
    cycle: 1,
    stage: "Seed",
    form_key: "balanced",
  };
  const current = normalizeStage(state.stage);
  const cycle = Math.max(1, Number(state.cycle) || 1);
  const formKey = typeof state.form_key === "string" && state.form_key
    ? state.form_key
    : "balanced";
  const evolvedAt = now.toISOString();

  if (current === target && lookup.data) return state;

  // A legacy care-gated row may be ahead of its Bond Level. The new rule is
  // exact, so normalize it without emitting a backwards "evolution" event.
  if (STAGE_RANK[target] <= STAGE_RANK[current]) {
    const { error } = await supabase.from("companion_state").upsert({
      plant_id: plantId,
      cycle,
      stage: target,
      form_key: formKey,
      updated_at: evolvedAt,
    }, { onConflict: "plant_id" });
    if (error) {
      if (isCheckViolation(error) || isMissingTableError(error)) return state;
      throw new Error(`companion: level sync failed: ${error.message}`);
    }
    return { ...state, stage: target, updated_at: evolvedAt };
  }

  // Record every crossed rung for a trustworthy diary, while the client plays
  // one ceremony from the previously rendered stage to the final target.
  const crossed = ([...COMPANION_STAGES] as CompanionStage[]).slice(
    STAGE_RANK[current] + 1,
    STAGE_RANK[target] + 1,
  );
  let fromStage = current;
  const accepted: CompanionStage[] = [];
  for (const stage of crossed) {
    const snapshot = { bondLevel: Math.max(1, Math.floor(bondLevel)), rule: "bond-level" };
    const { error: evolutionError } = await supabase.from("companion_evolutions").upsert({
      plant_id: plantId,
      cycle,
      stage,
      from_stage: fromStage,
      form_key: formKey,
      care_snapshot: snapshot,
      evolved_at: evolvedAt,
    }, { onConflict: "plant_id,cycle,stage", ignoreDuplicates: true });
    if (evolutionError) {
      if (isCheckViolation(evolutionError)) continue;
      if (isMissingTableError(evolutionError)) return state;
      throw new Error(`companion: evolution insert failed: ${evolutionError.message}`);
    }
    const { error: eventError } = await supabase.from("bond_events").upsert({
      event_id: `companion:${plantId}:${cycle}:${stage}`,
      plant_id: plantId,
      type: "COMPANION_EVOLVED",
      occurred_at: evolvedAt,
      data: { fromStage, stage, formKey, bondLevel, reason: `Bond Level ${bondLevel}` },
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (eventError) throw new Error(`companion: event insert failed: ${eventError.message}`);
    accepted.push(stage);
    fromStage = stage;
  }

  // Pre-milestone16 databases reject the newer stage names. Walk down to the
  // highest accepted rung so the feature degrades instead of breaking XP.
  for (let i = accepted.length - 1; i >= 0; i -= 1) {
    const stage = accepted[i];
    const { error } = await supabase.from("companion_state").upsert({
      plant_id: plantId,
      cycle,
      stage,
      form_key: formKey,
      last_evolved_at: evolvedAt,
      updated_at: evolvedAt,
    }, { onConflict: "plant_id" });
    if (!error) return { ...state, stage, last_evolved_at: evolvedAt, updated_at: evolvedAt };
    if (!isCheckViolation(error)) return state;
  }
  return state;
}

/** Read the persisted Bond Level and enforce the level-only stage mapping. */
export async function evaluateCompanion(
  supabase: SupabaseClient,
  plantId: string,
  now = new Date(),
) {
  const query = supabase
    .from("bond_state")
    .select("bond_level")
    .eq("plant_id", plantId) as unknown as {
      maybeSingle?: () => Promise<{
        data: { bond_level?: number } | null;
        error: { code?: string; message: string } | null;
      }>;
    };
  if (typeof query.maybeSingle !== "function") return null;
  const result = await query.maybeSingle();
  if (result.error) {
    if (isMissingTableError(result.error)) return null;
    throw new Error(`companion: bond lookup failed: ${result.error.message}`);
  }
  return syncCompanionForLevel(supabase, plantId, result.data?.bond_level ?? 1, now);
}
