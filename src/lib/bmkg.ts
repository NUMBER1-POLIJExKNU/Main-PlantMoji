const BMKG_API_BASE = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
export const BMKG_ATTRIBUTION_URL = "https://data.bmkg.go.id/prakiraan-cuaca/";
export const DEFAULT_BMKG_ADM4 = "35.09.21.1005";
const DEFAULT_LOCATION = {
  village: "Tegalgede",
  district: "Sumbersari",
  regency: "Jember",
  province: "Jawa Timur",
  timezone: "Asia/Jakarta",
};

export interface BmkgWeatherContext {
  ok: true;
  source: "BMKG";
  attributionUrl: string;
  adminCode: string;
  location: typeof DEFAULT_LOCATION & { latitude: number | null; longitude: number | null };
  forecast: {
    temperatureC: number;
    humidityPct: number;
    weatherCode: number | null;
    descriptionId: string;
    descriptionEn: string;
    forecastAt: string;
    producedAt: string | null;
  };
  fetchedAt: string;
  stale: boolean;
  warning?: string;
}

export interface BmkgWeatherUnavailable {
  ok: false;
  source: "BMKG";
  attributionUrl: string;
  adminCode: string;
  location: typeof DEFAULT_LOCATION;
  fetchedAt: string;
  stale: true;
  error: string;
}

export type BmkgLocalContext = BmkgWeatherContext | BmkgWeatherUnavailable;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function forecastDate(item: Record<string, unknown>): Date | null {
  const candidates = [
    item.datetime,
    typeof item.utc_datetime === "string"
      ? `${item.utc_datetime.trim().replace(" ", "T").replace(/Z$/, "")}Z`
      : null,
    typeof item.local_datetime === "string"
      ? `${item.local_datetime.trim().replace(" ", "T")}+07:00`
      : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function parseBmkgForecast(
  payload: unknown,
  now: Date = new Date(),
  adminCode = DEFAULT_BMKG_ADM4,
): BmkgWeatherContext {
  if (Number.isNaN(now.getTime())) throw new Error("BMKG parser: invalid current date");
  const root = record(payload);
  if (!root) throw new Error("BMKG parser: response is not an object");
  const locationRaw = record(root.lokasi) ?? {};
  const data = Array.isArray(root.data) ? root.data : [];
  const firstData = record(data[0]);
  const groups = firstData && Array.isArray(firstData.cuaca) ? firstData.cuaca : [];
  const forecasts = groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map(record)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({ item, date: forecastDate(item) }))
    .filter((entry): entry is { item: Record<string, unknown>; date: Date } => entry.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (forecasts.length === 0) throw new Error("BMKG parser: no usable forecast entries");
  const chosen = forecasts.find((entry) => entry.date.getTime() >= now.getTime()) ?? forecasts.at(-1)!;
  const temperatureC = finiteNumber(chosen.item.t);
  const humidityPct = finiteNumber(chosen.item.hu);
  if (temperatureC === null || humidityPct === null) {
    throw new Error("BMKG parser: forecast is missing temperature or humidity");
  }

  const producedDate = typeof chosen.item.analysis_date === "string"
    ? new Date(chosen.item.analysis_date)
    : null;

  return {
    ok: true,
    source: "BMKG",
    attributionUrl: BMKG_ATTRIBUTION_URL,
    adminCode,
    location: {
      village: textValue(locationRaw.desa, DEFAULT_LOCATION.village),
      district: textValue(locationRaw.kecamatan, DEFAULT_LOCATION.district),
      regency: textValue(locationRaw.kotkab, DEFAULT_LOCATION.regency),
      province: textValue(locationRaw.provinsi, DEFAULT_LOCATION.province),
      timezone: textValue(locationRaw.timezone, DEFAULT_LOCATION.timezone),
      latitude: finiteNumber(locationRaw.lat),
      longitude: finiteNumber(locationRaw.lon),
    },
    forecast: {
      temperatureC,
      humidityPct,
      weatherCode: finiteNumber(chosen.item.weather),
      descriptionId: textValue(chosen.item.weather_desc, "Prakiraan tersedia"),
      descriptionEn: textValue(chosen.item.weather_desc_en, "Forecast available"),
      forecastAt: chosen.date.toISOString(),
      producedAt:
        producedDate && !Number.isNaN(producedDate.getTime()) ? producedDate.toISOString() : null,
    },
    fetchedAt: now.toISOString(),
    stale: false,
  };
}

let lastGoodContext: BmkgWeatherContext | null = null;

/** Test isolation hook; production code never needs to clear last-good data. */
export function resetBmkgMemoryCacheForTests() {
  lastGoodContext = null;
}

export async function getBmkgLocalContext(now: Date = new Date()): Promise<BmkgLocalContext> {
  const adminCode = process.env.BMKG_ADM4_CODE?.trim() || DEFAULT_BMKG_ADM4;
  const fetchedAt = now.toISOString();
  try {
    const response = await fetch(`${BMKG_API_BASE}?adm4=${encodeURIComponent(adminCode)}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`BMKG HTTP ${response.status}`);
    const context = parseBmkgForecast(await response.json(), now, adminCode);
    lastGoodContext = context;
    return context;
  } catch (cause) {
    console.error("BMKG local context fetch failed:", cause);
    if (lastGoodContext) {
      return {
        ...lastGoodContext,
        fetchedAt,
        stale: true,
        warning: "BMKG is temporarily unavailable; showing the last successful forecast.",
      };
    }
    return {
      ok: false,
      source: "BMKG",
      attributionUrl: BMKG_ATTRIBUTION_URL,
      adminCode,
      location: DEFAULT_LOCATION,
      fetchedAt,
      stale: true,
      error: "BMKG forecast is temporarily unavailable.",
    };
  }
}
