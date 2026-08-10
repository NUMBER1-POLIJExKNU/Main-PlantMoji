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
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { parseGrowthInput } from "@/lib/growth";
import { companionStageLabel, normalizeLocale, type AppLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { generatePhotoComment } from "@/lib/photo-comment";
import { normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  GROWTH_RECORD_XP,
  growthWeekRewardKey,
  isoWeekString,
} from "@/game/progression/bonus-xp";
import { awardXp } from "@/game/progression/xp-engine";
import { COMPANION_STAGES, normalizePersonality } from "@/types/game";

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
    // Top of the 10-stage ladder, localized — never a hardcoded stage name.
    const topStage = companionStageLabel(locale, COMPANION_STAGES[COMPANION_STAGES.length - 1]);
    return { status: "success", message: result.evolved ? (locale === "id" ? `${companionStageLabel(locale, result.fromStage)} berevolusi menjadi ${companionStageLabel(locale, result.stage)}!` : `${companionStageLabel(locale, result.fromStage)} evolved into ${companionStageLabel(locale, result.stage)}!`) : (locale === "id" ? `Jamkachu sudah mencapai ${topStage}.` : `Jamkachu is already at ${topStage}.`) };
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
  // Photo bytes are read ONCE and reused for both the storage upload and the
  // base64 payload of Jamkachu's diary reply below.
  let photoBytes: ArrayBuffer | null = null;
  if (acceptedPhoto) {
    const bytes = await acceptedPhoto.arrayBuffer();
    photoBytes = bytes;
    const extension = acceptedPhoto.type === "image/png" ? "png" : acceptedPhoto.type === "image/webp" ? "webp" : "jpg";
    photoPath = `${plantId}/${recordId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("growth-snapshots").upload(photoPath, bytes, { contentType: acceptedPhoto.type, upsert: false });
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

  // Jamkachu's diary reply (display-only flavor text — never parsed for game
  // decisions): only when a photo was accepted and the record insert
  // succeeded. Runs BEFORE the /diary revalidate so the reply is already on
  // the record when the page re-renders, and the whole block is best-effort —
  // no failure here (AI timeout, missing milestone19 column, any query error)
  // may fail the submitted growth record. generatePhotoComment itself never
  // throws and never blocks longer than ~4s.
  if (acceptedPhoto && photoBytes) {
    try {
      const locale = await getRequestLocale();
      const { data: plantRow } = await supabase
        .from("plants")
        .select("name, personality")
        .eq("id", plantId)
        .maybeSingle();
      const snapshot = await getLatestSensorSnapshot(supabase, plantId);
      // Openings of recent replies, handed to the AI as "start differently".
      // Any error (including a missing ai_comment column) just means no
      // variety hint — tolerated as an empty list.
      let recentComments: string[] = [];
      try {
        const { data: recentRows, error: recentError } = await supabase
          .from("growth_records")
          .select("ai_comment")
          .eq("plant_id", plantId)
          .not("ai_comment", "is", null)
          .order("recorded_at", { ascending: false })
          .limit(3);
        if (!recentError && Array.isArray(recentRows)) {
          recentComments = recentRows
            .map((row) => (typeof row.ai_comment === "string" ? row.ai_comment : ""))
            .filter((comment) => comment.length > 0);
        }
      } catch {
        recentComments = [];
      }

      const { comment } = await generatePhotoComment({
        plantName: typeof plantRow?.name === "string" && plantRow.name.trim() ? plantRow.name : "Jamkachu",
        personality: normalizePersonality(plantRow?.personality),
        snapshot,
        locale,
        imageBase64: Buffer.from(photoBytes).toString("base64"),
        imageMimeType: acceptedPhoto.type,
        recordId,
        stage,
        note,
        heightCm,
        leafCount,
        recentComments,
      });

      const { error: commentError } = await supabase
        .from("growth_records")
        .update({ ai_comment: comment })
        .eq("id", recordId);
      if (commentError && !isMissingAiCommentColumn(commentError)) {
        console.error(`addGrowthRecord(${plantId}) ai_comment update failed:`, commentError.message);
      }
    } catch (error) {
      console.error(`addGrowthRecord(${plantId}) diary reply failed:`, error);
    }
  }

  // The add-record form now lives on /diary (Growth Records moved out of
  // Settings) — revalidate that route instead of /settings.
  revalidatePath("/diary");
}

/** milestone19 not applied: `growth_records.ai_comment` is missing — raw
 *  Postgres 42703 or a PostgREST schema-cache miss (PGRST204). Skipped
 *  silently: the record itself is already saved, the reply is optional. */
function isMissingAiCommentColumn(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /could not find the '.+' column/i.test(error.message) ||
    /column .+ does not exist/i.test(error.message) ||
    /ai_comment/i.test(error.message)
  );
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
