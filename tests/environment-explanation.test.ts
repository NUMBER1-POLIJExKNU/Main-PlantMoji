import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeEnvironment, type EnvironmentCropProfile } from "@/lib/environment-analyzer";
import type { ExplorerCrop } from "@/lib/jember-crop-catalog";

const mocks = vi.hoisted(() => ({ generateAiMessage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({ generateAiMessage: mocks.generateAiMessage }));

import { explainCropMismatch, explainEnvironment } from "@/lib/environment-explanation";
import { getCropProfile } from "@/lib/crop-profiles";

const explorerCrop: ExplorerCrop = {
  key: "test-crop",
  displayName: "Test crop",
  scientificName: "Testus cropus",
  status: "draft",
  catalogOrder: 1,
  educationNote: "Educational reference.",
  limitations: [],
  reviewStatus: "draft",
  temperature: { min: 20, max: 30 },
  airHumidity: { min: 60, max: 80 },
  soilPh: { min: 5.5, max: 7 },
  light: { required: 1, evaluateNow: true },
};

describe("environment explanation fallback", () => {
  beforeEach(() => mocks.generateAiMessage.mockReset().mockResolvedValue(null));

  it("returns grounded Bahasa Indonesia copy when AI is unavailable", async () => {
    const profile = getCropProfile("strawberry");
    const text = await explainEnvironment(profile, null, {
      temperature: "Waiting", airHumidity: "Waiting", soilPh: "Waiting", light: "Waiting",
    }, "id");
    expect(text).toContain("Penganalisis aturan");
    expect(mocks.generateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ locale: "id" }));
  });

  it("keeps the deterministic mismatch and safe action in both locales", async () => {
    const analysis = analyzeEnvironment({ temperature: 35, humidity: 70, soilPh: 6, light: 1 }, explorerCrop as EnvironmentCropProfile);
    await expect(explainCropMismatch(explorerCrop, analysis, "en")).resolves.toContain("35 is above");
    await expect(explainCropMismatch(explorerCrop, analysis, "id")).resolves.toContain("tempat yang lebih teduh");
  });
});
