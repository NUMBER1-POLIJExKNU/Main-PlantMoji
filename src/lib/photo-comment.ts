// Camera photo diary — Jamkachu's observation comment layer (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Mirrors src/lib/ai.ts's contract as a standalone VISION variant (ai.ts is
// text-only and server-only, so it is never imported; the helpers both
// modules need are shared via the pure "@/lib/gemini-text" and
// "@/game/personality/voices" instead):
//   - No GEMINI_API_KEY / network error / timeout (4s) / non-2xx /
//     malformed / overlong reply  → deterministic sensor template.
//   - A person visible in the photo → Gemini answers the NO_PLANT sentinel
//     → deterministic template (never describe people; spec §Privacy).
//
// The comment is flavor text ONLY. It is stored on the growth record and
// displayed — it is NEVER parsed for game decisions, rewards, or health
// verdicts (project invariant: AI stays language-only).
//
// Voice contract (matches the diary-exchange rules of jamkachu-memory /
// generateMemoryReflection): Jamkachu writes BACK in the shared growth
// diary — a friend replying to today's entry, never an app captioning a
// photo. Variety is deterministic per record (FNV-1a seed), so SSR, client
// re-render, and tests all agree on which diary voice a record gets.
//
// No top-level "server-only" import so the pure template stays unit-testable
// (same reasoning as src/lib/growth.ts). The only production caller is the
// manual growth-record flow (addGrowthRecord in src/app/settings/actions.ts).

import { VOICE_DESCRIPTIONS } from "@/game/personality/voices";
import type { SensorSnapshot } from "@/lib/crop-profiles";
import { extractText, stripControlChars } from "@/lib/gemini-text";
import type { AppLocale } from "@/lib/i18n";
import { memorySeed } from "@/lib/jamkachu-memory";
import { normalizePersonality, type PersonalityId } from "@/types/game";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 4_000; // same cap as src/lib/ai.ts — the /api/mood-message contract
const MAX_COMMENT_CHARS = 300;
const MAX_TOKENS = 140; // 1-3 short diary sentences (same as generateMemoryReflection)
/** Exact reply Gemini is instructed to give when a person is visible. */
const NO_PLANT_SENTINEL = "NO_PLANT";

