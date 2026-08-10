// Pest scan — Gemini Vision advisory layer for the Camera Live Guardian
// (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// Mirrors src/lib/photo-comment.ts's standalone-vision contract (src/lib/ai.ts
// is text-only and server-only — never import it; the shared response walk
// lives in the pure "@/lib/gemini-text"):
//   - No GEMINI_API_KEY / network error / timeout (4s) / non-2xx / malformed
//     or overlong reply → { status: "disabled" } — the client stays in
//     labeled motion-only mode.
//   - "NONE" reply → { status: "clear" } — no pest seen, nothing shown.
//   - NO_PLANT sentinel (person in frame) → { status: "discarded" } — the
//     caller shows a generic line and persists NOTHING.
//   - Anything else (≤200 chars) → { status: "pest", advisory }.
//
// AI IS LANGUAGE ONLY: the advisory is flavor copy. It is never parsed for
// game decisions, never grants XP/Seeds/quests, and a misdetection changes
// nothing (project invariant). The snapshot exists solely inside this
// request — this module never writes it anywhere.

import { extractText } from "@/lib/gemini-text";
import type { AppLocale } from "@/lib/i18n";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 4_000; // same cap as src/lib/photo-comment.ts
const MAX_ADVISORY_CHARS = 200;
const MAX_TOKENS = 60;

/** Exact reply Gemini is instructed to give when a person is visible. */
export const NO_PLANT_SENTINEL = "NO_PLANT";
/** Exact reply Gemini is instructed to give when no pest is visible. */
export const NO_PEST_SENTINEL = "NONE";

export type PestScanOutcome =
  | { status: "disabled" }
  | { status: "clear" }
  | { status: "discarded" }
  | { status: "pest"; advisory: string };

export interface PestScanInput {
  /** Base64 of the ONE downscaled JPEG (≤200KB decoded, enforced upstream). */
  imageBase64: string;
  mimeType: string;
  locale: AppLocale;
}

// Advisory language, never authority: no diagnoses, no chemicals, no people.
const SYSTEM_PROMPT = [
  "You are the pest-watch voice of a classroom plant camera in PlantMoji.",
  "Absolute rules:",
  "- Look ONLY at the plant in the snapshot.",
  `- If any person, face, hand, or body part is visible anywhere, reply with exactly ${NO_PLANT_SENTINEL} and nothing else.`,
  `- If you do not clearly see an insect or pest on the plant, reply with exactly ${NO_PEST_SENTINEL} and nothing else. When unsure, reply ${NO_PEST_SENTINEL}.`,
  "- Only if an insect or pest may be ON the plant: reply with ONE short, playful sentence in the plant's own first-person voice asking the caretaker to take a look (like: Something tickles! Can you check my leaves? 🐛).",
  "- You are advisory flavor text, never a referee: no diagnoses, no disease names, no chemical or pesticide instructions, no numbers, no rewards.",
  "- Reply in the requested language, plain text only: no lists, no markdown, no quotation marks.",
].join("\n");

/**
 * One snapshot in, one advisory outcome out. Never throws. Never blocks
 * longer than ~4 seconds. Never persists anything.
 */
export async function analyzePestSnapshot(input: PestScanInput): Promise<PestScanOutcome> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !input.imageBase64) return { status: "disabled" };

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "This is one snapshot from the plant-watch camera.",
                  `Reply language: ${input.locale === "id" ? "Bahasa Indonesia" : "English"}.`,
                  "Follow the absolute rules exactly.",
                ].join("\n"),
              },
              { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { status: "disabled" };

    const text = extractText(await response.json());
    if (!text || text.length > MAX_ADVISORY_CHARS) return { status: "disabled" };
    const upper = text.toUpperCase();
    if (upper.includes(NO_PLANT_SENTINEL)) return { status: "discarded" };
    if (upper === NO_PEST_SENTINEL) return { status: "clear" };
    return { status: "pest", advisory: text };
  } catch {
    // Timeout, DNS, abort, invalid JSON — all identical: motion-only mode.
    return { status: "disabled" };
  }
}
