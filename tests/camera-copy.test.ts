import { describe, expect, it } from "vitest";
import { CAMERA_COPY } from "@/app/camera/copy";

describe("camera page copy (en/id parity)", () => {
  it("has identical key sets in both locales", () => {
    expect(Object.keys(CAMERA_COPY.en).sort()).toEqual(Object.keys(CAMERA_COPY.id).sort());
  });

  it("every string is non-empty in both locales", () => {
    for (const locale of ["en", "id"] as const) {
      for (const [key, value] of Object.entries(CAMERA_COPY[locale])) {
        expect(value.trim().length, `${locale}.${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("carries the plant-only privacy instruction in both locales", () => {
    expect(CAMERA_COPY.id.privacyPlantOnly).toContain("tanaman");
    expect(CAMERA_COPY.en.privacyPlantOnly.toLowerCase()).toContain("plant");
  });
});
