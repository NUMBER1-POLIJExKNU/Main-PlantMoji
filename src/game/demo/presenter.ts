import type { SupabaseClient } from "@supabase/supabase-js";
import { awardXp, getBondState } from "@/game/progression/xp-engine";
import { COMPANION_STAGES, XP_PER_LEVEL, companionStageForLevel, levelForXp, type CompanionStage } from "@/types/game";

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
  const bond = await getBondState(supabase, plantId);
  const level = bond?.bond_level ?? 1;
  const fromStage = companionStageForLevel(level);
  if (level >= COMPANION_STAGES.length) return { fromStage, stage: fromStage, evolved: false };

  // The demo shortcut obeys production truth: award exactly enough XP for
  // the next Bond Level, then awardXp runs the shared level→stage sync.
  const targetXp = level * XP_PER_LEVEL;
  const amount = Math.max(1, targetXp - (bond?.total_xp ?? 0));
  const result = await awardXp(
    supabase,
    plantId,
    `presenter-evolve:${plantId}:${level + 1}:${now.getTime()}`,
    amount,
    "presenter-level-evolution",
  );
  const stage = companionStageForLevel(result.bondLevel);
  return { fromStage, stage, evolved: stage !== fromStage };
}
