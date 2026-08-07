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
import type { BondEventType, PersonalityId, PlantMood } from "@/types/game";

// ── Types ───────────────────────────────────────────────────────────────

/** Bond events that produce a plant-voiced message. Derived from the shared
 *  BondEventType union so a contract drift becomes a compile error. */
export type MessageEventKind = Extract<
  BondEventType,
  "QUEST_CREATED" | "QUEST_COMPLETED" | "LEVEL_UP" | "BADGE_UNLOCKED" | "CHAPTER_UNLOCKED"
>;

export interface EventMessageParams {
  questTitle?: string;
  xp?: number;
  level?: number;
  badgeName?: string;
  chapterTitle?: string;
}

// ── Mood messages: 5 personalities × 6 moods ────────────────────────────
// The five Overheating lines are VERBATIM from handoff §13.
// Record<PersonalityId, Record<PlantMood, string>> makes the compiler reject
// an incomplete matrix.

const MOOD_MESSAGES: Record<PersonalityId, Record<PlantMood, string>> = {
  cute: {
    Happy: "Yay! I feel just right today — thank you for taking care of me!",
    Overheating: "It’s too hot… please help me!",
    DryAir: "The air around me feels so dry… a little more humidity, please?",
    Sleepy: "It’s so dark here… I’m getting sleepy. Could I have some light?",
    SoilAcidic: "My soil feels too sour… could you check its pH for me?",
    SoilAlkaline: "My soil doesn’t feel right… it’s too alkaline. Help me balance it?",
  },
  calm: {
    Happy: "All of my readings are within range. I am comfortable.",
    Overheating: "The temperature is above my preferred range.",
    DryAir: "The air humidity is below my preferred range.",
    Sleepy: "The light level is low. I will rest until it brightens.",
    SoilAcidic: "The soil pH is below my preferred range. It is too acidic.",
    SoilAlkaline: "The soil pH is above my preferred range. It is too alkaline.",
  },
  funny: {
    Happy: "Perfect conditions! I’d give you a high five, but… leaves.",
    Overheating: "I’m becoming plant soup!",
    DryAir: "This air is drier than my sense of humor! A little more humidity, please?",
    Sleepy: "Who turned off the sun? I can’t photosynthesize in the dark, you know.",
    SoilAcidic: "My soil thinks it’s a lemon! A pH check would be lovely.",
    SoilAlkaline: "My soil thinks it’s soap! Time to bring that pH back down.",
  },
  energetic: {
    Happy: "Feeling great! Best growing day ever — let’s go!",
    Overheating: "Too hot! Let’s cool down!",
    DryAir: "Dry air alert! Let’s get some humidity in here!",
    Sleepy: "It’s way too dark! Let’s power up with some light!",
    SoilAcidic: "Soil’s gone acidic! Let’s balance that pH — team effort!",
    SoilAlkaline: "Soil’s gone alkaline! Let’s balance that pH — we’ve got this!",
  },
  shy: {
    Happy: "Oh… I feel really nice today… thank you…",
    Overheating: "Um… could I have a little shade?",
    DryAir: "Um… the air feels a bit dry to me… maybe a little more humidity?",
    Sleepy: "It’s a little dark… um… could I have some light, please?",
    SoilAcidic: "Sorry to bother you… but I think my soil is a bit too acidic…",
    SoilAlkaline: "Um… my soil might be a little too alkaline… if you could check…",
  },
};

// ── Event messages: 5 personalities × 5 event kinds ─────────────────────

type EventTemplate = (params: EventMessageParams) => string;

/** Trimmed value, or null when absent/blank — keeps templates readable. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** “Quoted” title fragment, or a plain fallback phrase when absent. */
function quoted(value: string | undefined, fallbackText: string): string {
  const trimmed = present(value);
  return trimmed ? `“${trimmed}”` : fallbackText;
}

