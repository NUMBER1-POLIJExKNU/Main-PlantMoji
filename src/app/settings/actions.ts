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
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { applyDemoMaxState } from "@/game/demo/demo-max";
import { resetDemoProgress } from "@/game/demo/demo-reset";
import { advanceDemoCompanion, awardDemoLevelUp, prepareNextLevelDemo } from "@/game/demo/presenter";
import { parseGrowthInput } from "@/lib/growth";
import { normalizeLocale, type AppLocale } from "@/lib/i18n";
import { normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  GROWTH_RECORD_XP,
  growthWeekRewardKey,
  isoWeekString,
} from "@/game/progression/bonus-xp";
import { awardXp } from "@/game/progression/xp-engine";
import { normalizePersonality } from "@/types/game";

export interface DemoActionState {
  status: "idle" | "success" | "error";
  message: string;
}

/** Kept as an alias for older imports while the demo panel is upgraded. */
export type DemoMaxActionState = DemoActionState;

function matchesDemoCode(submitted: string, configured: string): boolean {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(submittedHash, configuredHash);
}

function demoLocale(formData: FormData): AppLocale {
  return normalizeLocale(formData.get("locale"));
}

function validateDemoCode(formData: FormData, locale: AppLocale): string | DemoActionState {
  const configuredCode = "admin";

  const rawCode = formData.get("demoCode");
  const submittedCode = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!submittedCode || !matchesDemoCode(submittedCode, configuredCode)) {
    return {
      status: "error",
      message: locale === "id" ? "Kode demo tidak cocok." : "That demo code is not correct.",
    };
  }
  return submittedCode;
}

async function runPresenterAction(formData: FormData, operation: "prepare" | "level" | "evolve"): Promise<DemoActionState> {
  const locale = demoLocale(formData);
  const validation = validateDemoCode(formData, locale);
  if (typeof validation !== "string") return validation;
  const supabase = getServerSupabase();
  if (!supabase) return { status: "error", message: locale === "id" ? "Supabase belum dikonfigurasi." : "Supabase is not configured." };
  try {
    if (operation === "prepare") {
      const result = await prepareNextLevelDemo(supabase, "plant-01");
      revalidateDemoRoutes();
      return { status: "success", message: locale === "id" ? `Siap: Lv.${result.level}, ${result.totalXp} XP. Tinggal +1 XP!` : `Ready: Lv.${result.level}, ${result.totalXp} XP. Just +1 XP to go!` };
    }
    if (operation === "level") {
      const result = await awardDemoLevelUp(supabase, "plant-01", `presenter:${randomUUID()}`);
      revalidateDemoRoutes();
      return { status: "success", message: locale === "id" ? `Sekarang Lv.${result.bondLevel} · ${result.totalXp} XP.` : `Now Lv.${result.bondLevel} · ${result.totalXp} XP.` };
    }
    const result = await advanceDemoCompanion(supabase, "plant-01");
    revalidateDemoRoutes();
    return { status: "success", message: result.evolved ? (locale === "id" ? `${result.fromStage} berevolusi menjadi ${result.stage}!` : `${result.fromStage} evolved into ${result.stage}!`) : (locale === "id" ? "Jamkachu sudah mencapai Guardian." : "Jamkachu is already a Guardian.") };
  } catch (cause) {
    console.error(`demo presenter ${operation} failed:`, cause);
    return { status: "error", message: locale === "id" ? "Aksi demo gagal. Periksa migrasi Supabase." : "Demo action failed. Check the Supabase migrations." };
  }
}

export async function prepareDemoLevelUp(_previousState: DemoActionState, formData: FormData) { return runPresenterAction(formData, "prepare"); }
export async function grantDemoXp(_previousState: DemoActionState, formData: FormData) { return runPresenterAction(formData, "level"); }
export async function evolveDemoCompanion(_previousState: DemoActionState, formData: FormData) { return runPresenterAction(formData, "evolve"); }

