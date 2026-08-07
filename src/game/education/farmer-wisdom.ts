// Farmer wisdom (handoff §2: "We are not replacing traditional farming
// wisdom — we are translating it") — traditional heuristics paired with the
// sensor measurement that expresses the same observation.
//
// TEAM TODO — INTEGRITY RULE, read before shipping:
// The §43 field interviews with Jember farmers have NOT been conducted yet.
// Every entry below is therefore a deliberately GENERIC traditional-farming
// heuristic with no named person attached. Do NOT attribute any saying to a
// real farmer until the team has recorded actual interviews. Once the §43
// visits happen, replace these placeholder entries with real material
// (real saying, the farmer's consent, the matching sensor pairing) and
// update each `source` field accordingly.

import type { PlantMood } from "@/types/events";

export interface WisdomEntry {
  id: string;
  /** The traditional heuristic, phrased as a field saying. */
  saying: string;
  /** Attribution. Must keep the replacement marker until §43 interviews exist. */
  source: string;
  /** What the saying means in measurable plant-science terms. */
  translation: string;
  /** The sensor-side expression of the same observation. */
  sensorLink: {
    /** The mood this observation usually maps to, when there is one. */
    mood?: PlantMood;
    /** Which measurement captures it. */
    metric: string;
    /** A concrete "saying ↔ reading" pairing. */
    example: string;
  };
}

const PLACEHOLDER_SOURCE =
  "Traditional practice — to be replaced with Jember farmer interviews (handoff §43)";

export const FARMER_WISDOM: WisdomEntry[] = [
  {
    id: "heavy-air-at-midday",
    saying:
      "When the air feels heavy and hot at midday, the plants suffer even if the soil is wet.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Hot, humid, still air stops leaves from cooling themselves: transpiration slows and heat stress builds even though water is available at the roots.",
    sensorLink: {
      mood: "Overheating",
      metric: "air temperature (°C) + air humidity (%)",
      example: "“the air feels heavy and hot” ↔ temperature 34.2°C + humidity 85%",
    },
  },
  {
    id: "dry-lips-dry-leaves",
    saying: "If your own lips feel dry indoors, the leaves are feeling it too.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Dry air pulls moisture out of leaves faster than the roots can supply it — a high vapor pressure deficit. It is the air around the plant, not the soil, that causes this stress.",
    sensorLink: {
      mood: "DryAir",
      metric: "air humidity (%)",
      example: "“the room feels dry” ↔ air humidity 36%, below the 40% dry-air threshold",
    },
  },
  {
    id: "stretching-for-light",
    saying: "A stem that leans and stretches toward the window is asking for more light.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "In low light a plant cannot photosynthesize enough, so it spends its reserves growing long, pale stems toward the nearest light source.",
    sensorLink: {
      mood: "Sleepy",
      metric: "light level (LDR bright/dark)",
      example:
        "“it keeps leaning toward the window” ↔ light sensor reading dark for most of the afternoon",
    },
  },
  {
    id: "sour-soil-smell",
    saying: "Soil that smells sour after watering has turned sour itself.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "A sharp, sour smell often accompanies acidic, poorly drained soil. Acidity locks nutrients away from the roots no matter how much food is in the ground.",
    sensorLink: {
      mood: "SoilAcidic",
      metric: "calibrated soil pH",
      example: "“it smells sour” ↔ soil pH 5.2, below the 6.0–7.0 normal range",
    },
  },
  {
    id: "pale-leaves-green-veins",
    saying:
      "Pale young leaves with green veins at dawn mean the food is in the soil but the plant cannot take it.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Yellowing between green veins (chlorosis) on new leaves is a classic sign of iron lock-out in alkaline soil — the nutrient is present but chemically unavailable to the roots.",
    sensorLink: {
      mood: "SoilAlkaline",
      metric: "calibrated soil pH",
      example:
        "“new leaves look pale but the veins stay green” ↔ soil pH 7.8, above the 6.0–7.0 normal range",
    },
  },
];
