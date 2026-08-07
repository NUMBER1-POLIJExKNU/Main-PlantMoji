"use server";

// Settings mutations (handoff §13, §14). Web-originated writes: everything
// else flows through device events.
//
// updatePlantSettings is naturally idempotent — re-submitting the same form
// writes the same values. addGrowthRecord is a manual log entry (handoff
// §14: Growth Stage must be MANUAL or record-based, never inferred from
// current sensors) — each submission intentionally appends a new record,
// the same way a user would write a new line in a paper growth journal.

import { revalidatePath } from "next/cache";
import { parseGrowthInput } from "@/lib/growth";
import { normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  GROWTH_RECORD_XP,
  growthWeekRewardKey,
  isoWeekString,
} from "@/game/progression/bonus-xp";
import { awardXp } from "@/game/progression/xp-engine";
import { normalizePersonality } from "@/types/game";

/**
 * Validates and persists the plant's editable settings (name, personality,
 * growth stage). Invalid input is rejected without writing — the form's
 * client-side constraints make that path unreachable in normal use.
 */
export async function updatePlantSettings(formData: FormData): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const rawPlantId = formData.get("plantId");
  const plantId =
    typeof rawPlantId === "string" && rawPlantId.length > 0 && rawPlantId.length <= 64
      ? rawPlantId
      : "plant-01";

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (name.length < 1 || name.length > 40) return;

  // Personality is coerced to a valid id (unknown values fall back to "cute",
  // handoff §13); growth stage must match the manual MVP list exactly (§14).
  const personality = normalizePersonality(formData.get("personality"));
  const growthStage = normalizeGrowthStage(formData.get("growthStage"));
  if (!growthStage) return;

  const { error } = await supabase
    .from("plants")
    .update({ name, personality, growth_stage: growthStage })
    .eq("id", plantId);

  if (error) {
    console.error(`updatePlantSettings(${plantId}) failed:`, error.message);
    return;
  }

  revalidatePath("/");
  revalidatePath("/settings");
}

/**
 * Appends a manual growth-record log entry (handoff §14, §35) and, because a
 * record IS the manual source of truth for growth stage, also updates
 * `plants.growth_stage` to match the new record's stage. Invalid input is
 * rejected without writing — the form's client-side constraints make that
 * path unreachable in normal use.
 */
export async function addGrowthRecord(formData: FormData): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const parsed = parseGrowthInput({
    plantId: formData.get("plantId"),
    stage: formData.get("stage"),
    heightCm: formData.get("heightCm"),
    leafCount: formData.get("leafCount"),
    note: formData.get("note"),
  });
  if (!parsed.ok) {
    console.error(`addGrowthRecord rejected: ${parsed.error}`);
    return;
  }

  const { plantId, stage, heightCm, leafCount, note } = parsed.input;

  const { error: insertError } = await supabase.from("growth_records").insert({
    plant_id: plantId,
    stage,
    height_cm: heightCm,
    leaf_count: leafCount,
    note,
  });

  if (insertError) {
    console.error(`addGrowthRecord(${plantId}) insert failed:`, insertError.message);
    return;
  }

  // Growth journaling bonus (handoff §28): the persisted record is the
  // verified outcome, and the ISO-week reward key caps the bonus at one award
  // per week no matter how many records are logged — the award_xp ledger
  // makes every repeat a no-op. The record insert above already succeeded, so
  // an award failure must never fail the action: log and continue.
  try {
    await awardXp(
      supabase,
      plantId,
      growthWeekRewardKey(plantId, isoWeekString(new Date())),
      GROWTH_RECORD_XP,
      "growth-record",
    );
  } catch (error) {
    console.error(`addGrowthRecord(${plantId}) weekly bonus XP failed:`, error);
  }

  const { error: updateError } = await supabase
    .from("plants")
    .update({ growth_stage: stage })
    .eq("id", plantId);

  if (updateError) {
    console.error(`addGrowthRecord(${plantId}) growth_stage update failed:`, updateError.message);
  }

  revalidatePath("/settings");
}