function revalidateDemoRoutes() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/quests");
  revalidatePath("/collection");
  revalidatePath("/reports");
  revalidatePath("/plants");
}

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
  const photo = formData.get("photo");
  const acceptedPhoto = photo instanceof File && photo.size > 0
    && photo.size <= 5 * 1024 * 1024
    && ["image/jpeg", "image/png", "image/webp"].includes(photo.type)
    ? photo
    : null;
  if (photo instanceof File && photo.size > 0 && !acceptedPhoto) {
    console.error("addGrowthRecord rejected photo: use JPEG, PNG, or WebP up to 5 MB");
    return;
  }
  const recordId = randomUUID();
  let photoPath: string | null = null;
  if (acceptedPhoto) {
    const extension = acceptedPhoto.type === "image/png" ? "png" : acceptedPhoto.type === "image/webp" ? "webp" : "jpg";
    photoPath = `${plantId}/${recordId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("growth-snapshots").upload(photoPath, await acceptedPhoto.arrayBuffer(), { contentType: acceptedPhoto.type, upsert: false });
    if (uploadError) {
      console.error(`addGrowthRecord(${plantId}) snapshot upload failed:`, uploadError.message);
      photoPath = null; // the written growth fact must not depend on photo storage
    }
  }

  const { error: insertError } = await supabase.from("growth_records").insert({
    id: recordId,
    plant_id: plantId,
    stage,
    height_cm: heightCm,
    leaf_count: leafCount,
    note,
    photo_path: photoPath,
  });

  if (insertError) {
    if (photoPath) await supabase.storage.from("growth-snapshots").remove([photoPath]);
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

  // The add-record form now lives on /diary (Growth Records moved out of
  // Settings) — revalidate that route instead of /settings.
  revalidatePath("/diary");
}

/**
 * Presentation-only max unlock. The code is configured server-side and is
 * never shipped to the browser bundle. It changes game/collection progress,
 * but never sensor truth, crop thresholds, or hardware control.
 */
export async function activateDemoMaxMode(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const locale = demoLocale(formData);
  const validation = validateDemoCode(formData, locale);
  if (typeof validation !== "string") return validation;

  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      status: "error",
      message: locale === "id" ? "Supabase belum dikonfigurasi." : "Supabase is not configured.",
    };
  }

  try {
    const result = await applyDemoMaxState(supabase, "plant-01");
    revalidateDemoRoutes();

    return {
      status: "success",
      message:
        locale === "id"
          ? `Mode maksimal aktif! Lv.${result.level} · ${result.moods} suasana · ${result.badges} lencana · ${result.chapters} cerita terbuka.`
          : `Max mode on! Lv.${result.level} · ${result.moods} moods · ${result.badges} badges · ${result.chapters} stories unlocked.`,
    };
  } catch (cause) {
    console.error("activateDemoMaxMode failed:", cause);
    return {
      status: "error",
      message:
        locale === "id"
          ? "Gagal membuka semuanya. Periksa migrasi Supabase lalu coba lagi."
          : "Max unlock failed. Check the Supabase migrations, then try again.",
    };
  }
}

/** Restores the presentation storyline to its beginning with the same code. */
export async function resetDemoMode(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  const locale = demoLocale(formData);
  const validation = validateDemoCode(formData, locale);
  if (typeof validation !== "string") return validation;

  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      status: "error",
      message: locale === "id" ? "Supabase belum dikonfigurasi." : "Supabase is not configured.",
    };
  }

  try {
    await resetDemoProgress(supabase, "plant-01");
    revalidateDemoRoutes();
    return {
      status: "success",
      message:
        locale === "id"
          ? "Demo kembali ke awal: Lv.1, 0 XP, tanpa lencana atau riwayat misi."
          : "Demo reset to the beginning: Lv.1, 0 XP, with no badges or quest history.",
    };
  } catch (cause) {
    console.error("resetDemoMode failed:", cause);
    return {
      status: "error",
      message:
        locale === "id"
          ? "Gagal mengatur ulang demo. Periksa migrasi Supabase lalu coba lagi."
          : "Demo reset failed. Check the Supabase migrations, then try again.",
    };
  }
}
