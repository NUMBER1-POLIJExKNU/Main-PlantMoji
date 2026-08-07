import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCropProfile } from "@/lib/crop-profiles";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  getPlantCropProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/lib/crop-profile-data", () => ({ getPlantCropProfile: mocks.getPlantCropProfile }));

import { GET } from "@/app/api/crop-profile/route";

describe("GET /api/crop-profile", () => {
  beforeEach(() => {
    delete process.env.DEVICE_API_TOKEN;
    mocks.getServerSupabase.mockReturnValue({});
    mocks.getPlantCropProfile.mockResolvedValue(getCropProfile("strawberry"));
  });

  afterEach(() => vi.clearAllMocks());

  it("returns the normalized device contract", async () => {
    const response = await GET(new Request("http://localhost/api/crop-profile?plantId=plant-01"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      plantId: "plant-01",
      profile: {
        key: "strawberry",
        version: 1,
        timezone: "Asia/Jakarta",
        temperature: { overheating: { enterAtOrAbove: 28, recoverAtOrBelow: 26 } },
        airHumidity: { dryAir: { enterBelow: 40, recoverAtOrAbove: 45 } },
        soilPh: { recommended: { min: 5.5, max: 6.5 } },
      },
    });
  });

  it("enforces bearer auth only when DEVICE_API_TOKEN is configured", async () => {
    process.env.DEVICE_API_TOKEN = "device-secret";
    const denied = await GET(new Request("http://localhost/api/crop-profile"));
    expect(denied.status).toBe(401);
    const allowed = await GET(new Request("http://localhost/api/crop-profile", { headers: { authorization: "Bearer device-secret" } }));
    expect(allowed.status).toBe(200);
  });

  it("returns 404 for an unknown plant", async () => {
    mocks.getPlantCropProfile.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/crop-profile?plantId=missing"));
    expect(response.status).toBe(404);
  });
});
