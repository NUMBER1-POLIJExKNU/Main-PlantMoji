import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("/camera route", () => {
  it("exists, uses the shared page header, and probes the storage bucket server-side", () => {
    const page = source("src/app/camera/page.tsx");
    expect(page).toContain("<PageHeader");
    expect(page).toContain('from("plant-photos")');
    expect(page).toContain("force-dynamic");
  });

  it("captures via file input (no getUserMedia in MVP) and compresses on canvas", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain('"use client"');
    expect(capture).toContain('accept="image/*"');
    expect(capture).toContain('capture="environment"');
    expect(capture).toContain("1280");
    expect(capture).toContain("0.8");
    expect(capture).not.toContain("getUserMedia");
  });

  it("shows privacy copy and a retry path, and disables capture when the bucket is missing", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain("privacyPlantOnly");
    expect(capture).toContain("retryButton");
    expect(capture).toContain("bucketReady");
    expect(capture).toContain("notReadyBody");
  });
});
