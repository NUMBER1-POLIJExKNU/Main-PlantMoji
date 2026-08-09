// Camera growth photo diary — pure helpers (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Deliberately free of "server-only" and Supabase imports (same reasoning
// as src/lib/growth.ts's header): the server action does the I/O, these
// helpers stay unit-testable and importable from the client bundle (the
// capture component reuses MAX_PHOTO_BYTES for its pre-compression cap).

import { wibDate } from "@/game/quiz/daily-quiz";

/** MIME types the diary accepts. The canvas compressor always re-encodes
 *  to image/jpeg, but the raw <input type="file"> may hand us png/webp on
 *  devices whose camera app saves those formats. */
export const ALLOWED_PHOTO_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 5MB pre-compression cap (spec §Privacy) — checked client-side for fast
 *  feedback AND re-checked server-side (never trust the client). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The two fields of File/Blob that validation needs — kept structural so
 *  tests never have to construct a real File. */
export interface PhotoUploadCheck {
  type: string;
  size: number;
}

export type PhotoUploadValidation =
  | { ok: true }
  | { ok: false; error: "too_large" | "bad_type" };

export function validatePhotoUpload(file: PhotoUploadCheck): PhotoUploadValidation {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) return { ok: false, error: "bad_type" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "too_large" };
  return { ok: true };
}

/**
 * Storage object path: `<plant-id>/<wib-date>-<epoch-ms>.jpg`.
 * NEVER derived from user input beyond the validated plant id — paths must
 * never contain student names (spec §Privacy).
 */
export function photoStoragePath(plantId: string, now: Date = new Date()): string {
  return `${plantId}/${wibDate(now)}-${now.getTime()}.jpg`;
}

/**
 * Idempotency ledger key for the deterministic +1 Seed grant: the FIRST
 * photo of each WIB calendar day earns it, replays are no-ops in the
 * seed_rewards ledger (spec §Flow-6). WIB, never the device timezone.
 */
export function photoRewardKey(now: Date = new Date()): string {
  return `photo:${wibDate(now)}`;
}
