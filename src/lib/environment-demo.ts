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
