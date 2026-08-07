// Home-screen mood message (handoff §24).
//
// Combines the deterministic templates ("@/game/personality/templates") with
// the optional AI voice ("@/lib/ai"). The template is the PERMANENT fallback:
// this function always has one in hand and returns it whenever AI is off,
// fails, or has already failed for the current mood entry.
//
// §24 rule — AI is called on meaningful events only. The cache key includes
// state_changed_at, which pins each entry to one specific mood CHANGE, so a
// given change costs at most one API call no matter how many times the home
// page renders.

import "server-only";

import { generateAiMessage } from "@/lib/ai";
import { getMoodMessage } from "@/game/personality/templates";
import { normalizePersonality } from "@/types/game";
import type { Plant } from "@/types/plant";

// ── Module-level cache (per server process) ─────────────────────────────

const MAX_CACHE_ENTRIES = 50;

/** Settled AI results by mood entry. A cached null means "the API already
 *  failed for this entry" — kept so we don't retry on every page load. */
const settledCache = new Map<string, string | null>();

/** In-flight calls, so concurrent page loads of the same mood entry share
 *  one API call. Entries self-clean when the call settles (≤ ~4s — the
 *  generateAiMessage timeout), so this map needs no size cap. */
const inFlightCache = new Map<string, Promise<string | null>>();

function cacheKey(plant: Plant, personality: string): string {
  return `${plant.id}|${plant.current_state}|${personality}|${plant.state_changed_at}`;
}

/** Oldest-first eviction via Map insertion order (re-setting an existing key
 *  does not move it, which is fine — older entries are stale mood entries). */
function evictOldest(): void {
  while (settledCache.size > MAX_CACHE_ENTRIES) {
    const oldest = settledCache.keys().next().value;
    if (oldest === undefined) return;
    settledCache.delete(oldest);
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Plant-voiced line for the plant's current mood, AI-flavored when possible.
 *
 * Always resolves to a displayable string; never throws. Without an
 * ANTHROPIC_API_KEY this is fully synchronous in effect — the deterministic
 * template is returned without touching the cache or awaiting anything.
 */
export async function getHomeMoodMessage(plant: Plant): Promise<string> {
  const personality = normalizePersonality(plant.personality);
  const template = getMoodMessage(personality, plant.current_state);

  try {
    // generateAiMessage guards too, but returning here skips a pointless
    // await/cache round-trip in the common key-less (demo/offline) setup.
    if (!process.env.ANTHROPIC_API_KEY) return template;

    const key = cacheKey(plant, personality);

    if (settledCache.has(key)) {
      return settledCache.get(key) ?? template;
    }

    let pending = inFlightCache.get(key);
    if (!pending) {
      pending = generateAiMessage({
        kind: "MOOD",
        personality,
        plantName: plant.name,
        mood: plant.current_state,
      });
      inFlightCache.set(key, pending);
    }

    // generateAiMessage never throws, so this promise always resolves.
    const aiMessage = await pending;

    inFlightCache.delete(key);
    settledCache.set(key, aiMessage);
    evictOldest();

    return aiMessage ?? template;
  } catch {
    // Unreachable by contract; kept so a future regression in the AI layer
    // can only ever degrade to the template, never break the home page.
    return template;
  }
}
