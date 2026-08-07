// Ephemeral event-emotion overlay (handoff §12): temporary display states
// layered over the six sensor moods (handoff §5.1 / PlantMood). These are
// display-only reactions to something that just happened — a quest
// completing, a level up, a new chapter, a problem resolving — never a
// sensor-derived plant mood and never persisted as plant state anywhere
// (not in `plants`, not in `bond_state`). A UI layer shows the badge for
// `durationMs` and then discards it; nothing about it survives a reload.
//
//   Proud      → a quest completes                 (QUEST_COMPLETED)
//   Excited    → the plant's bond level goes up     (LEVEL_UP)
//   Curious    → a new story chapter unlocks        (CHAPTER_UNLOCKED)
//   Recovering → a problem mood just resolved to Happy (mood transition)
//
// Both resolvers below are pure and synchronous — no I/O, no Supabase, no
// clock reads — so they're safe to call from client components, server
// components, or tests alike.

import type { BondEventType } from "@/types/game";
import type { PlantMood } from "@/types/events";

export type EventEmotion = "Proud" | "Excited" | "Curious" | "Recovering";

export interface EmotionMeta {
  emotion: EventEmotion;
  emoji: string;
  label: string;
  /** How long the badge should stay on screen before auto-dismissing. */
  durationMs: number;
}

const EMOTION_META: Record<EventEmotion, EmotionMeta> = {
  Proud: { emotion: "Proud", emoji: "🏅", label: "Proud", durationMs: 5000 },
  Excited: { emotion: "Excited", emoji: "🤩", label: "Excited", durationMs: 6000 },
  Curious: { emotion: "Curious", emoji: "👀", label: "Curious", durationMs: 4000 },
  Recovering: { emotion: "Recovering", emoji: "😌", label: "Recovering", durationMs: 4500 },
};

/**
 * Maps a `bond_events` row type (handoff §27) to the event emotion it
 * should momentarily surface, or null when that event type has no emotion
 * overlay. `data` is accepted for signature symmetry with the mood resolver
 * below and for future refinement, but the mapping today is purely by
 * event type.
 */
export function emotionForBondEvent(
  type: BondEventType,
  data?: Record<string, unknown>,
): EmotionMeta | null {
  void data;
  switch (type) {
    case "QUEST_COMPLETED":
      return EMOTION_META.Proud;
    case "LEVEL_UP":
      return EMOTION_META.Excited;
    case "CHAPTER_UNLOCKED":
      return EMOTION_META.Curious;
    // QUEST_CREATED, QUEST_EXPIRED, XP_AWARDED, STREAK_UPDATED,
    // BADGE_UNLOCKED: no event-emotion overlay defined for these (yet).
    default:
      return null;
  }
}

/**
 * Detects a "Recovering" moment: the plant's sensor mood just resolved from
 * any problem mood (anything other than Happy) back to Happy. Returns null
 * for every other transition — including Happy → Happy (nothing resolved)
 * and an unknown previous mood (null, e.g. the very first reading) → Happy,
 * since there's no observed problem to have recovered from.
 */
export function emotionForMoodChange(
  previousState: PlantMood | null,
  currentState: PlantMood,
): EmotionMeta | null {
  if (previousState === null) return null;
  if (previousState === "Happy") return null;
  if (currentState !== "Happy") return null;
  return EMOTION_META.Recovering;
}
