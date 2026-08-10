// Deterministic personality message templates (handoff §13, Phase 10).
//
// This module is the PERMANENT AI fallback layer (handoff §24): the later AI
// personality layer wraps these functions and falls back to them whenever the
// AI call fails, the network is down, or the AI response is invalid. Keep the
// exported API surface stable.
//
// Pure and deterministic — same input always produces the same output.
// No I/O, no randomness, no timers. Personality changes tone only, never the
// physical diagnosis (§13). DryAir is about AIR humidity from the DHT11 —
// never soil thirst (§3). Sleepy is about low light (§5).

import { normalizeMood } from "@/types/events";
import { normalizePersonality } from "@/types/game";
import type { PersonalityId, PlantMood } from "@/types/game";
import { dialogueForMood } from "./dialogue-bank";

// ── Mood messages: 5 personalities × 8 moods ────────────────────────────
// The five Overheating lines are VERBATIM from handoff §13.
// Record<PersonalityId, Record<PlantMood, string>> makes the compiler reject
// an incomplete matrix.

const MOOD_MESSAGES: Record<PersonalityId, Record<PlantMood, string>> = {
  cute: {
    Happy: "Yay! I feel just right today — thank you for taking care of me!",
    Overheating: "It’s too hot… please help me!",
    TooCold: "Brrr… it’s so cold… could you warm me up a little?",
    DryAir: "The air around me feels so dry… a little more humidity, please?",
    HumidAir: "The air feels so soggy around me… could we let it breathe a little?",
    Sleepy: "It’s so dark here… I’m getting sleepy. Could I have some light?",
    SoilAcidic: "My soil feels too sour… could you check its pH for me?",
    SoilAlkaline: "My soil doesn’t feel right… it’s too alkaline. Help me balance it?",
  },
  calm: {
    Happy: "All of my readings are within range. I am comfortable.",
    Overheating: "The temperature is above my preferred range.",
    TooCold: "The temperature is below my preferred range.",
    DryAir: "The air humidity is below my preferred range.",
    HumidAir: "The air humidity is above my preferred range.",
    Sleepy: "The light level is low. I will rest until it brightens.",
    SoilAcidic: "The soil pH is below my preferred range. It is too acidic.",
    SoilAlkaline: "The soil pH is above my preferred range. It is too alkaline.",
  },
  funny: {
    Happy: "Perfect conditions! I’d give you a high five, but… leaves.",
    Overheating: "I’m becoming plant soup!",
    TooCold: "I’m basically a plant popsicle over here! Warm me up?",
    DryAir: "This air is drier than my sense of humor! A little more humidity, please?",
    HumidAir: "It’s a sauna in here! My leaves can’t even sweat. Crack a window?",
    Sleepy: "Who turned off the sun? I can’t photosynthesize in the dark, you know.",
    SoilAcidic: "My soil thinks it’s a lemon! A pH check would be lovely.",
    SoilAlkaline: "My soil thinks it’s soap! Time to bring that pH back down.",
  },
  energetic: {
    Happy: "Feeling great! Best growing day ever — let’s go!",
    Overheating: "Too hot! Let’s cool down!",
    TooCold: "Too cold! Let’s warm things up!",
    DryAir: "Dry air alert! Let’s get some humidity in here!",
    HumidAir: "Humid air alert! Let’s get some fresh airflow going!",
    Sleepy: "It’s way too dark! Let’s power up with some light!",
    SoilAcidic: "Soil’s gone acidic! Let’s balance that pH — team effort!",
    SoilAlkaline: "Soil’s gone alkaline! Let’s balance that pH — we’ve got this!",
  },
  shy: {
    Happy: "Oh… I feel really nice today… thank you…",
    Overheating: "Um… could I have a little shade?",
    TooCold: "Um… I’m a bit cold… maybe somewhere warmer?",
    DryAir: "Um… the air feels a bit dry to me… maybe a little more humidity?",
    HumidAir: "Um… the air feels a bit heavy and damp… maybe a little airflow?",
    Sleepy: "It’s a little dark… um… could I have some light, please?",
    SoilAcidic: "Sorry to bother you… but I think my soil is a bit too acidic…",
    SoilAlkaline: "Um… my soil might be a little too alkaline… if you could check…",
  },
};

// ── Public API (stable — the AI layer wraps exactly this, handoff §24) ──

/**
 * Deterministic plant-voiced line for a sensor-derived mood.
 * Tolerates un-normalized runtime values (DB rows store personality as a raw
 * string; Node-RED sometimes sends label variants like "Dry Air").
 */
export function getMoodMessage(personality: PersonalityId, mood: PlantMood, seed?: string): string {
  const voice = MOOD_MESSAGES[normalizePersonality(personality)];
  const message: string | undefined = voice[normalizeMood(mood) ?? mood];
  if (seed && normalizeMood(mood)) return dialogueForMood(normalizeMood(mood)!, `${personality}|${seed}`);
  // Unreachable with typed callers; keeps a garbage cast from returning undefined.
  return message ?? "I’m not sure how I’m feeling right now…";
}
