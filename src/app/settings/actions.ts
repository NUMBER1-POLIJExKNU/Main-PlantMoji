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
import { randomUUID } from "node:crypto";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { parseGrowthInput } from "@/lib/growth";
import { getRequestLocale } from "@/lib/i18n-server";
import { generatePhotoComment } from "@/lib/photo-comment";
import { normalizeGrowthStage } from "@/lib/queries";
import { isMissingColumnError } from "@/lib/supabase-errors";
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
export interface GrowthRecordActionResult {
  ok: boolean;
  photoSaved: boolean;
}

export async function addGrowthRecord(formData: FormData): Promise<GrowthRecordActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, photoSaved: false };

  const parsed = parseGrowthInput({
    plantId: formData.get("plantId"),
    stage: formData.get("stage"),
    heightCm: formData.get("heightCm"),
    leafCount: formData.get("leafCount"),
    note: formData.get("note"),
  });
  if (!parsed.ok) {
    console.error(`addGrowthRecord rejected: ${parsed.error}`);
    return { ok: false, photoSaved: false };
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
    return { ok: false, photoSaved: false };
  }
  const photoRequired = formData.get("photoRequired") === "true";
  if (photoRequired && !acceptedPhoto) return { ok: false, photoSaved: false };
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
      if (photoRequired) return { ok: false, photoSaved: false };
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
    return { ok: false, photoSaved: false };
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
  return { ok: true, photoSaved: Boolean(photoPath) };
}

/** Form-compatible wrapper: React form actions must resolve to void, while
 *  Camera AI calls addGrowthRecord directly to show an honest save result. */
export async function addGrowthRecordFromForm(formData: FormData): Promise<void> {
  await addGrowthRecord(formData);
}

export interface DeleteGrowthPhotoResult {
  ok: boolean;
  error?: string;
}

/** Removes only the captured photo from a Growth Diary record. The written
 * growth note stays intact; the storage object is removed before its database
 * references are cleared so a failed storage operation cannot silently leave
 * the UI claiming the photo is gone. */
export async function deleteGrowthPhoto(
  recordId: string,
  plantId: string,
): Promise<DeleteGrowthPhotoResult> {
  const supabase = getServerSupabase();
  if (!supabase || !recordId || !plantId) return { ok: false, error: "Diary is unavailable." };

  const { data: record, error: readError } = await supabase
    .from("growth_records")
    .select("id, plant_id, photo_path")
    .eq("id", recordId)
    .eq("plant_id", plantId)
    .maybeSingle();
  if (readError || !record) return { ok: false, error: "Growth photo was not found." };

  if (record.photo_path) {
    const { error: storageError } = await supabase.storage
      .from("growth-snapshots")
      .remove([record.photo_path]);
    if (storageError) {
      console.error(`deleteGrowthPhoto(${recordId}) storage removal failed:`, storageError.message);
      return { ok: false, error: "The photo could not be deleted. Please try again." };
    }
  }

  const { error: pathError } = await supabase
    .from("growth_records")
    .update({ photo_path: null })
    .eq("id", recordId)
    .eq("plant_id", plantId);
  if (pathError) {
    console.error(`deleteGrowthPhoto(${recordId}) record cleanup failed:`, pathError.message);
    return { ok: false, error: "The photo reference could not be cleared. Please try again." };
  }

  // These columns belong to optional/legacy photo-diary migrations. Clear them
  // independently so an older schema cannot prevent photo_path cleanup.
  await clearOptionalGrowthPhotoColumn(supabase, recordId, plantId, "photo_url");
  await clearOptionalGrowthPhotoColumn(supabase, recordId, plantId, "ai_comment");
  revalidatePath("/diary");
  return { ok: true };
}

async function clearOptionalGrowthPhotoColumn(
  supabase: ReturnType<typeof getServerSupabase>,
  recordId: string,
  plantId: string,
  column: "photo_url" | "ai_comment",
) {
  if (!supabase) return;
  const { error } = await supabase
    .from("growth_records")
    .update({ [column]: null })
    .eq("id", recordId)
    .eq("plant_id", plantId);
  if (error && !isMissingColumnError(error)) {
    console.error(`deleteGrowthPhoto(${recordId}) ${column} cleanup failed:`, error.message);
  }
}

/** milestone19 not applied: `growth_records.ai_comment` is missing — raw
 *  Postgres 42703 or a PostgREST schema-cache miss (PGRST204). Skipped
 *  silently: the record itself is already saved, the reply is optional.
 *  The shared isMissingColumnError already covers both codes and both
 *  message shapes; the explicit code checks stay as this site's pinned
 *  contract, and any ai_comment mention is its extra safety net. */
function isMissingAiCommentColumn(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    isMissingColumnError(error) ||
    /ai_comment/i.test(error.message)
  );
}
