import type { SensorSnapshot } from "@/lib/crop-profiles";

/** Presentation-only snapshot for developing the explorer without hardware.
 * It is never persisted and never enters mood, quest, XP, or device logic. */
export const ENVIRONMENT_DEMO_SNAPSHOT: SensorSnapshot = {
  temperature: 31.2,
  humidity: 70,
  light: 65,
  soilPh: 5.2,
  recordedAt: null,
};

export const ENVIRONMENT_DEMO_PRESETS = {
  healthy: { temperature: 24, humidity: 70, light: 65, soilPh: 6.2, recordedAt: null },
  hot: { temperature: 35, humidity: 68, light: 82, soilPh: 6.2, recordedAt: null },
  dry: { temperature: 29, humidity: 38, light: 64, soilPh: 6.2, recordedAt: null },
  dark: { temperature: 25, humidity: 72, light: 18, soilPh: 6.2, recordedAt: null },
} satisfies Record<string, SensorSnapshot>;
export type EnvironmentDemoPreset = keyof typeof ENVIRONMENT_DEMO_PRESETS;

export function getEnvironmentDemoPreset(value: unknown): SensorSnapshot {
  return typeof value === "string" && value in ENVIRONMENT_DEMO_PRESETS
    ? ENVIRONMENT_DEMO_PRESETS[value as EnvironmentDemoPreset]
    : ENVIRONMENT_DEMO_SNAPSHOT;
}