const EVENT_MESSAGES: Record<MessageEventKind, Record<PersonalityId, EventTemplate>> = {
  QUEST_CREATED: {
    cute: (p) => `A new quest just for us: ${quoted(p.questTitle, "a little surprise")}! Will you help me?`,
    calm: (p) => {
      const title = present(p.questTitle);
      return title ? `A new quest is available: ${title}.` : "A new quest is available.";
    },
    funny: (p) =>
      `Breaking news: ${quoted(p.questTitle, "a mystery quest")} just dropped. Accept before I wilt with anticipation!`,
    energetic: (p) => `New quest: ${quoted(p.questTitle, "a fresh challenge")}! Let’s do it right now!`,
    shy: (p) => `Um… there’s a new quest… ${quoted(p.questTitle, "if you’d like to look")}… only if you have time…`,
  },
  QUEST_COMPLETED: {
    cute: (p) => {
      const xpPart = p.xp != null ? ` We earned ${p.xp} XP!` : "";
      return `We did it! ${quoted(p.questTitle, "Our quest")} is complete!${xpPart} You’re the best!`;
    },
    calm: (p) => {
      const title = present(p.questTitle);
      const xpPart = p.xp != null ? ` ${p.xp} XP awarded.` : "";
      return `Quest complete${title ? `: ${title}` : ""}.${xpPart}`;
    },
    funny: (p) => {
      const xpPart = p.xp != null ? ` +${p.xp} XP.` : "";
      return `${quoted(p.questTitle, "Quest")} — done!${xpPart} We make a surprisingly good team.`;
    },
    energetic: (p) => {
      const xpPart = p.xp != null ? `+${p.xp} XP! ` : "";
      return `${quoted(p.questTitle, "Quest")} complete! ${xpPart}What’s next?!`;
    },
    shy: (p) => {
      const xpPart = p.xp != null ? ` and earned ${p.xp} XP…` : "";
      return `We finished ${quoted(p.questTitle, "the quest")}…${xpPart} I’m really glad…`;
    },
  },
  LEVEL_UP: {
    cute: (p) =>
      p.level != null
        ? `Yay! Our bond is Level ${p.level} now! I love growing with you!`
        : "Yay! Our bond leveled up! I love growing with you!",
    calm: (p) =>
      p.level != null ? `Our bond has reached level ${p.level}.` : "Our bond has increased by one level.",
    funny: (p) =>
      p.level != null
        ? `Level ${p.level}! I’d do a victory dance, but I’m rooted to the spot.`
        : "Level up! I’d do a victory dance, but I’m rooted to the spot.",
    energetic: (p) =>
      p.level != null
        ? `LEVEL ${p.level}! We’re unstoppable — let’s keep growing!`
        : "LEVEL UP! We’re unstoppable — let’s keep growing!",
    shy: (p) =>
      p.level != null
        ? `Um… our bond is level ${p.level} now… that makes me really happy…`
        : "Um… our bond grew a little… that makes me really happy…",
  },
  BADGE_UNLOCKED: {
    cute: (p) => `Ooh, shiny! We earned the ${quoted(p.badgeName, "newest")} badge together!`,
    calm: (p) => {
      const badge = present(p.badgeName);
      return badge ? `Badge unlocked: ${badge}.` : "A new badge has been unlocked.";
    },
    funny: (p) =>
      `${quoted(p.badgeName, "A new badge")} unlocked! I’d pin it on, but leaves make terrible lapels.`,
    energetic: (p) => `Badge unlocked: ${quoted(p.badgeName, "a brand-new one")}! Incredible work!`,
    shy: (p) => `We… we got the ${quoted(p.badgeName, "new")} badge… I’m a little proud of us…`,
  },
  CHAPTER_UNLOCKED: {
    cute: (p) => {
      const title = present(p.chapterTitle);
      return title
        ? `A new chapter of our story begins: “${title}”! Read it with me?`
        : "A new chapter of our story begins! Read it with me?";
    },
    calm: (p) => {
      const title = present(p.chapterTitle);
      return title ? `A new story chapter is available: ${title}.` : "A new story chapter is available.";
    },
    funny: (p) => {
      const title = present(p.chapterTitle);
      return title
        ? `Plot twist! Chapter “${title}” unlocked. Spoiler: the plant thrives.`
        : "Plot twist! A new chapter unlocked. Spoiler: the plant thrives.";
    },
    energetic: (p) => {
      const title = present(p.chapterTitle);
      return title
        ? `New chapter unlocked: “${title}”! Our story keeps getting better!`
        : "New chapter unlocked! Our story keeps getting better!";
    },
    shy: (p) => {
      const title = present(p.chapterTitle);
      return title
        ? `Um… a new chapter opened… “${title}”… will you read it with me?`
        : "Um… a new chapter opened… will you read it with me?";
    },
  },
};

// ── Public API (stable — the AI layer wraps exactly these, handoff §24) ─

/**
 * Deterministic plant-voiced line for a sensor-derived mood.
 * Tolerates un-normalized runtime values (DB rows store personality as a raw
 * string; Node-RED sometimes sends label variants like "Dry Air").
 */
export function getMoodMessage(personality: PersonalityId, mood: PlantMood): string {
  const voice = MOOD_MESSAGES[normalizePersonality(personality)];
  const message: string | undefined = voice[normalizeMood(mood) ?? mood];
  // Unreachable with typed callers; keeps a garbage cast from returning undefined.
  return message ?? "I’m not sure how I’m feeling right now…";
}

/**
 * Deterministic plant-voiced line for a game event, interpolating params.
 * Missing params degrade gracefully to a complete sentence.
 */
export function getEventMessage(
  personality: PersonalityId,
  kind: MessageEventKind,
  params: EventMessageParams,
): string {
  return EVENT_MESSAGES[kind][normalizePersonality(personality)](params);
}
