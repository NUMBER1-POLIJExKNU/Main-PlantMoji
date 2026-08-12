import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMERA_METADATA_URL, CAMERA_MODEL_LABELS, CAMERA_MODEL_URL } from "@/lib/local-camera-model";

describe("existing Teachable Machine camera model", () => {
  it("ships the original model and labels", () => {
    expect(CAMERA_MODEL_URL).toBe("/camera-ai-model/model.json");
    expect(CAMERA_MODEL_LABELS).toEqual(["Safe Environment", "Foreign Environment"]);
    expect(readFileSync("public/camera-ai-model/model.json").length).toBeGreaterThan(1_000);
    expect(readFileSync("public/camera-ai-model/weights.bin").length).toBeGreaterThan(1_000_000);
  });

  it("keeps model output advisory and local", () => {
    const source = readFileSync("src/components/camera-guardian.tsx", "utf8");
    expect(source).toContain('import("@/lib/local-camera-model")');
    expect(source).toContain("Model classification only · not sensor truth");
  });

  it("keeps the shipped metadata agreeing with the label constants", () => {
    expect(CAMERA_METADATA_URL).toBe("/camera-ai-model/metadata.json");
    const metadata = JSON.parse(readFileSync("public/camera-ai-model/metadata.json", "utf8"));
    // classifyCameraFrame reads class ORDER from this file while the union type
    // and every downstream string comparison come from CAMERA_MODEL_LABELS. A
    // re-export that renames or reorders the classes has to fail here rather
    // than mislabel a foreign environment as safe in the UI.
    expect(metadata.labels).toEqual([...CAMERA_MODEL_LABELS]);
    expect(metadata.imageSize).toBe(224);
  });

  it("gates every alert surface on the confidence-aware view", () => {
    const source = readFileSync("src/components/camera-guardian.tsx", "utf8");
    const derivation = source.match(/const resultView[\s\S]*?: "safe";/);
    expect(derivation).not.toBeNull();
    expect(derivation?.[0]).toContain("CONFIDENCE_FLOOR");
    // The derivation above is the ONLY place allowed to read the raw label.
    // Panel colour, mascot alert, emoji and Jamkachu's line all go through
    // isForeign, so a low-confidence frame cannot alarm in red underneath an
    // "Analyzing…" headline, and a failed load cannot keep the last alert.
    expect(source.split('localLabel === "Foreign Environment"').length - 1).toBe(1);
    expect(source.split("isForeign").length - 1).toBeGreaterThanOrEqual(4);
  });
});
