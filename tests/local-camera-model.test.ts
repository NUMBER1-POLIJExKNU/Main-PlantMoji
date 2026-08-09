import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMERA_MODEL_LABELS, CAMERA_MODEL_URL } from "@/lib/local-camera-model";

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
});
