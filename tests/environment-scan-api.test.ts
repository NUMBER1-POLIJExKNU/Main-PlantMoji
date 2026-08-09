import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  getLatestSensorSnapshot: vi.fn(),
  getJemberCropCatalog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/lib/crop-profile-data", () => ({ getLatestSensorSnapshot: mocks.getLatestSensorSnapshot }));
vi.mock("@/lib/jember-crop-catalog", () => ({ getJemberCropCatalog: mocks.getJemberCropCatalog }));

import { GET } from "@/app/api/environment-scan/route";

describe("GET /api/environment-scan demo mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue({});
    mocks.getJemberCropCatalog.mockResolvedValue([{
      key: "demo-crop", displayName: "Demo crop", status: "draft", catalogOrder: 1,
      temperature: { min: 20, max: 30 }, airHumidity: { min: 60, max: 80 },
      soilPh: { min: 5.5, max: 7 }, light: { required: 1, evaluateNow: true },
    }]);
  });

  it("uses visibly labeled virtual data without reading or storing a sensor sample", async () => {
    const response = await GET(new Request("http://localhost/api/environment-scan?demo=1&locale=en"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, source: "demo", snapshot: { temperature: 31.2, humidity: 70, light: 1, soilPh: 5.2 } });
    expect(body.results[0]).toMatchObject({ cropKey: "demo-crop", matchedConditions: 2, evaluatedConditions: 4 });
    expect(mocks.getLatestSensorSnapshot).not.toHaveBeenCalled();
  });
});
