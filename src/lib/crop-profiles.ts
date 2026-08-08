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

const soybean: CropProfile = {
  key: "soybean", version: 1, displayName: "Soybean", scientificName: "Glycine max", species: "Soybean",
  varietyLabel: "Jember classroom candidate · variety unknown",
  guidanceNote: "Container advisory based on Indonesian land-suitability guidance; local variety calibration may differ.",
  timezone: CROP_PROFILE_TIMEZONE,
  temperature: { recommended: { min: 23, max: 25 }, tolerated: { min: 18, max: 32 }, overheating: { enterAtOrAbove: 33, recoverAtOrBelow: 30 } },
  airHumidity: { recommended: { min: 24, max: 80 }, dryAir: { enterBelow: 24, recoverAtOrAbove: 29 } },
  soilPh: { recommended: { min: 5.5, max: 7.5 } },
  light: { sensorType: "binary-ldr", requiredDuringLightingHours: 1, lightingHours: { start: 6, end: 18 } },
};

const cayennePepper: CropProfile = {
  key: "cayenne-pepper", version: 1, displayName: "Cayenne pepper", scientificName: "Capsicum frutescens", species: "Cayenne Pepper",
  varietyLabel: "Jember classroom candidate · variety unknown",
  guidanceNote: "Classroom-pot advisory based on Indonesian cultivation guidance; local variety calibration may differ.",
  timezone: CROP_PROFILE_TIMEZONE,
  temperature: { recommended: { min: 18, max: 30 }, tolerated: { min: 18, max: 30 }, overheating: { enterAtOrAbove: 31, recoverAtOrBelow: 29 } },
  airHumidity: { recommended: { min: 60, max: 80 }, dryAir: { enterBelow: 60, recoverAtOrAbove: 65 } },
  soilPh: { recommended: { min: 6, max: 7 } },
  light: { sensorType: "binary-ldr", requiredDuringLightingHours: 1, lightingHours: { start: 6, end: 18 } },
};

/** Only profiles with complete readings for every sensor in this kit are
 * selectable. Catalog-only crops remain in milestone10 until their missing
 * sensor evidence or classroom suitability is reviewed. */
export const CROP_PROFILES = { strawberry, soybean, "cayenne-pepper": cayennePepper } as const satisfies Record<string, CropProfile>;
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
