import { describe, expect, it } from "vitest";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  photoRewardKey,
  photoStoragePath,
  validatePhotoUpload,
} from "@/lib/photo-diary";

describe("validatePhotoUpload", () => {
  it("accepts a normal JPEG under the cap", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts every allowed MIME type", () => {
    for (const type of ALLOWED_PHOTO_MIME_TYPES) {
      expect(validatePhotoUpload({ type, size: 10 })).toEqual({ ok: true });
    }
  });

  it("rejects files over 5MB with too_large", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("accepts a file at exactly the 5MB cap", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: MAX_PHOTO_BYTES })).toEqual({ ok: true });
  });

  it("rejects non-image MIME types with bad_type", () => {
    for (const type of ["application/pdf", "text/html", "video/mp4", "image/svg+xml", ""]) {
      expect(validatePhotoUpload({ type, size: 10 })).toEqual({ ok: false, error: "bad_type" });
    }
  });
});

describe("photoRewardKey — WIB, not device timezone", () => {
  it("uses the WIB calendar date", () => {
    // 2026-08-09T18:00Z is already 2026-08-10 01:00 in WIB (UTC+7).
    expect(photoRewardKey(new Date("2026-08-09T18:00:00.000Z"))).toBe("photo:2026-08-10");
  });

  it("stays on the same WIB day just before WIB midnight", () => {
    // 2026-08-09T16:59Z = 2026-08-09 23:59 WIB.
    expect(photoRewardKey(new Date("2026-08-09T16:59:00.000Z"))).toBe("photo:2026-08-09");
  });
});

describe("photoStoragePath", () => {
  it("is <plantId>/<wib-date>-<epoch-ms>.jpg and never contains anything else", () => {
    const at = new Date("2026-08-09T03:00:00.000Z"); // 10:00 WIB
    expect(photoStoragePath("plant-01", at)).toBe(`plant-01/2026-08-09-${at.getTime()}.jpg`);
  });
});