export interface PhotoCommentInput {
  plantName: string;
  personality: PersonalityId;
  snapshot: SensorSnapshot | null;
  locale: AppLocale;
  /** Base64 of the (already compressed) JPEG the student uploaded. */
  imageBase64: string;
  imageMimeType: string;
  /** Growth-record id — deterministic variation seed for the template pool
   *  and the AI writing angle. Optional: older callers keep index 0. */
  recordId?: string;
  /** Verified growth stage from the submitted record (restate only). */
  stage?: string | null;
  /** The caretaker's diary note on this record — quoted to the AI so the
   *  reply answers it like a friend writing back. */
  note?: string | null;
  /** Verified height from the submitted record — never extended. */
  heightCm?: number | null;
  /** Verified leaf count from the submitted record — never extended. */
  leafCount?: number | null;
  /** Openings of recent diary replies — banned as new openings. */
  recentComments?: string[];
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

// Five genuinely different diary voices per locale, en/id paired 1:1 by
// index. Index 0 is the pre-pool template verbatim, so a caller with no seed
// (older callers, and the no-recordId fallback) keeps today's exact output.
const NO_SNAPSHOT_POOL: Record<AppLocale, string[]> = {
  en: [
    "Thanks for taking my photo today! It's saved in our diary — let's watch how I grow together.",
    "Another page in our diary! I tried to hold my leaves extra still for this one.",
    "You remembered our diary today — that alone makes my leaves feel lighter.",
    "A new photo of me, tucked safely into our diary. One day we'll flip back to this page together.",
    "Click! That's me today, pressed into our diary. I wonder what tomorrow's page will look like.",
  ],
  id: [
    "Terima kasih sudah memotretku hari ini! Fotonya tersimpan di buku harian — ayo lihat pertumbuhanku bersama-sama.",
    "Satu halaman lagi di buku harian kita! Aku berusaha menahan daunku agar tetap tenang untuk foto ini.",
    "Kamu ingat buku harian kita hari ini — itu saja sudah membuat daunku terasa lebih ringan.",
    "Foto baru diriku, tersimpan rapi di buku harian kita. Suatu hari nanti kita buka lagi halaman ini bersama.",
    "Klik! Itu aku hari ini, terekam di buku harian kita. Aku penasaran seperti apa halaman besok.",
  ],
};

// Sensor-summary diary voices: every variant embeds the real readings
// summary — a missing value is simply omitted upstream, never invented.
type SensorTemplate = (summary: string) => string;
const SENSOR_POOL: Record<AppLocale, SensorTemplate[]> = {
  en: [
    (summary) => `Today's photo is saved in my diary! My sensors read ${summary} right now. Let's watch how I grow together.`,
    (summary) => `New diary page! While you took my photo, my sensors were reading ${summary}. I'll remember this moment.`,
    (summary) => `I posed my best for today's entry. For the record, my sensors say ${summary} — write that next to my photo.`,
    (summary) => `Our diary grows with me — this photo goes in right beside today's readings: ${summary}.`,
    (summary) => `Thank you for today's photo! My sensors whisper ${summary} — one more little memory kept safe.`,
  ],
  id: [
    (summary) => `Foto hari ini tersimpan di buku harianku! Sensorku sedang membaca ${summary}. Ayo lihat pertumbuhanku bersama-sama.`,
    (summary) => `Halaman baru di buku harian! Saat kamu memotretku, sensorku sedang membaca ${summary}. Aku akan mengingat momen ini.`,
    (summary) => `Aku berpose sebaik mungkin untuk catatan hari ini. Sebagai catatan, sensorku menunjukkan ${summary} — tulis itu di samping fotoku ya.`,
    (summary) => `Buku harian kita tumbuh bersamaku — foto ini masuk tepat di samping pembacaan hari ini: ${summary}.`,
    (summary) => `Terima kasih untuk foto hari ini! Sensorku berbisik ${summary} — satu lagi kenangan kecil yang tersimpan rapi.`,
  ],
};

/** No seed → index 0, today's exact pre-pool behavior. */
function pickIndex(seed: string | undefined, poolSize: number): number {
  return seed ? memorySeed(seed) % poolSize : 0;
}

/**
 * Deterministic fallback comment built from the latest sensor snapshot.
 * Warm Jamkachu diary voice, en/id, 1–2 sentences, only real readings — a
 * missing value is simply omitted, never invented. The optional seed (the
 * growth-record id) picks one of five diary voices per locale, so
 * consecutive fallback entries don't collapse into one template.
 */
export function templatePhotoComment(
  snapshot: SensorSnapshot | null,
  locale: AppLocale,
  seed?: string,
): string {
  if (!hasReadings(snapshot)) {
    const pool = NO_SNAPSHOT_POOL[locale];
    return pool[pickIndex(seed, pool.length)];
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

  const pool = SENSOR_POOL[locale];
  return pool[pickIndex(seed, pool.length)](summary);
}

// AI is language only, never truth: the photo may only be described, the
// verified facts may only be restated, and people must never be mentioned.
// Diary-exchange voice (same rules as generateMemoryReflection): Jamkachu
// writes back in the shared growth diary — a friend, not a caption engine.
const SYSTEM_PROMPT = [
  "You are the in-game voice of a real classroom plant in PlantMoji, writing back in the shared growth diary you and your caretaker keep together — two friends trading entries, not an app generating a caption.",
  "Absolute rules:",
  "- Speak in first person AS the plant, in the personality voice given in the user message.",
  "- Write ONE warm diary reply about the photo your caretaker just added: what you see of yourself (leaves, stem, soil, pot, color, growth) and how today feels.",
  "- Comment ONLY on the plant. NEVER describe, mention, or address any person, face, hand, or body part.",
  `- If a person is visible anywhere in the photo, reply with exactly ${NO_PLANT_SENTINEL} and nothing else.`,
  "- The verified facts in the user message (sensor readings, growth stage, height, leaf count) are the only measurements that exist. You may restate them; never extend them, and never write any digit that was not supplied. Never invent diagnoses or health scores.",
  "- Never judge, grade, or reward — you are flavor text, not a referee.",
  "- Never give chemical, fertilizer, or dosing instructions.",
  "- Never sound like an AI, report, or dashboard, and never fall back on stock diary phrasing like 'saved in my diary' or 'let's watch how I grow together' — write this entry in your own fresh words.",
  "- Vary freely: you may wonder aloud, tease gently, trail off, or ask your caretaker one small question back.",
  "- Reply in the requested language with 1-3 short sentences of plain text, under 300 characters: no lists, no markdown, no quotation marks.",
].join("\n");

/** Writing angles rotated by the record id so consecutive diary replies
 *  don't share one sentence shape (mirrors REFLECTION_ANGLES in
 *  jamkachu-memory). English on purpose — prompt language, not player copy.
 *  Salted separately from the template pick so the two don't correlate. */
const ANGLES: readonly string[] = [
  "one small detail you can actually see in the photo — a leaf, the stem, the soil, the light falling on you",
  "how you feel in your leaves today, at the exact moment this photo was taken",
  "how far you have grown since the earlier pages of this diary",
  "one small question back to your caretaker about today",
  "quiet gratitude that your caretaker stopped to photograph you today",
];

function photoAngle(recordId: string | undefined): string {
  return ANGLES[recordId ? memorySeed(`angle:${recordId}`) % ANGLES.length : 0];
}

/** stripControlChars (shared from "@/lib/gemini-text") + whitespace collapse
 *  + trim + cap — the prompt-safe form of any stored string (same job as
 *  gemini-text's cleanFragment, but always-string instead of string|null). */
function cleanText(value: string, maxLength: number): string {
  return stripControlChars(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildUserMessage(input: PhotoCommentInput): string {
  const personality = normalizePersonality(input.personality);
  const name = cleanText(input.plantName, 60) || "Plant";
  const sensorFacts = hasReadings(input.snapshot)
    ? [
        input.snapshot.temperature != null ? `temperature ${input.snapshot.temperature} C` : null,
        input.snapshot.humidity != null ? `air humidity ${input.snapshot.humidity}%` : null,
        input.snapshot.light != null ? `relative light ${input.snapshot.light}%` : null,
      ]
        .filter((fact): fact is string => fact != null)
        .join(", ")
    : "no sensor snapshot available";
  // Verified record facts: restate-only, never extend (same grounding rule
  // as generateMemoryReflection's verified memory).
  const recordFacts = [
    input.stage ? `growth stage "${cleanText(input.stage, 40)}"` : null,
    input.heightCm != null && Number.isFinite(input.heightCm) ? `height ${input.heightCm} cm` : null,
    input.leafCount != null && Number.isFinite(input.leafCount) ? `${input.leafCount} leaves` : null,
  ].filter((fact): fact is string => fact != null);
  const note = input.note ? cleanText(input.note, 200) : "";
  const avoid = (input.recentComments ?? [])
    .map((comment) => cleanText(comment, 60))
    .filter((opening) => opening.length > 0)
    .slice(0, 3);
  return [
    `My name is "${name}".`,
    `My personality voice: ${personality} — ${VOICE_DESCRIPTIONS[personality]}.`,
    `Verified sensor readings right now: ${sensorFacts}.`,
    recordFacts.length > 0
      ? `Verified facts my caretaker logged with this entry: ${recordFacts.join(", ")}. You may restate these; never extend them, and never write any digit that is not in them.`
      : null,
    note
      ? `Your caretaker wrote in the diary: "${note}". Reply to what they wrote, like a friend writing back.`
      : null,
    `Make this reply feel like ITS OWN diary entry: build it around ${photoAngle(input.recordId)}.`,
    avoid.length > 0
      ? `Recent diary replies already started with: ${avoid.map((opening) => `"${opening}"`).join(", ")}. Start this one differently.`
      : null,
    `Reply language: ${input.locale === "id" ? "Bahasa Indonesia" : "English"}.`,
    "Look at the attached photo of me and write today's diary reply to my caretaker, in your own words.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

/**
 * Gemini Vision observation comment, or the deterministic sensor template.
 * Never throws. Never blocks longer than ~4 seconds.
 */
export async function generatePhotoComment(input: PhotoCommentInput): Promise<PhotoCommentResult> {
  const fallback: PhotoCommentResult = {
    comment: templatePhotoComment(input.snapshot, input.locale, input.recordId),
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
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.95 },
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
