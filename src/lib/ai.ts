// LeafTalk AI personality layer (handoff §24, Phase 16).
//
// OPTIONAL and language-only. The rule engine and sensors provide the facts;
// this module only rewrites those facts in the plant's personality voice.
// It is impossible for this module to break the game:
//
//   - No ANTHROPIC_API_KEY          → returns null immediately.
//   - Network error / timeout       → returns null.
//   - Non-2xx / malformed response  → returns null.
//   - Suspiciously long response    → returns null.
//
// A null return is the entire fallback contract: callers then use the
// deterministic templates in "@/game/personality/templates" (handoff §24 —
// "the game must work with deterministic message templates"). This module
// deliberately does NOT import that module; it only signals via null.
//
// AI must never decide servo angles, pump durations, pH dosing, sensor
// validity, quest truth, XP, or levels — it never sees any of those inputs
// here, and the system prompt forbids inventing them.

import "server-only";

import { MOOD_LABELS, normalizeMood } from "@/types/events";
import { normalizePersonality } from "@/types/game";
import type { PersonalityId, PlantMood } from "@/types/game";

// ── Public contract ─────────────────────────────────────────────────────

/** Meaningful events that may trigger an AI-voiced message (handoff §24 —
 *  "Call AI only on meaningful events", never per sensor sample). */
export type AiMessageKind =
  | "MOOD"
  | "QUEST_CREATED"
  | "QUEST_COMPLETED"
  | "LEVEL_UP"
  | "BADGE_UNLOCKED"
  | "CHAPTER_UNLOCKED"
  | "WEEKLY_REPORT";

export interface AiMessageInput {
  kind: AiMessageKind;
  personality: PersonalityId;
  plantName: string;
  mood?: PlantMood;
  questTitle?: string;
  xp?: number;
  level?: number;
  badgeName?: string;
  chapterTitle?: string;
  reportSummary?: string;
}

// ── Anthropic Messages API constants ────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/** Small fast model — one or two short sentences do not need Opus-tier. */
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 120;
const TIMEOUT_MS = 4_000;
/** Anything longer than this is not a valid 1–2 sentence plant line. */
const MAX_MESSAGE_CHARS = 300;

// ── Personality voices (tone only — handoff §13) ────────────────────────

const VOICE_DESCRIPTIONS: Record<PersonalityId, string> = {
  cute: "sweet, affectionate, and endearing — warm words, gentle excitement",
  calm: "calm, measured, and factual — short neutral statements, no exclamation",
  funny: "playful and lightly self-deprecating — one gentle plant joke at most",
  energetic: "upbeat and enthusiastic — short punchy sentences, lots of energy",
  shy: "soft-spoken and hesitant — trailing pauses like “um…”, very gentle",
};

// AI is language only, never truth (handoff §24): the diagnosis/facts are
// provided in the user message and must not be altered or extended.
const SYSTEM_PROMPT = [
  "You are the in-game voice of a real houseplant in LeafTalk, a plant-care game.",
  "Absolute rules:",
  "- Speak in first person AS the plant, in the personality voice given in the user message.",
  "- The user message contains verified facts from the game engine. You may only restate or rephrase them. Never alter, extend, or contradict them, and never add a new diagnosis.",
  "- NEVER invent sensor values, measurements, or numbers that were not given to you.",
  "- NEVER give chemical or fertilizer dosing, hardware instructions, or medical-style instructions. At most, gently ask your caretaker for help in general terms.",
  "- Reply in English with 1-2 short sentences of plain text only: no lists, no markdown, no emoji spam, and no quotation marks around the reply.",
].join("\n");

// ── Fact assembly ───────────────────────────────────────────────────────

/** Trims, strips control characters, and caps length so a stored string can
 *  never bloat or derail the prompt. Returns null when effectively empty. */
function cleanFragment(value: string | undefined, maxLength = 120): string | null {
  if (typeof value !== "string") return null;
   
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/**
 * Builds the verified-facts block for the event, or null when the event's
 * essential fact is missing — the AI must never speak without grounding, so
 * a null here means "use the deterministic template instead".
 */
function buildFacts(input: AiMessageInput): string | null {
  switch (input.kind) {
    case "MOOD": {
      const mood = input.mood ? normalizeMood(input.mood) : null;
      if (!mood) return null;
      return `Event: my mood just changed. My current verified state is: ${MOOD_LABELS[mood]}.`;
    }
    case "QUEST_CREATED": {
      const title = cleanFragment(input.questTitle);
      return title
        ? `Event: a new care quest was created for my caretaker: “${title}”.`
        : "Event: a new care quest was created for my caretaker.";
    }
    case "QUEST_COMPLETED": {
      const title = cleanFragment(input.questTitle);
      const parts = [
        title
          ? `Event: my caretaker completed the quest “${title}”.`
          : "Event: my caretaker completed a care quest.",
      ];
      if (typeof input.xp === "number" && Number.isFinite(input.xp)) {
        parts.push(`It awarded ${input.xp} XP.`);
      }
      return parts.join(" ");
    }
    case "LEVEL_UP": {
      return typeof input.level === "number" && Number.isFinite(input.level)
        ? `Event: my bond with my caretaker reached level ${input.level}.`
        : "Event: my bond with my caretaker went up one level.";
    }
    case "BADGE_UNLOCKED": {
      const badge = cleanFragment(input.badgeName);
      return badge
        ? `Event: we unlocked the badge “${badge}” together.`
        : "Event: we unlocked a new badge together.";
    }
    case "CHAPTER_UNLOCKED": {
      const chapter = cleanFragment(input.chapterTitle);
      return chapter
        ? `Event: a new chapter of our story opened: “${chapter}”.`
        : "Event: a new chapter of our story opened.";
    }
    case "WEEKLY_REPORT": {
      const summary = cleanFragment(input.reportSummary, 400);
      if (!summary) return null;
      return `Event: my weekly care report is ready. Verified summary of the week: ${summary}`;
    }
    default:
      return null;
  }
}

function buildUserMessage(input: AiMessageInput, facts: string): string {
  const personality = normalizePersonality(input.personality);
  const name = cleanFragment(input.plantName, 60) ?? "Plant";
  return [
    `My name is “${name}”.`,
    `My personality voice: ${personality} — ${VOICE_DESCRIPTIONS[personality]}.`,
    facts,
    "Say one short in-character line (1-2 sentences) to my caretaker about this event.",
  ].join("\n");
}

// ── Response validation ─────────────────────────────────────────────────

/** Extracts the first non-empty text block from a Messages API response,
 *  tolerating any malformed shape by returning null. */
function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      const text = ((block as { text: string }).text).replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generates a plant-voiced message for a game event via the Anthropic
 * Messages API, or returns null so the caller falls back to the
 * deterministic templates in "@/game/personality/templates".
 *
 * Never throws. Never blocks longer than ~4 seconds.
 */
export async function generateAiMessage(input: AiMessageInput): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const facts = buildFacts(input);
    if (!facts) return null;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input, facts) }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const text = extractText(await response.json());
    if (!text || text.length > MAX_MESSAGE_CHARS) return null;
    return text;
  } catch {
    // Network failure, DNS, abort/timeout, invalid JSON — all identical to
    // the caller: no AI message, use the deterministic template.
    return null;
  }
}
