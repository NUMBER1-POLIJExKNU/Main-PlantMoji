"use server";

// Camera photo diary server action (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md §Flow).
//
// Order of operations is the error-handling contract:
//   validate (never trust the client) → Storage upload → AI/template
//   comment → growth_records insert → deterministic +1 Seed grant.
// No record row is created until the upload succeeded (no dangling URLs),
// and a Seed-grant failure NEVER fails the action (milestone18 may simply
// not be applied yet — graceful skip, spec §Data).

import { revalidatePath } from "next/cache";
import { awardSeeds } from "@/game/economy/seed-engine";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { normalizeLocale } from "@/lib/i18n";
import { generatePhotoComment } from "@/lib/photo-comment";
import {
  photoRewardKey,
  photoStoragePath,
  validatePhotoUpload,
} from "@/lib/photo-diary";
import { getPlant, normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizePersonality } from "@/types/game";

export interface CameraActionState {
  status: "idle" | "success" | "invalid" | "not-ready" | "error";
  error: "too_large" | "bad_type" | "upload_failed" | null;
  photoUrl: string | null;
  aiComment: string | null;
  seedGranted: boolean;
}

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/; // same rule as /api/daily-quiz

/** Storage/PostgREST messages that mean "milestone19 not applied here". */
function isMigrationMissing(message: string): boolean {
  return /bucket not found|photo_url|ai_comment|PGRST204/i.test(message);
}

export async function uploadPlantPhoto(
  _previousState: CameraActionState,
  formData: FormData,
): Promise<CameraActionState> {
  const fail = (
    status: CameraActionState["status"],
    error: CameraActionState["error"] = null,
  ): CameraActionState => ({ status, error, photoUrl: null, aiComment: null, seedGranted: false });

  const supabase = getServerSupabase();
  if (!supabase) return fail("not-ready");

  const rawPlantId = formData.get("plantId");
  const plantId =
    typeof rawPlantId === "string" && VALID_PLANT.test(rawPlantId) ? rawPlantId : "plant-01";
  const locale = normalizeLocale(formData.get("locale"));

  // ── Server-side re-validation (spec §Privacy: never trust the client) ──
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("invalid", "bad_type");
  const validation = validatePhotoUpload({ type: file.type, size: file.size });
  if (!validation.ok) return fail("invalid", validation.error);

  const plantResult = await getPlant(supabase, plantId);
  if (plantResult.status === "no-schema") return fail("not-ready");
  if (plantResult.status !== "ok") return fail("error", "upload_failed");
  const plant = plantResult.plant;

  // ── Storage upload — path never contains a student name ────────────────
  const now = new Date();
  const objectPath = photoStoragePath(plantId, now);
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage
    .from("plant-photos")
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) {
    if (isMigrationMissing(upload.error.message)) return fail("not-ready");
    console.error(`uploadPlantPhoto(${plantId}) storage upload failed:`, upload.error.message);
    return fail("error", "upload_failed");
  }
  const photoUrl = supabase.storage.from("plant-photos").getPublicUrl(objectPath).data.publicUrl;

  // ── Comment layer: Gemini Vision or deterministic sensor template ──────
  // The comment is flavor text only — never parsed for game decisions.
  const snapshot = await getLatestSensorSnapshot(supabase, plantId);
  const { comment } = await generatePhotoComment({
    plantName: plant.name,
    personality: normalizePersonality(plant.personality),
    snapshot,
    locale,
    imageBase64: bytes.toString("base64"),
    imageMimeType: file.type,
  });

  // ── Diary row: the photo diary IS the growth diary ─────────────────────
  // Reuses the plant's current manual stage — a photo is an observation,
  // not a stage change (Growth Stage stays record/manual-driven, §14).
  const stage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";
  const insert = await supabase.from("growth_records").insert({
    plant_id: plantId,
    stage,
    height_cm: null,
    leaf_count: null,
    note: null,
    photo_url: photoUrl,
    ai_comment: comment,
  });
  if (insert.error) {
    if (isMigrationMissing(insert.error.message)) return fail("not-ready");
    console.error(`uploadPlantPhoto(${plantId}) record insert failed:`, insert.error.message);
    return fail("error", "upload_failed");
  }

  // ── Deterministic +1 Seed for the FIRST photo of the WIB day ───────────
  // Idempotent by ledger key (photo:<wib-date>). milestone18 absent →
  // awardSeeds reports missingMigration → we log and continue: the photo
  // save already succeeded, so a Seed-grant failure must never fail here.
  let seedGranted = false;
  try {
    const seed = await awardSeeds(supabase, plantId, photoRewardKey(now), 1, "photo");
    if (seed.missingMigration) {
      console.warn(`uploadPlantPhoto(${plantId}) seed grant skipped: milestone18 not applied`);
    } else {
      seedGranted = seed.granted;
    }
  } catch (cause) {
    console.warn(`uploadPlantPhoto(${plantId}) seed grant skipped:`, cause);
  }

  revalidatePath("/diary");
  revalidatePath("/camera");
  return { status: "success", error: null, photoUrl, aiComment: comment, seedGranted };
}
