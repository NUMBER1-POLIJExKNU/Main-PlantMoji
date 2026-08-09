import type { SensorSnapshot } from "@/lib/crop-profiles";

export type EnvironmentParameter = "temperature" | "airHumidity" | "light" | "soilPh";
export type EnvironmentConditionStatus = "match" | "mismatch" | "not_evaluated";
export type MismatchDirection = "low" | "high";

export interface EnvironmentRange { min: number | null; max: number | null }
export interface EnvironmentCropProfile {
  key: string;
  displayName: string;
  status: "active" | "draft" | "reference_only" | "retired";
  catalogOrder?: number | null;
  temperature: EnvironmentRange;
  airHumidity: EnvironmentRange;
  soilPh: EnvironmentRange;
  light: { required: 0 | 1 | null; evaluateNow: boolean };
}

export interface EnvironmentCondition {
  status: EnvironmentConditionStatus;
  current: number | null;
  preferredMin: number | null;
  preferredMax: number | null;
  direction: MismatchDirection | null;
}

export interface EnvironmentAnalysis {
  cropKey: string;
  cropName: string;
  profileStatus: EnvironmentCropProfile["status"];
  conditions: Record<EnvironmentParameter, EnvironmentCondition>;
  matchedConditions: number;
  evaluatedConditions: number;
  largestMismatch: { parameter: EnvironmentParameter; direction: MismatchDirection } | null;
  label: "excellent" | "good" | "partial" | "challenging" | "not_enough_data";
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rangeCondition(value: unknown, range: EnvironmentRange): EnvironmentCondition {
  const current = finite(value);
  const min = finite(range.min);
  const max = finite(range.max);
  if (current === null || (min === null && max === null)) return { status: "not_evaluated", current, preferredMin: min, preferredMax: max, direction: null };
  if (min !== null && current < min) return { status: "mismatch", current, preferredMin: min, preferredMax: max, direction: "low" };
  if (max !== null && current > max) return { status: "mismatch", current, preferredMin: min, preferredMax: max, direction: "high" };
  return { status: "match", current, preferredMin: min, preferredMax: max, direction: null };
}

function mismatchDistance(condition: EnvironmentCondition): number {
  if (condition.status !== "mismatch" || condition.current === null) return -1;
  const boundary = condition.direction === "low" ? condition.preferredMin : condition.preferredMax;
  if (boundary === null) return -1;
  const span = condition.preferredMin !== null && condition.preferredMax !== null
    ? Math.max(condition.preferredMax - condition.preferredMin, 1)
    : Math.max(Math.abs(boundary), 1);
  return Math.abs(condition.current - boundary) / span;
}

export function analyzeEnvironment(snapshot: SensorSnapshot | null, profile: EnvironmentCropProfile): EnvironmentAnalysis {
  const conditions: EnvironmentAnalysis["conditions"] = {
    temperature: rangeCondition(snapshot?.temperature, profile.temperature),
    airHumidity: rangeCondition(snapshot?.humidity, profile.airHumidity),
    soilPh: rangeCondition(snapshot?.soilPh, profile.soilPh),
    light: !profile.light.evaluateNow || profile.light.required === null
      ? { status: "not_evaluated", current: finite(snapshot?.light), preferredMin: null, preferredMax: null, direction: null }
      : rangeCondition(snapshot?.light, { min: profile.light.required, max: profile.light.required }),
  };
  const entries = Object.entries(conditions) as Array<[EnvironmentParameter, EnvironmentCondition]>;
  const evaluatedConditions = entries.filter(([, item]) => item.status !== "not_evaluated").length;
  const matchedConditions = entries.filter(([, item]) => item.status === "match").length;
  const largest = entries.filter(([, item]) => item.status === "mismatch").sort((a, b) => mismatchDistance(b[1]) - mismatchDistance(a[1]) || a[0].localeCompare(b[0]))[0];
  const ratio = evaluatedConditions ? matchedConditions / evaluatedConditions : 0;
  const label = evaluatedConditions === 0 ? "not_enough_data" : ratio === 1 ? "excellent" : ratio >= 0.75 ? "good" : ratio >= 0.5 ? "partial" : "challenging";
  return {
    cropKey: profile.key, cropName: profile.displayName, profileStatus: profile.status,
    conditions, matchedConditions, evaluatedConditions,
    largestMismatch: largest ? { parameter: largest[0], direction: largest[1].direction! } : null,
    label,
  };
}

export function compareEnvironmentToCrops(snapshot: SensorSnapshot | null, profiles: EnvironmentCropProfile[]) {
  return profiles.map((profile) => analyzeEnvironment(snapshot, profile)).sort((a, b) =>
    b.matchedConditions - a.matchedConditions || b.evaluatedConditions - a.evaluatedConditions ||
    ((profiles.find((p) => p.key === a.cropKey)?.catalogOrder ?? Number.MAX_SAFE_INTEGER) -
      (profiles.find((p) => p.key === b.cropKey)?.catalogOrder ?? Number.MAX_SAFE_INTEGER)) ||
    a.cropKey.localeCompare(b.cropKey),
  );
}
