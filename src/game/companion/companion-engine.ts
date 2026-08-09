import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANION_LADDER, COMPANION_STAGES } from "@/types/game";
import type { CareAffinity, CompanionStage, QuestKey } from "@/types/game";

export interface VerifiedCare {
  questKey: QuestKey;
  completedAt: string;
}

const STAGE_RANK = Object.fromEntries(
  COMPANION_STAGES.map((stage, rank) => [stage, rank]),
) as Record<CompanionStage, number>;

export function affinityForQuest(key: QuestKey): Exclude<CareAffinity, "balanced"> {
  if (key === "COOL_ME_DOWN") return "cool";
  if (key === "HUMIDIFY_MY_AIR") return "air";
  if (key === "GIVE_ME_MORE_LIGHT") return "light";
  if (key === "BALANCE_SOIL_ACIDIC" || key === "BALANCE_SOIL_ALKALINE") return "soil";
  return "steady";
}

function wibDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function careForm(care: VerifiedCare[]): CareAffinity {
  const counts = new Map<CareAffinity, number>();
  for (const item of care) {
    const affinity = affinityForQuest(item.questKey);
    counts.set(affinity, (counts.get(affinity) ?? 0) + 1);
  }
  const best = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === best).map(([key]) => key);
  return leaders.length === 1 ? leaders[0] : "balanced";
}

/** The three eligibility axes, shared by the ladder walk and the display-only
 *  progress counters persisted in `companion_state`. */
export function careAxes(care: VerifiedCare[]) {
  return {
    careCount: care.length,
    affinityCount: new Set(care.map((item) => affinityForQuest(item.questKey))).size,
    dayCount: new Set(care.map((item) => wibDay(item.completedAt))).size,
  };
}

export function eligibleCompanionStage(care: VerifiedCare[]): CompanionStage {
  const { careCount, affinityCount, dayCount } = careAxes(care);
  for (let i = COMPANION_LADDER.length - 1; i >= 0; i--) {
    const req = COMPANION_LADDER[i];
    if (careCount >= req.care && affinityCount >= req.affinities && dayCount >= req.days) {
      return req.stage;
    }
  }
  return "Seed";
}

function missingTable(error: { code?: string; message: string }) {
  return error.code === "PGRST205" || /could not find the table/i.test(error.message);
}

/** milestone16 columns absent — PostgREST schema-cache miss (PGRST204) or raw Postgres 42703. */
function missingColumn(error: { code?: string; message: string }) {
  return error.code === "PGRST204" || error.code === "42703" || /could not find the '.+' column/i.test(error.message) || /column .+ does not exist/i.test(error.message);
}

/** Display-only progress counters (milestone16). They never gate or grant anything. */
const COUNTER_COLUMNS = ["care_count", "affinity_count", "day_count"] as const;

function storedCounter(state: Record<string, unknown>, column: string): number {
  const value = state[column];
  return typeof value === "number" ? value : 0;
}

async function upsertCompanionState(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const { error } = await supabase.from("companion_state").upsert(payload, { onConflict: "plant_id" });
  if (!error) return;
  if (missingColumn(error)) {
    // milestone16 not applied yet — retry without the display-only counter columns.
    const legacy = { ...payload };
    for (const column of COUNTER_COLUMNS) delete legacy[column];
    const retry = await supabase.from("companion_state").upsert(legacy, { onConflict: "plant_id" });
    if (retry.error) throw new Error(`companion: state update failed: ${retry.error.message}`);
    return;
  }
  throw new Error(`companion: state update failed: ${error.message}`);
}

/** Monotonic, replay-safe evolution sweep. Missing milestone 11 is a safe no-op. */
export async function evaluateCompanion(supabase: SupabaseClient, plantId: string, now = new Date()) {
  const stateQuery = supabase.from("companion_state").select("*").eq("plant_id", plantId) as unknown as { maybeSingle?: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }> };
  // Also keeps older test doubles and pre-migration clients compatible.
  if (typeof stateQuery.maybeSingle !== "function") return null;
  const stateResult = await stateQuery.maybeSingle();
  if (stateResult.error) {
    if (missingTable(stateResult.error)) return null;
    throw new Error(`companion: state lookup failed: ${stateResult.error.message}`);
  }
  const state = stateResult.data ?? { plant_id: plantId, cycle: 1, stage: "Seed", form_key: "balanced" };
  const questsResult = await supabase.from("quests").select("quest_key, completed_at").eq("plant_id", plantId).eq("status", "COMPLETED").order("completed_at", { ascending: true });
  if (questsResult.error) throw new Error(`companion: care lookup failed: ${questsResult.error.message}`);
  const care = (questsResult.data ?? []).filter((row) => typeof row.completed_at === "string").map((row) => ({ questKey: row.quest_key as QuestKey, completedAt: row.completed_at as string }));
  const target = eligibleCompanionStage(care);
  const axes = careAxes(care);
  // Display-only progress counters persisted for the farm layer. Never gate or grant anything.
  const counters = { care_count: axes.careCount, affinity_count: axes.affinityCount, day_count: axes.dayCount };
  if (STAGE_RANK[target] <= STAGE_RANK[state.stage as CompanionStage]) {
    const fresh = COUNTER_COLUMNS.every((column) => storedCounter(state as Record<string, unknown>, column) === counters[column]);
    if (fresh) return state; // no write churn on every tick
    await upsertCompanionState(supabase, { plant_id: plantId, cycle: state.cycle, stage: state.stage, form_key: state.form_key, ...counters, updated_at: now.toISOString() });
    return { ...state, ...counters };
  }

  const evolvedAt = now.toISOString();
  const formKey = careForm(care);
  const snapshot = Object.fromEntries(["cool", "air", "light", "soil", "steady"].map((key) => [key, care.filter((item) => affinityForQuest(item.questKey) === key).length]));
  const stages = ([...COMPANION_STAGES] as CompanionStage[]).slice(STAGE_RANK[state.stage as CompanionStage] + 1, STAGE_RANK[target] + 1);
  let fromStage = state.stage as CompanionStage;
  for (const stage of stages) {
    const { error: evolutionError } = await supabase.from("companion_evolutions").upsert({ plant_id: plantId, cycle: state.cycle, stage, from_stage: fromStage, form_key: formKey, care_snapshot: snapshot, evolved_at: evolvedAt }, { onConflict: "plant_id,cycle,stage", ignoreDuplicates: true });
    if (evolutionError) throw new Error(`companion: evolution insert failed: ${evolutionError.message}`);
    const { error: eventError } = await supabase.from("bond_events").upsert({ event_id: `companion:${plantId}:${state.cycle}:${stage}`, plant_id: plantId, type: "COMPANION_EVOLVED", occurred_at: evolvedAt, data: { fromStage, stage, formKey, reason: `${care.length} verified care quests` } }, { onConflict: "event_id", ignoreDuplicates: true });
    if (eventError) throw new Error(`companion: event insert failed: ${eventError.message}`);
    fromStage = stage;
  }
  await upsertCompanionState(supabase, { plant_id: plantId, cycle: state.cycle, stage: target, form_key: formKey, last_evolved_at: evolvedAt, updated_at: evolvedAt, ...counters });
  return { ...state, stage: target, form_key: formKey, last_evolved_at: evolvedAt, updated_at: evolvedAt, ...counters };
}
