import type { SupabaseClient } from "@supabase/supabase-js";
import { awardXp, getBondState } from "@/game/progression/xp-engine";
import { COMPANION_STAGES, XP_PER_LEVEL, levelForXp, type CompanionStage } from "@/types/game";

export const DEMO_PRESENTATION_MAX_XP = XP_PER_LEVEL * 10 - 1;

export function xpBeforeNextLevel(totalXp: number): number {
  const safe = Math.max(0, Math.floor(totalXp));
  const target = levelForXp(safe) * XP_PER_LEVEL - 1;
  return Math.min(DEMO_PRESENTATION_MAX_XP, Math.max(safe, target));
}

export function nextCompanionStage(stage: CompanionStage): CompanionStage | null {
  const index = COMPANION_STAGES.indexOf(stage);
  return index >= 0 && index < COMPANION_STAGES.length - 1 ? COMPANION_STAGES[index + 1] : null;
}

export async function prepareNextLevelDemo(supabase: SupabaseClient, plantId: string) {
  const current = await getBondState(supabase, plantId);
  const totalXp = current?.total_xp ?? 0;
  const targetXp = xpBeforeNextLevel(totalXp);
  const { error } = await supabase.from("bond_state").upsert({
    plant_id: plantId,
    total_xp: targetXp,
    bond_level: levelForXp(targetXp),
    updated_at: new Date().toISOString(),
  }, { onConflict: "plant_id" });
  if (error) throw new Error(`demo presenter level setup failed: ${error.message}`);
  return { totalXp: targetXp, level: levelForXp(targetXp), ready: targetXp < DEMO_PRESENTATION_MAX_XP };
}

export async function awardDemoLevelUp(supabase: SupabaseClient, plantId: string, rewardKey: string) {
  const current = await getBondState(supabase, plantId);
  if ((current?.total_xp ?? 0) >= DEMO_PRESENTATION_MAX_XP) return { totalXp: current?.total_xp ?? 0, bondLevel: current?.bond_level ?? 10, leveledUp: false, duplicate: false };
  return awardXp(supabase, plantId, rewardKey, 1, "presenter-level-up");
}

export async function advanceDemoCompanion(supabase: SupabaseClient, plantId: string, now = new Date()) {
  const { data, error } = await supabase.from("companion_state").select("*").eq("plant_id", plantId).maybeSingle();
  if (error) throw new Error(`demo presenter companion lookup failed: ${error.message}`);
  const current = (data?.stage ?? "Seed") as CompanionStage;
  const next = nextCompanionStage(current);
  if (!next) return { fromStage: current, stage: current, evolved: false };
  const cycle = Number(data?.cycle ?? 1);
  const occurredAt = now.toISOString();
  const evolution = { plant_id: plantId, cycle, stage: next, from_stage: current, form_key: "balanced", care_snapshot: { presenterDemo: 1 }, evolved_at: occurredAt };
  const { error: evolutionError } = await supabase.from("companion_evolutions").upsert(evolution, { onConflict: "plant_id,cycle,stage", ignoreDuplicates: true });
  if (evolutionError) throw new Error(`demo presenter evolution failed: ${evolutionError.message}`);
  const { error: eventError } = await supabase.from("bond_events").upsert({ event_id: `presenter:${plantId}:${cycle}:${next}`, plant_id: plantId, type: "COMPANION_EVOLVED", occurred_at: occurredAt, data: { fromStage: current, stage: next, formKey: "balanced", presenterDemo: true } }, { onConflict: "event_id", ignoreDuplicates: true });
  if (eventError) throw new Error(`demo presenter event failed: ${eventError.message}`);
  const { error: stateError } = await supabase.from("companion_state").upsert({ plant_id: plantId, cycle, stage: next, form_key: "balanced", last_evolved_at: occurredAt, updated_at: occurredAt }, { onConflict: "plant_id" });
  if (stateError) throw new Error(`demo presenter state failed: ${stateError.message}`);
  return { fromStage: current, stage: next, evolved: true };
}
