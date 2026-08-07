// Educational "why" layer (handoff §2, §51) — the game must TEACH, not just
// reward. Every mood gets a short, accurate plant-science explanation so the
// loop reads: measure → understand → act → verify → improve.
//
// Safety rule (handoff §16): NEVER include chemical dosing instructions.
// Soil guidance stays at gentle everyday care (plain-water rinse, fresh
// potting soil) — the same limits as the quest catalog.
//
// All text is user-facing and must stay in English.

import type { PlantMood } from "@/types/events";
import type { QuestKey } from "@/types/game";

export interface WhyCard {
  /** Short, friendly headline for the science behind the mood. */
  title: string;
  /** 2–3 sentences of plant science: what is physically happening. */
  why: string;
  /** What a carer can actually do about it. No chemical dosing, ever. */
  action: string;
}

export const WHY_CARDS: Record<PlantMood, WhyCard> = {
  Happy: {
    title: "In the Comfort Zone",
    why:
      "“Happy” means every reading sits inside the plant’s profile: air below the heat threshold, comfortable air humidity, light available, and soil pH in the 6.0–7.0 range. Inside that window photosynthesis, water transport, and nutrient uptake all run at full speed.",
    action:
      "Keep conditions steady. Stability over time helps a plant far more than short bursts of perfect care.",
  },
  Overheating: {
    title: "Too Hot to Work",
    why:
      "Above roughly 32°C, basil-class herbs lose water through their leaves faster than the roots can replace it, so the leaves wilt to reduce exposure. Sustained heat also slows the enzymes that drive photosynthesis, so the plant stops growing while it fights to stay cool.",
    action:
      "Add shade, move the plant away from hot glass, or improve airflow — then let the sensor confirm the air actually cooled and stayed cool.",
  },
  DryAir: {
    title: "Thirsty Air, Not Thirsty Soil",
    why:
      "This mood is about AIR humidity, never soil moisture. Dry air creates a high vapor pressure deficit (VPD) that pulls water out of the leaves faster than normal, so a plant can be stressed even when its soil is moist.",
    action:
      "Raise the humidity around the leaves: mist gently, group plants together, or move the pot away from fans, heaters, and air-conditioning drafts.",
  },
  Sleepy: {
    title: "No Light, No Lunch",
    why:
      "Photosynthesis is light-dependent: without enough light the plant cannot make sugar, so it idles and lives off its reserves. Long dark stretches during the day lead to slow growth and pale, stretched stems reaching for the nearest light.",
    action:
      "Move the plant to a brighter spot or restore its light source, and keep the light steady.",
  },
  SoilAcidic: {
    title: "Sour Soil Locks the Pantry",
    why:
      "Soil pH gates which nutrients dissolve into a form roots can absorb. When pH drops below the normal range, phosphorus, calcium, and magnesium become less available while aluminum and manganese can build up to stressful levels — the food is in the soil, but chemically locked away.",
    action:
      "Gentle care only: rinse the soil with plain water or mix in fresh potting soil, then re-check the reading. Never add strong chemicals.",
  },
  SoilAlkaline: {
    title: "Chalky Soil Hides the Iron",
    why:
      "When pH rises above the normal range, iron and other micronutrients turn insoluble, so roots cannot absorb them even from fertile soil. The classic sign is new leaves fading to pale yellow while their veins stay green (chlorosis).",
    action:
      "Gentle care only: rinse with plain water or blend in fresh potting mix, then re-check the reading. Never add strong chemicals.",
  },
};

/** One sentence per quest linking the asked-for action to the science. */
export const QUEST_WHY: Record<QuestKey, string> = {
  KEEP_ME_HAPPY:
    "Holding every reading in range for 30 straight minutes proves the environment is genuinely stable — plants grow on steady conditions, not on one lucky sample.",
  COOL_ME_DOWN:
    "Cooling the air lets the leaves stop emergency water loss and reopen their pores, so water transport and photosynthesis can restart.",
  GIVE_ME_MORE_LIGHT:
    "Light is the energy source of photosynthesis — restoring it lets the plant make food again instead of idling on its reserves.",
  BALANCE_SOIL_ACIDIC:
    "Bringing pH back toward the 6.0–7.0 range unlocks the phosphorus, calcium, and magnesium that acidic soil keeps chemically out of the roots’ reach.",
  BALANCE_SOIL_ALKALINE:
    "Lowering pH back toward the normal range makes iron and other micronutrients soluble again, so the roots can actually absorb them.",
};
