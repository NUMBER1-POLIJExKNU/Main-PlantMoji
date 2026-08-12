import { describe, expect, it } from "vitest";
import { CAMERA_COPY } from "@/app/camera/copy";
import { readFileSync } from "node:fs";

const guardian = readFileSync("src/components/camera-guardian.tsx", "utf8");
const cameraCss = readFileSync("src/app/camera/camera.css", "utf8");

// en/id parity + the load-bearing privacy and degradation promises of the
// Live Guardian copy (spec §/camera page). The typed Record already pins
// key parity at compile time; this guards content at runtime.

function leafPaths(node: unknown, prefix = "", out: string[] = []): string[] {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    for (const key of Object.keys(node)) {
      leafPaths((node as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

describe("CAMERA_COPY (Live Guardian)", () => {
  it("en and id expose the identical key tree with non-empty values", () => {
    expect(leafPaths(CAMERA_COPY.en).sort()).toEqual(leafPaths(CAMERA_COPY.id).sort());
    for (const locale of ["en", "id"] as const) {
      for (const [key, value] of Object.entries(CAMERA_COPY[locale])) {
        expect(String(value).trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("carries the privacy promise: video stays on-device, snapshot never stored", () => {
    expect(CAMERA_COPY.en.privacyLine1).toContain("never leaves");
    expect(CAMERA_COPY.en.privacyLine2).toContain("never stored");
    expect(CAMERA_COPY.id.privacyLine2).toContain("tanpa disimpan");
  });

  it("uses a compact camera label instead of promotional privacy copy", () => {
    expect(CAMERA_COPY.en.privacyTitle).toBe("Camera privacy");
    expect(CAMERA_COPY.id.privacyTitle).toBe("Privasi kamera");
  });

  it("keeps operator implementation details out of player-facing copy", () => {
    for (const locale of ["en", "id"] as const) {
      expect(CAMERA_COPY[locale].guardianOfflineNote).not.toContain("milestone");
      expect(CAMERA_COPY[locale].guardianOfflineNote).not.toContain("Supabase");
    }
  });

  it("labels limited watch mode without exposing environment configuration", () => {
    expect(CAMERA_COPY.en.motionOnlyLabel).toContain("movement");
    expect(CAMERA_COPY.id.motionOnlyLabel).toContain("gerakan");
    expect(CAMERA_COPY.en.motionOnlyLabel).not.toContain("API_KEY");
  });

  it("keeps the status chips scannable (emoji-led, spec: 👀 / ✋ / 🔍)", () => {
    for (const locale of ["en", "id"] as const) {
      expect(CAMERA_COPY[locale].statusWatching).toContain("👀");
      expect(CAMERA_COPY[locale].statusMotion).toContain("✋");
      expect(CAMERA_COPY[locale].statusChecking).toContain("🔍");
    }
  });

  it("keeps the event history secondary to the live camera", () => {
    expect(guardian).toContain('<details className="pm-cam-moments">');
    expect(guardian).toContain("<b>{feed.length}</b>");
  });

  it("does not repeat the live classification in a second status card", () => {
    expect(guardian).not.toContain("pm-cam-model");
    expect(guardian).not.toContain("JAMKACHU WATCH");
    expect(guardian).toContain("pm-cam-result");
  });

});
