// Farmer wisdom (handoff §2: "We are not replacing traditional farming
// wisdom — we are translating it") — traditional heuristics paired with the
// sensor measurement that expresses the same observation, framed for the
// place the plant actually lives: Jember, East Java — volcanic soil, tropical
// humidity, shaded coffee slopes, and a sharp wet/dry season rhythm.
//
// TEAM TODO — INTEGRITY RULE, read before shipping:
// The §43 field interviews with Jember farmers have NOT been conducted yet.
// Every entry below is therefore a deliberately GENERIC traditional-farming
// heuristic — reworded for Jember's climate and crops, but with no named
// person attached and no claim of local authenticity. Do NOT attribute any
// saying to a real farmer until the team has recorded actual interviews.
// Once the §43 visits happen, replace these placeholder entries with real
// material (real saying, the farmer's consent, the matching sensor pairing)
// and update each `source` field accordingly.

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
      "When the midday air sits heavy on the valley, plants suffer even if the soil is wet.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Tropical lowland air turns hot and humid by midday. Once a closed room passes 32°C, still humid air stops leaves from cooling themselves: transpiration slows and heat stress builds even though water is available at the roots — until the room is vented.",
    sensorLink: {
      mood: "Overheating",
      metric: "air temperature (°C) + air humidity (%)",
      example:
        "“heavy midday air” ↔ temperature 34.2°C + humidity 85% — past the 32°C venting threshold",
    },
  },
  {
    id: "dry-lips-dry-leaves",
    saying:
      "If your own lips feel dry in the dry season, the leaves are feeling it too.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "In musim kemarau (the dry season), dry air and indoor fans pull moisture out of leaves faster than the roots can supply it — a high vapor pressure deficit. It is the air around the plant, not the soil, that causes this stress; it eases only once the air is humid again.",
    sensorLink: {
      mood: "DryAir",
      metric: "air humidity (%)",
      example:
        "“dry-season lips” ↔ air humidity 36%, below the 40% dry-air threshold (recovered at 45%)",
    },
  },
  {
    id: "coffee-shade-lesson",
    saying:
      "Shade trees over the coffee rows are planted with care — enough to soften the sun, never enough to starve the leaves.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "On the coffee slopes around Jember, shade is managed, not accidental: with too little light a plant cannot photosynthesize enough, so it spends its reserves stretching long, pale stems toward the nearest brightness. A windowsill herb needs its bright hours just as deliberately.",
    sensorLink: {
      mood: "Sleepy",
      metric: "light level (LDR bright/dark)",
      example:
        "“too much shade over the rows” ↔ light sensor reading dark for most of the afternoon",
    },
  },
  {
    id: "sour-soil-after-rains",
    saying: "Soil that smells sour after the rains has turned sour itself.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Volcanic soil is fertile, but heavy rainy-season leaching and poor drainage can push it acidic. A sharp, sour smell often goes with that shift — and below pH 6.0, acidity locks nutrients away from the roots no matter how rich the ground is.",
    sensorLink: {
      mood: "SoilAcidic",
      metric: "calibrated soil pH",
      example: "“smells sour after the rains” ↔ soil pH 5.2, below the 6.0–7.0 healthy range",
    },
  },
  {
    id: "pale-leaves-green-veins",
    saying:
      "Pale young leaves with green veins mean the food is in the soil but the plant cannot take it.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "Yellowing between green veins (chlorosis) on new leaves is a classic sign of iron lock-out in alkaline soil — common where hard tap water or over-liming pushes pH above 7.0. The nutrient is present but chemically unavailable to the roots.",
    sensorLink: {
      mood: "SoilAlkaline",
      metric: "calibrated soil pH",
      example:
        "“pale leaves, green veins” ↔ soil pH 7.8, above the 6.0–7.0 healthy range",
    },
  },
  {
    id: "water-before-the-heat",
    saying:
      "In the dry season, water in the cool of morning, before the sun takes its share.",
    source: PLACEHOLDER_SOURCE,
    translation:
      "During musim kemarau (the dry season), morning watering lets roots drink before midday heat drives evaporation and leaf stress. And when an afternoon reading passes 32°C, water alone is not enough — the room also needs venting so the leaves can cool.",
    sensorLink: {
      metric: "air temperature (°C)",
      example:
        "“before the sun takes its share” ↔ watering done before readings climb past the 32°C venting threshold",
    },
  },
];
