import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BMKG_ADM4,
  getBmkgLocalContext,
  parseBmkgForecast,
  resetBmkgMemoryCacheForTests,
} from "@/lib/bmkg";

const PAYLOAD = {
  lokasi: {
    provinsi: "Jawa Timur",
    kotkab: "Jember",
    kecamatan: "Sumbersari",
    desa: "Tegalgede",
    lon: 113.7267,
    lat: -8.1561,
    timezone: "Asia/Jakarta",
  },
  data: [
    {
      cuaca: [
        [
          {
            datetime: "2026-08-07T03:00:00Z",
            t: 25,
            hu: 80,
            weather: 1,
            weather_desc: "Cerah Berawan",
            weather_desc_en: "Partly Cloudy",
          },
        ],
        [
          {
            datetime: "2026-08-07T06:00:00Z",
            t: "27",
            hu: "72",
            weather: 3,
            weather_desc: "Berawan",
            weather_desc_en: "Cloudy",
          },
        ],
      ],
    },
  ],
};

describe("BMKG forecast parser", () => {
  beforeEach(() => resetBmkgMemoryCacheForTests());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("flattens forecast groups and selects the next forecast", () => {
    const result = parseBmkgForecast(PAYLOAD, new Date("2026-08-07T04:00:00Z"));
    expect(result.adminCode).toBe(DEFAULT_BMKG_ADM4);
    expect(result.location.village).toBe("Tegalgede");
    expect(result.forecast.temperatureC).toBe(27);
    expect(result.forecast.humidityPct).toBe(72);
    expect(result.forecast.forecastAt).toBe("2026-08-07T06:00:00.000Z");
  });

  it("uses the latest entry when every forecast is in the past", () => {
    const result = parseBmkgForecast(PAYLOAD, new Date("2026-08-08T00:00:00Z"));
    expect(result.forecast.descriptionId).toBe("Berawan");
  });

  it("rejects malformed or incomplete responses", () => {
    expect(() => parseBmkgForecast({ data: [] })).toThrow(/no usable forecast/i);
    expect(() =>
      parseBmkgForecast({ data: [{ cuaca: [[{ datetime: "2026-08-07T06:00:00Z", t: 25 }]] }] }),
    ).toThrow(/temperature or humidity/i);
  });

  it("returns the last successful forecast as stale after a temporary failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(PAYLOAD), { status: 200 }))
        .mockRejectedValueOnce(new Error("network down")),
    );

    const first = await getBmkgLocalContext(new Date("2026-08-07T04:00:00Z"));
    const fallback = await getBmkgLocalContext(new Date("2026-08-07T04:30:00Z"));
    expect(first.ok).toBe(true);
    expect(fallback.ok).toBe(true);
    expect(fallback.stale).toBe(true);
    if (fallback.ok) expect(fallback.forecast.temperatureC).toBe(27);
  });

  it("returns an explicit unavailable state on a cold-start failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await getBmkgLocalContext(new Date("2026-08-07T04:00:00Z"));
    expect(result).toMatchObject({ ok: false, source: "BMKG", stale: true });
  });
});
