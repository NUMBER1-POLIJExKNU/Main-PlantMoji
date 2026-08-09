// Camera photo diary — Jamkachu's observation comment layer (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Mirrors src/lib/ai.ts's contract as a standalone VISION variant (ai.ts is
// text-only and owned by a concurrent workstream, so it is not imported):
//   - No GEMINI_API_KEY / network error / timeout (4s) / non-2xx /
//     malformed / overlong reply  → deterministic sensor template.
//   - A person visible in the photo → Gemini answers the NO_PLANT sentinel
//     → deterministic template (never describe people; spec §Privacy).
//
// The comment is flavor text ONLY. It is stored on the growth record and
// displayed — it is NEVER parsed for game decisions, rewards, or health
// verdicts (project invariant: AI stays language-only).
//
// No top-level "server-only" import so the pure template stays unit-testable
// (same reasoning as src/lib/growth.ts). The only production caller is the
// /camera server action.

import type { SensorSnapshot } from "@/lib/crop-profiles";
import type { AppLocale } from "@/lib/i18n";
import { normalizePersonality, type PersonalityId } from "@/types/game";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 4_000; // same cap as src/lib/ai.ts — the /api/mood-message contract
const MAX_COMMENT_CHARS = 300;
const MAX_TOKENS = 120;
/** Exact reply Gemini is instructed to give when a person is visible. */
const NO_PLANT_SENTINEL = "NO_PLANT";

/** Tone-only voice hints (duplicated from src/lib/ai.ts on purpose — that
 *  module is owned by a concurrent workstream and must not be modified). */
const VOICE_HINTS: Record<PersonalityId, string> = {
  cute: "sweet, affectionate, and endearing",
  calm: "calm, measured, and factual",
  funny: "playful — one gentle plant joke at most",
  energetic: "upbeat and enthusiastic",
  shy: "soft-spoken and hesitant",
};

export interface PhotoCommentInput {
  plantName: string;
  personality: PersonalityId;
  snapshot: SensorSnapshot | null;
  locale: AppLocale;
  /** Base64 of the (already compressed) JPEG the student uploaded. */
  imageBase64: string;
  imageMimeType: string;
}

export interface PhotoCommentResult {
  comment: string;
  /** Internal flag only (spec §Error handling) — never shown to kids. */
  source: "gemini" | "template";
}

/** True when the snapshot has at least one displayable reading. */
function hasReadings(snapshot: SensorSnapshot | null): snapshot is SensorSnapshot {
  return (
    snapshot != null &&
    (snapshot.temperature != null || snapshot.humidity != null || snapshot.light != null)
  );
}

/**
 * Deterministic fallback comment built from the latest sensor snapshot.
 * Warm Jamkachu voice, en/id, 1–2 sentences, only real readings — a missing
 * value is simply omitted, never invented.
 */
export function templatePhotoComment(snapshot: SensorSnapshot | null, locale: AppLocale): string {
  if (!hasReadings(snapshot)) {
    return locale === "id"
      ? "Terima kasih sudah memotretku hari ini! Fotonya tersimpan di buku harian — ayo lihat pertumbuhanku bersama-sama."
      : "Thanks for taking my photo today! It's saved in our diary — let's watch how I grow together.";
  }

  const parts: string[] = [];
  if (snapshot.temperature != null) {
    parts.push(locale === "id" ? `suhu ${snapshot.temperature}°C` : `${snapshot.temperature}°C air`);
  }
  if (snapshot.humidity != null) {
    parts.push(locale === "id" ? `kelembapan ${snapshot.humidity}%` : `${snapshot.humidity}% humidity`);
  }
  if (snapshot.light != null) {
    parts.push(locale === "id" ? `cahaya ${snapshot.light}%` : `${snapshot.light}% light`);
  }
  const summary = parts.join(", ");

  return locale === "id"
    ? `Foto hari ini tersimpan di buku harianku! Sensorku sedang membaca ${summary}. Ayo lihat pertumbuhanku bersama-sama.`
    : `Today's photo is saved in my diary! My sensors read ${summary} right now. Let's watch how I grow together.`;
}

// AI is language only, never truth: the photo may only be described, the
// sensor facts may only be restated, and people must never be mentioned.
const SYSTEM_PROMPT = [
  "You are the in-game voice of a real classroom plant in PlantMoji, reacting to a photo a student just took of you.",
  "Absolute rules:",
  "- Speak in first person AS the plant, in the personality voice given in the user message.",
  "- Say ONE warm observation about the photo (1-2 short sentences): leaves, stem, soil, pot, color, growth.",
  "- Comment ONLY on the plant. NEVER describe, mention, or address any person, face, hand, or body part.",
  `- If a person is visible anywhere in the photo, reply with exactly ${NO_PLANT_SENTINEL} and nothing else.`,
  "- The sensor readings in the user message are the only measurements that exist. Never invent numbers, diagnoses, or health scores.",
  "- Never judge, grade, or reward — you are flavor text, not a referee.",
  "- Never give chemical, fertilizer, or dosing instructions.",
  "- Reply in the requested language with plain text only: no lists, no markdown, no quotation marks.",
].join("\n");

/** Strips ASCII control characters, mirroring src/lib/ai.ts's cleanFragment
 *  behavior (character-code comparison, not a regex escape literal, so this
 *  source file never embeds raw control bytes). */
function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out;
}

function buildUserMessage(input: PhotoCommentInput): string {
  const personality = normalizePersonality(input.personality);
  const name = stripControlChars(input.plantName).trim().slice(0, 60) || "Plant";
  const sensorFacts = hasReadings(input.snapshot)
    ? [
        input.snapshot.temperature != null ? `temperature ${input.snapshot.temperature} C` : null,
        input.snapshot.humidity != null ? `air humidity ${input.snapshot.humidity}%` : null,
        input.snapshot.light != null ? `relative light ${input.snapshot.light}%` : null,
      ]
        .filter((fact): fact is string => fact != null)
        .join(", ")
    : "no sensor snapshot available";
  return [
    `My name is "${name}".`,
    `My personality voice: ${personality} — ${VOICE_HINTS[personality]}.`,
    `Verified sensor readings right now: ${sensorFacts}.`,
    `Reply language: ${input.locale === "id" ? "Bahasa Indonesia" : "English"}.`,
    "Look at the attached photo of me and say one short in-character observation to my caretaker.",
  ].join("\n");
}

/** Extracts the first non-empty text part, tolerating any malformed shape
 *  by returning null (same defensive walk as src/lib/ai.ts). */
function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string") {
      const text = (part as { text: string }).text.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * Gemini Vision observation comment, or the deterministic sensor template.
 * Never throws. Never blocks longer than ~4 seconds.
 */
export async function generatePhotoComment(input: PhotoCommentInput): Promise<PhotoCommentResult> {
  const fallback: PhotoCommentResult = {
    comment: templatePhotoComment(input.snapshot, input.locale),
    source: "template",
  };
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fallback;
    if (!input.imageBase64) return fallback;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: buildUserMessage(input) },
              { inline_data: { mime_type: input.imageMimeType, data: input.imageBase64 } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return fallback;

    const text = extractText(await response.json());
    if (!text || text.length > MAX_COMMENT_CHARS) return fallback;
    if (text.toUpperCase().includes(NO_PLANT_SENTINEL)) return fallback;
    return { comment: text, source: "gemini" };
  } catch {
    // Network failure, DNS, abort/timeout, invalid JSON — all identical to
    // the caller: use the deterministic template.
    return fallback;
  }
}
