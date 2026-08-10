// Personality voice descriptions (tone only — handoff §13).
//
// The single source for the five-personality voice table that AI prompts
// embed ("My personality voice: cute — sweet, affectionate, …"). Moved out
// of src/lib/ai.ts so the vision modules (src/lib/photo-comment.ts) can
// share the full table without importing that server-only text module.
//
// PURE: types only, no I/O — plain vitest can import this directly (same
// reasoning as src/lib/growth.ts's header). Never import src/lib/ai.ts back.
//
// Tone only, never truth: these strings style the language; they never
// carry facts, diagnoses, sensor values, or numbers.

import type { PersonalityId } from "@/types/game";

export const VOICE_DESCRIPTIONS: Record<PersonalityId, string> = {
  cute: "sweet, affectionate, and endearing — warm words, gentle excitement",
  calm: "calm, measured, and factual — short neutral statements, no exclamation",
  funny: "playful and lightly self-deprecating — one gentle plant joke at most",
  energetic: "upbeat and enthusiastic — short punchy sentences, lots of energy",
  shy: "soft-spoken and hesitant — trailing pauses like “um…”, very gentle",
};
