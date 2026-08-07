export const DEFAULT_CROP_PROFILE_KEY = "strawberry" as const;
export const CROP_PROFILE_TIMEZONE = "Asia/Jakarta";

export interface CropProfile {
  key: string;
  version: number;
  displayName: string;
  scientificName: string;
  species: string;
  varietyLabel: string;
  guidanceNote: string;
  timezone: string;
  temperature: {
    recommended: { min: number; max: number };
    tolerated: { min: number; max: number };
    overheating: { enterAtOrAbove: number; recoverAtOrBelow: number };
  };
  airHumidity: {
    recommended: { min: number; max: number };
    dryAir: { enterBelow: number; recoverAtOrAbove: number };
  };
  soilPh: { recommended: { min: number; max: number } };
  light: {
    sensorType: "binary-ldr";
    requiredDuringLightingHours: 1;
    lightingHours: { start: number; end: number };
  };
}

const strawberry: CropProfile = {
  key: "strawberry",
  version: 1,
  displayName: "Strawberry",
  scientificName: "Fragaria × ananassa",
  species: "Strawberry",
  varietyLabel: "Common strawberry · variety unknown",
  guidanceNote: "General guidance based on greenhouse strawberry references; individual varieties may differ.",
  timezone: CROP_PROFILE_TIMEZONE,
  temperature: {
    recommended: { min: 20, max: 24 },
    tolerated: { min: 15, max: 27 },
    overheating: { enterAtOrAbove: 28, recoverAtOrBelow: 26 },
  },
  airHumidity: {
    recommended: { min: 40, max: 60 },
    dryAir: { enterBelow: 40, recoverAtOrAbove: 45 },
  },
  soilPh: { recommended: { min: 5.5, max: 6.5 } },
  light: {
    sensorType: "binary-ldr",
    requiredDuringLightingHours: 1,
    lightingHours: { start: 6, end: 18 },
  },
};

export const CROP_PROFILES = { strawberry } as const satisfies Record<string, CropProfile>;
export type CropProfileKey = keyof typeof CROP_PROFILES;

export function isCropProfileKey(value: unknown): value is CropProfileKey {
  return typeof value === "string" && Object.hasOwn(CROP_PROFILES, value);
}

export function getCropProfile(value: unknown): CropProfile {
  return isCropProfileKey(value) ? CROP_PROFILES[value] : CROP_PROFILES[DEFAULT_CROP_PROFILE_KEY];
}

export type AdvisoryStatus = "Optimal" | "Low" | "High" | "Waiting";

export interface SensorSnapshot {
  temperature: number | null;
  humidity: number | null;
  soilPh: number | null;
  light: number | null;
  recordedAt?: string | null;
}

function rangeStatus(value: number | null, min: number, max: number): AdvisoryStatus {
  if (value == null || !Number.isFinite(value)) return "Waiting";
  if (value < min) return "Low";
  if (value > max) return "High";
  return "Optimal";
}

export function evaluateCropEnvironment(
  snapshot: SensorSnapshot | null,
  profile: CropProfile = strawberry,
  duringLightingHours = true,
) {
  return {
    temperature: rangeStatus(snapshot?.temperature ?? null, profile.temperature.tolerated.min, profile.temperature.tolerated.max),
    airHumidity: rangeStatus(snapshot?.humidity ?? null, profile.airHumidity.recommended.min, profile.airHumidity.recommended.max),
    soilPh: rangeStatus(snapshot?.soilPh ?? null, profile.soilPh.recommended.min, profile.soilPh.recommended.max),
    light:
      snapshot?.light == null || !Number.isFinite(snapshot.light)
        ? "Waiting"
        : !duringLightingHours || snapshot.light === profile.light.requiredDuringLightingHours
          ? "Optimal"
          : "Low",
  } satisfies Record<string, AdvisoryStatus>;
}

export function toDeviceCropProfile(profile: CropProfile) {
  return {
    key: profile.key,
    version: profile.version,
    plantName: profile.displayName,
    timezone: profile.timezone,
    temperature: profile.temperature,
    airHumidity: profile.airHumidity,
    soilPh: profile.soilPh,
    light: profile.light,
  };
}
