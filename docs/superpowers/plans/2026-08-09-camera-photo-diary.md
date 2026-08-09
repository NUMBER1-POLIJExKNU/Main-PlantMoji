> **SUPERSEDED (2026-08-09):** built for the pivoted-away photo-diary design — see spec `2026-08-09-camera-live-guardian-design.md` and its replacement plan. Do not execute.

# Camera Growth Photo Diary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the disabled "Camera AI" nav button real — students photograph the real classroom plant, the photo lands in the existing growth diary (`growth_records`) via Supabase Storage, and Jamkachu reacts with an AI-voiced (Gemini Vision, deterministic-template fallback) observation comment, with the first photo of each WIB day granting +1 Seed.

**Architecture:** A new `supabase/milestone19-photo-diary.sql` adds the `plant-photos` Storage bucket and `growth_records.photo_url` / `ai_comment` columns. A new pure-helper lib (`src/lib/photo-diary.ts`) plus a comment-layer lib (`src/lib/photo-comment.ts`, mirroring `src/lib/ai.ts`'s null-safe Gemini contract) feed a server action (`src/app/camera/actions.ts`) that validates, uploads, inserts the diary row, and fires the idempotent `award_seeds` grant with graceful skip. A new `/camera` React route (pixel-farm styled) does client-side canvas compression; the diary page renders thumbnails inline.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions + `useActionState`), Supabase (Postgres + Storage, server secret key only), Gemini `generateContent` vision (optional `GEMINI_API_KEY`), Vitest, Tailwind 4 + repo `pm-*` pixel classes.

**Spec:** `docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md`

## Global Constraints

- AI is language-only: the comment is flavor text, NEVER parsed for game decisions, never a health verdict, score, or reward trigger.
- The reward tie-in is deterministic (first photo per WIB day, idempotent by ledger key) — allowed because it is not AI-judged.
- XP / Bond Level never decrease; Seeds MAY decrease (they are the spendable currency; this feature only grants +1, never spends).
- The farm layer (public/farm/*) is presentation-only — it never computes balances or truth.
- All player-facing copy exists in en AND id (strings-parity ethos); operator notes may be English.
- Milestone SQL is additive and re-runnable; a missing migration/bucket is a graceful no-op ("coming soon" operator note, diary renders without thumbnails), never a crash.
- The browser never holds write credentials — all uploads/inserts go through the server action using `getServerSupabase()`.
- Privacy: photograph the PLANT only; storage paths never contain student names; the Gemini prompt must never describe people (person visible → template line).
- Gemini calls cap at 4 s and never throw — same fallback contract as `/api/mood-message` / `src/lib/ai.ts` (null → deterministic template).
- DO NOT MODIFY these Codex-workstream-owned files: `src/lib/ai.ts`, `src/app/globals.css`, `src/app/api/memory-reflection/`, `src/lib/jamkachu-memory.ts`, `src/lib/farmer-chat.ts`. Any new styling uses existing `pm-*`/Tailwind classes only (no globals.css edits).
- `public/farm/live.js`, `strings.js`, `style.css`, `demo.js` were just modified by the pokemon-FX workstream: read their CURRENT content before editing, keep every farm-layer edit strictly additive/minimal (this plan only touches `public/farm/index.html`, one line).
- `src/app/diary/page.tsx` has uncommitted Codex edits — Task 8 rebases on whatever content exists at execution time and keeps the change minimal.
- milestone16 is reserved (no file); milestone18 (`award_seeds`) is a concurrent workstream — this feature must work with milestone18 ABSENT (photo still saves, grant skipped).

---

### Task 1: `supabase/milestone19-photo-diary.sql` — bucket + diary columns

**Files:**
- Create: `supabase/milestone19-photo-diary.sql`
- Test: none (SQL migrations in this repo are verified by re-runnability review + the Supabase SQL editor; every statement below is guarded)

**Interfaces:**
- Consumes: existing `public.growth_records` table (supabase/milestone5-growth-records.sql), Supabase `storage.buckets`.
- Produces: Storage bucket `plant-photos` (public read), columns `growth_records.photo_url text` and `growth_records.ai_comment text`. No RPCs.

**Steps:**

- [ ] Write `supabase/milestone19-photo-diary.sql` with exactly this content:

```sql
-- LeafTalk · Milestone 19 — Camera growth photo diary
-- (docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql and
-- supabase/milestone5-growth-records.sql first. milestone18 (Seed Shop)
-- is NOT required — without it the +1 Seed photo grant is skipped
-- gracefully by the server action.
--
-- Privacy (kids, school devices): the bucket is public-READ for the MVP
-- (one shared classroom plant, no personal albums). Object paths are
-- always `<plant-id>/<wib-date>-<timestamp>.jpg` — never a student name
-- (enforced by photoStoragePath() in src/lib/photo-diary.ts). All WRITES
-- go through the server action with the service-role key (bypasses RLS);
-- the browser never holds write credentials, so no storage.objects
-- insert/update/delete policies are created on purpose.

-- ── plant-photos Storage bucket (public read) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do update set public = true;

-- ── growth_records: the photo diary IS the growth diary ─────────────────
-- One timeline, no second feed (spec §Flow-5). Both columns nullable so
-- every pre-existing manual record stays valid.
alter table public.growth_records
  add column if not exists photo_url text;

-- Jamkachu's observation line (Gemini Vision or deterministic template).
-- Flavor text only — NEVER parsed for game decisions.
alter table public.growth_records
  add column if not exists ai_comment text;
```

- [ ] Review the file against the repo invariant checklist: every statement is `on conflict`-guarded or `if not exists`-guarded (re-runnable), nothing drops or mutates existing data (additive), no Node-RED legacy tables touched.
- [ ] Run the full suite to prove nothing regressed: `npm test` — expect all existing tests green (this task adds no TS).
- [ ] Commit: `git add supabase/milestone19-photo-diary.sql && git commit -m "feat: milestone19 photo-diary migration (plant-photos bucket + growth_records photo columns)"`

---

### Task 2: `src/lib/photo-diary.ts` — pure upload validation + WIB reward key + storage path

**Files:**
- Create: `src/lib/photo-diary.ts`
- Test: `tests/photo-diary.test.ts`

**Interfaces:**
- Consumes: `wibDate(now?: Date): string` from `@/game/quiz/daily-quiz` (already exists, formats YYYY-MM-DD in `Asia/Jakarta`).
- Produces (exact exports):
  - `const ALLOWED_PHOTO_MIME_TYPES: readonly string[]` — `["image/jpeg", "image/png", "image/webp"]`
  - `const MAX_PHOTO_BYTES: number` — `5 * 1024 * 1024`
  - `interface PhotoUploadCheck { type: string; size: number }`
  - `type PhotoUploadValidation = { ok: true } | { ok: false; error: "too_large" | "bad_type" }`
  - `function validatePhotoUpload(file: PhotoUploadCheck): PhotoUploadValidation`
  - `function photoStoragePath(plantId: string, now?: Date): string` — `` `${plantId}/${wibDate(now)}-${now.getTime()}.jpg` ``
  - `function photoRewardKey(now?: Date): string` — `` `photo:${wibDate(now)}` `` (spec-exact ledger key)

**Steps:**

- [ ] Write the failing test `tests/photo-diary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  photoRewardKey,
  photoStoragePath,
  validatePhotoUpload,
} from "@/lib/photo-diary";

describe("validatePhotoUpload", () => {
  it("accepts a normal JPEG under the cap", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts every allowed MIME type", () => {
    for (const type of ALLOWED_PHOTO_MIME_TYPES) {
      expect(validatePhotoUpload({ type, size: 10 })).toEqual({ ok: true });
    }
  });

  it("rejects files over 5MB with too_large", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("accepts a file at exactly the 5MB cap", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: MAX_PHOTO_BYTES })).toEqual({ ok: true });
  });

  it("rejects non-image MIME types with bad_type", () => {
    for (const type of ["application/pdf", "text/html", "video/mp4", "image/svg+xml", ""]) {
      expect(validatePhotoUpload({ type, size: 10 })).toEqual({ ok: false, error: "bad_type" });
    }
  });
});

describe("photoRewardKey — WIB, not device timezone", () => {
  it("uses the WIB calendar date", () => {
    // 2026-08-09T18:00Z is already 2026-08-10 01:00 in WIB (UTC+7).
    expect(photoRewardKey(new Date("2026-08-09T18:00:00.000Z"))).toBe("photo:2026-08-10");
  });

  it("stays on the same WIB day just before WIB midnight", () => {
    // 2026-08-09T16:59Z = 2026-08-09 23:59 WIB.
    expect(photoRewardKey(new Date("2026-08-09T16:59:00.000Z"))).toBe("photo:2026-08-09");
  });
});

describe("photoStoragePath", () => {
  it("is <plantId>/<wib-date>-<epoch-ms>.jpg and never contains anything else", () => {
    const at = new Date("2026-08-09T03:00:00.000Z"); // 10:00 WIB
    expect(photoStoragePath("plant-01", at)).toBe(`plant-01/2026-08-09-${at.getTime()}.jpg`);
  });
});
```

- [ ] Run it and watch it fail on the missing module: `npx vitest run tests/photo-diary.test.ts` — expected failure: `Cannot find module '@/lib/photo-diary'` (or equivalent resolve error).
- [ ] Implement `src/lib/photo-diary.ts`:

```ts
// Camera growth photo diary — pure helpers (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Deliberately free of "server-only" and Supabase imports (same reasoning
// as src/lib/growth.ts's header): the server action does the I/O, these
// helpers stay unit-testable and importable from the client bundle (the
// capture component reuses MAX_PHOTO_BYTES for its pre-compression cap).

import { wibDate } from "@/game/quiz/daily-quiz";

/** MIME types the diary accepts. The canvas compressor always re-encodes
 *  to image/jpeg, but the raw <input type="file"> may hand us png/webp on
 *  devices whose camera app saves those formats. */
export const ALLOWED_PHOTO_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 5MB pre-compression cap (spec §Privacy) — checked client-side for fast
 *  feedback AND re-checked server-side (never trust the client). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The two fields of File/Blob that validation needs — kept structural so
 *  tests never have to construct a real File. */
export interface PhotoUploadCheck {
  type: string;
  size: number;
}

export type PhotoUploadValidation =
  | { ok: true }
  | { ok: false; error: "too_large" | "bad_type" };

export function validatePhotoUpload(file: PhotoUploadCheck): PhotoUploadValidation {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) return { ok: false, error: "bad_type" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "too_large" };
  return { ok: true };
}

/**
 * Storage object path: `<plant-id>/<wib-date>-<epoch-ms>.jpg`.
 * NEVER derived from user input beyond the validated plant id — paths must
 * never contain student names (spec §Privacy).
 */
export function photoStoragePath(plantId: string, now: Date = new Date()): string {
  return `${plantId}/${wibDate(now)}-${now.getTime()}.jpg`;
}

/**
 * Idempotency ledger key for the deterministic +1 Seed grant: the FIRST
 * photo of each WIB calendar day earns it, replays are no-ops in the
 * seed_rewards ledger (spec §Flow-6). WIB, never the device timezone.
 */
export function photoRewardKey(now: Date = new Date()): string {
  return `photo:${wibDate(now)}`;
}
```

- [ ] Run again: `npx vitest run tests/photo-diary.test.ts` — expect all tests green.
- [ ] Commit: `git add src/lib/photo-diary.ts tests/photo-diary.test.ts && git commit -m "feat: photo diary pure helpers (validation, WIB reward key, storage path)"`

---

### Task 3: `src/lib/photo-comment.ts` — Gemini Vision comment layer + deterministic sensor-template fallback

**Files:**
- Create: `src/lib/photo-comment.ts`
- Test: `tests/photo-comment.test.ts`

**Interfaces:**
- Consumes: `SensorSnapshot` from `@/lib/crop-profiles` (`{ temperature: number|null; humidity: number|null; soilPh: number|null; light: number|null; recordedAt?: string|null }`), `AppLocale` from `@/lib/i18n`, `normalizePersonality`/`PersonalityId` from `@/types/game`, `process.env.GEMINI_API_KEY`, global `fetch`.
- Produces (exact exports):
  - `interface PhotoCommentInput { plantName: string; personality: PersonalityId; snapshot: SensorSnapshot | null; locale: AppLocale; imageBase64: string; imageMimeType: string }`
  - `interface PhotoCommentResult { comment: string; source: "gemini" | "template" }`
  - `function templatePhotoComment(snapshot: SensorSnapshot | null, locale: AppLocale): string` — deterministic, localized, sensor-grounded.
  - `async function generatePhotoComment(input: PhotoCommentInput): Promise<PhotoCommentResult>` — never throws, ≤ ~4 s.
- Note: does NOT import `src/lib/ai.ts` (Codex-owned, and its Gemini functions are text-only). It mirrors that module's constants and null-fallback contract as a standalone vision variant. No top-level `server-only` import (same testability reasoning as `src/lib/growth.ts`) — the only secret it reads is `process.env.GEMINI_API_KEY` inside the function, and the server action is its only production caller.

**Steps:**

- [ ] Write the failing test `tests/photo-comment.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePhotoComment, templatePhotoComment } from "@/lib/photo-comment";
import type { SensorSnapshot } from "@/lib/crop-profiles";

const SNAPSHOT: SensorSnapshot = {
  temperature: 27,
  humidity: 70,
  soilPh: 6.1,
  light: 55,
  recordedAt: "2026-08-09T03:00:00.000Z",
};

function baseInput() {
  return {
    plantName: "Jamkachu",
    personality: "cute" as const,
    snapshot: SNAPSHOT,
    locale: "en" as const,
    imageBase64: "aGVsbG8=",
    imageMimeType: "image/jpeg",
  };
}

/** Minimal Gemini generateContent success payload. */
function geminiResponse(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("templatePhotoComment", () => {
  it("is localized and non-empty with no snapshot at all", () => {
    const en = templatePhotoComment(null, "en");
    const id = templatePhotoComment(null, "id");
    expect(en.length).toBeGreaterThan(0);
    expect(id.length).toBeGreaterThan(0);
    expect(en).not.toBe(id);
  });

  it("includes real sensor values when a snapshot exists", () => {
    const en = templatePhotoComment(SNAPSHOT, "en");
    expect(en).toContain("27");
    expect(en).toContain("55");
    const id = templatePhotoComment(SNAPSHOT, "id");
    expect(id).toContain("27");
  });

  it("skips missing readings instead of inventing them", () => {
    const partial: SensorSnapshot = { temperature: null, humidity: null, soilPh: null, light: 40 };
    const en = templatePhotoComment(partial, "en");
    expect(en).toContain("40");
    expect(en).not.toMatch(/null|undefined|NaN/);
  });
});

describe("generatePhotoComment fallback selection", () => {
  it("no GEMINI_API_KEY → template, no network call", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
    expect(result.comment).toBe(templatePhotoComment(SNAPSHOT, "en"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("network failure → template, never throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("timeout abort → template, never throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("non-2xx response → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("valid Gemini reply → gemini source with the reply text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("A new leaf on the left side!")));
    const result = await generatePhotoComment(baseInput());
    expect(result).toEqual({ comment: "A new leaf on the left side!", source: "gemini" });
  });

  it("NO_PLANT sentinel (person visible) → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("NO_PLANT")));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("overlong reply → template", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("x".repeat(301))));
    const result = await generatePhotoComment(baseInput());
    expect(result.source).toBe("template");
  });

  it("localizes the template fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await generatePhotoComment({ ...baseInput(), locale: "id" });
    expect(result.comment).toBe(templatePhotoComment(SNAPSHOT, "id"));
  });
});
```

- [ ] Run it and watch it fail: `npx vitest run tests/photo-comment.test.ts` — expected failure: `Cannot find module '@/lib/photo-comment'`.
- [ ] Implement `src/lib/photo-comment.ts`:

```ts
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

function buildUserMessage(input: PhotoCommentInput): string {
  const personality = normalizePersonality(input.personality);
  const name = input.plantName.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60) || "Plant";
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
    `My name is “${name}”.`,
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
```

- [ ] Run again: `npx vitest run tests/photo-comment.test.ts` — expect all tests green.
- [ ] Commit: `git add src/lib/photo-comment.ts tests/photo-comment.test.ts && git commit -m "feat: photo comment layer (Gemini Vision + deterministic sensor-template fallback)"`

---

### Task 4: `src/app/camera/copy.ts` — bilingual page copy (with privacy lines) + parity test

**Files:**
- Create: `src/app/camera/copy.ts`
- Test: `tests/camera-copy.test.ts`

**Interfaces:**
- Consumes: `AppLocale` from `@/lib/i18n`.
- Produces (exact exports):
  - `interface CameraCopy` — all fields `string`: `title`, `description`, `privacyTitle`, `privacyPlantOnly`, `privacyNoNames`, `chooseButton`, `retakeButton`, `submitButton`, `uploading`, `successTitle`, `seedGranted`, `seedAlready`, `retryButton`, `failedUpload`, `tooLarge`, `wrongType`, `notReadyTitle`, `notReadyBody`, `commentLabel`, `viewDiary`
  - `const CAMERA_COPY: Record<AppLocale, CameraCopy>`
- Pattern: locale copy-map like `src/components/collection-tabs.tsx` / `src/lib/i18n.ts` — a typed Record so TS enforces parity at compile time, plus a runtime test in the strings-parity spirit.

**Steps:**

- [ ] Write the failing test `tests/camera-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAMERA_COPY } from "@/app/camera/copy";

describe("camera page copy (en/id parity)", () => {
  it("has identical key sets in both locales", () => {
    expect(Object.keys(CAMERA_COPY.en).sort()).toEqual(Object.keys(CAMERA_COPY.id).sort());
  });

  it("every string is non-empty in both locales", () => {
    for (const locale of ["en", "id"] as const) {
      for (const [key, value] of Object.entries(CAMERA_COPY[locale])) {
        expect(value.trim().length, `${locale}.${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("carries the plant-only privacy instruction in both locales", () => {
    expect(CAMERA_COPY.id.privacyPlantOnly).toContain("tanaman");
    expect(CAMERA_COPY.en.privacyPlantOnly.toLowerCase()).toContain("plant");
  });
});
```

- [ ] Run it and watch it fail: `npx vitest run tests/camera-copy.test.ts` — expected failure: `Cannot find module '@/app/camera/copy'`.
- [ ] Implement `src/app/camera/copy.ts`:

```ts
// Camera photo diary — bilingual page copy (spec §Privacy & safety).
// Typed Record keeps en/id key parity at compile time; tests/camera-copy.test.ts
// guards it at runtime in the strings-parity spirit. Pure data — importable
// from both server and client components.

import type { AppLocale } from "@/lib/i18n";

export interface CameraCopy {
  title: string;
  description: string;
  privacyTitle: string;
  privacyPlantOnly: string;
  privacyNoNames: string;
  chooseButton: string;
  retakeButton: string;
  submitButton: string;
  uploading: string;
  successTitle: string;
  seedGranted: string;
  seedAlready: string;
  retryButton: string;
  failedUpload: string;
  tooLarge: string;
  wrongType: string;
  notReadyTitle: string;
  notReadyBody: string;
  commentLabel: string;
  viewDiary: string;
}

export const CAMERA_COPY: Record<AppLocale, CameraCopy> = {
  en: {
    title: "Camera AI",
    description: "Photograph the real plant — the photo joins the growth diary and Jamkachu says what it sees.",
    privacyTitle: "Photo rules",
    privacyPlantOnly: "Photograph the plant only — no friends, no faces!",
    privacyNoNames: "Photos are stored by date on the class plant's shared diary, never under anyone's name.",
    chooseButton: "Take a photo",
    retakeButton: "Retake",
    submitButton: "Save to diary",
    uploading: "Saving your photo…",
    successTitle: "Saved to the growth diary!",
    seedGranted: "First photo today: +1 Seed!",
    seedAlready: "Today's photo Seed was already collected — the diary still grew!",
    retryButton: "Try again",
    failedUpload: "The upload didn't make it (maybe the network napped). Your photo is still here — try again.",
    tooLarge: "That photo is over 5MB. Please take a smaller one.",
    wrongType: "That file isn't a photo. Please choose a JPEG, PNG, or WebP image.",
    notReadyTitle: "Camera is almost ready",
    notReadyBody: "The photo diary storage isn't set up at this school yet. (ops: run supabase/milestone19-photo-diary.sql)",
    commentLabel: "Jamkachu says",
    viewDiary: "Open the growth diary →",
  },
  id: {
    title: "Kamera AI",
    description: "Foto tanaman aslinya — fotonya masuk buku harian pertumbuhan dan Jamkachu bercerita tentang yang dilihatnya.",
    privacyTitle: "Aturan foto",
    privacyPlantOnly: "Foto tanamannya saja, ya — tanpa teman, tanpa wajah!",
    privacyNoNames: "Foto disimpan per tanggal di buku harian bersama tanaman kelas, tidak pernah atas nama siapa pun.",
    chooseButton: "Ambil foto",
    retakeButton: "Foto ulang",
    submitButton: "Simpan ke buku harian",
    uploading: "Menyimpan fotomu…",
    successTitle: "Tersimpan di buku harian pertumbuhan!",
    seedGranted: "Foto pertama hari ini: +1 Benih!",
    seedAlready: "Benih foto hari ini sudah diambil — buku hariannya tetap bertambah!",
    retryButton: "Coba lagi",
    failedUpload: "Unggahan belum berhasil (mungkin jaringannya tidur). Fotomu masih di sini — coba lagi.",
    tooLarge: "Foto itu lebih dari 5MB. Coba ambil foto yang lebih kecil.",
    wrongType: "Berkas itu bukan foto. Pilih gambar JPEG, PNG, atau WebP.",
    notReadyTitle: "Kamera hampir siap",
    notReadyBody: "Penyimpanan buku harian foto belum disiapkan di sekolah ini. (ops: run supabase/milestone19-photo-diary.sql)",
    commentLabel: "Kata Jamkachu",
    viewDiary: "Buka buku harian pertumbuhan →",
  },
};
```

- [ ] Run again: `npx vitest run tests/camera-copy.test.ts` — expect green.
- [ ] Commit: `git add src/app/camera/copy.ts tests/camera-copy.test.ts && git commit -m "feat: camera page bilingual copy with privacy lines"`

---

### Task 5: `src/app/camera/actions.ts` — upload server action (validate → Storage → comment → diary row → Seed grant)

**Files:**
- Create: `src/app/camera/actions.ts`
- Test: covered by Task 2/3 unit tests (validation + comment fallback are the pure parts); the action itself follows the repo convention of untested-thin server actions (`src/app/settings/actions.ts` has no direct test). A build-time type check is the gate here.

**Interfaces:**
- Consumes: `getServerSupabase` (`@/lib/supabase/server`), `getPlant`/`normalizeGrowthStage` (`@/lib/queries`), `getLatestSensorSnapshot` (`@/lib/crop-profile-data`), `validatePhotoUpload`/`photoStoragePath`/`photoRewardKey` (Task 2), `generatePhotoComment` (Task 3), `normalizeLocale` (`@/lib/i18n`), `normalizePersonality` (`@/types/game`), `revalidatePath` (`next/cache`). Optionally consumes the milestone18 `award_seeds(p_plant_id, p_amount, p_reward_key)` RPC — any RPC error (including function-missing when milestone18 is absent) is logged and swallowed.
- Produces (exact exports):
  - `interface CameraActionState { status: "idle" | "success" | "invalid" | "not-ready" | "error"; error: "too_large" | "bad_type" | "upload_failed" | null; photoUrl: string | null; aiComment: string | null; seedGranted: boolean }`
  - `async function uploadPlantPhoto(previousState: CameraActionState, formData: FormData): Promise<CameraActionState>` (`useActionState`-shaped)

**Steps:**

- [ ] Implement `src/app/camera/actions.ts`:

```ts
"use server";

// Camera photo diary server action (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md §Flow).
//
// Order of operations is the error-handling contract:
//   validate (never trust the client) → Storage upload → AI/template
//   comment → growth_records insert → deterministic +1 Seed grant.
// No record row is created until the upload succeeded (no dangling URLs),
// and a Seed-grant failure NEVER fails the action (milestone18 may simply
// not be applied yet — graceful skip, spec §Data).

import { revalidatePath } from "next/cache";
import { getLatestSensorSnapshot } from "@/lib/crop-profile-data";
import { normalizeLocale } from "@/lib/i18n";
import {
  photoRewardKey,
  photoStoragePath,
  validatePhotoUpload,
} from "@/lib/photo-diary";
import { generatePhotoComment } from "@/lib/photo-comment";
import { getPlant, normalizeGrowthStage } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizePersonality } from "@/types/game";

export interface CameraActionState {
  status: "idle" | "success" | "invalid" | "not-ready" | "error";
  error: "too_large" | "bad_type" | "upload_failed" | null;
  photoUrl: string | null;
  aiComment: string | null;
  seedGranted: boolean;
}

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/; // same rule as /api/daily-quiz

/** Storage/PostgREST messages that mean "milestone19 not applied here". */
function isMigrationMissing(message: string): boolean {
  return /bucket not found|photo_url|ai_comment|PGRST204/i.test(message);
}

export async function uploadPlantPhoto(
  _previousState: CameraActionState,
  formData: FormData,
): Promise<CameraActionState> {
  const fail = (
    status: CameraActionState["status"],
    error: CameraActionState["error"] = null,
  ): CameraActionState => ({ status, error, photoUrl: null, aiComment: null, seedGranted: false });

  const supabase = getServerSupabase();
  if (!supabase) return fail("not-ready");

  const rawPlantId = formData.get("plantId");
  const plantId =
    typeof rawPlantId === "string" && VALID_PLANT.test(rawPlantId) ? rawPlantId : "plant-01";
  const locale = normalizeLocale(formData.get("locale"));

  // ── Server-side re-validation (spec §Privacy: never trust the client) ──
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("invalid", "bad_type");
  const validation = validatePhotoUpload({ type: file.type, size: file.size });
  if (!validation.ok) return fail("invalid", validation.error);

  const plantResult = await getPlant(supabase, plantId);
  if (plantResult.status === "no-schema") return fail("not-ready");
  if (plantResult.status !== "ok") return fail("error", "upload_failed");
  const plant = plantResult.plant;

  // ── Storage upload — path never contains a student name ────────────────
  const now = new Date();
  const objectPath = photoStoragePath(plantId, now);
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage
    .from("plant-photos")
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) {
    if (isMigrationMissing(upload.error.message)) return fail("not-ready");
    console.error(`uploadPlantPhoto(${plantId}) storage upload failed:`, upload.error.message);
    return fail("error", "upload_failed");
  }
  const photoUrl = supabase.storage.from("plant-photos").getPublicUrl(objectPath).data.publicUrl;

  // ── Comment layer: Gemini Vision or deterministic sensor template ──────
  // The comment is flavor text only — never parsed for game decisions.
  const snapshot = await getLatestSensorSnapshot(supabase, plantId);
  const { comment } = await generatePhotoComment({
    plantName: plant.name,
    personality: normalizePersonality(plant.personality),
    snapshot,
    locale,
    imageBase64: bytes.toString("base64"),
    imageMimeType: file.type,
  });

  // ── Diary row: the photo diary IS the growth diary ─────────────────────
  // Reuses the plant's current manual stage — a photo is an observation,
  // not a stage change (Growth Stage stays record/manual-driven, §14).
  const stage = normalizeGrowthStage(plant.growth_stage) ?? "New Plant";
  const insert = await supabase.from("growth_records").insert({
    plant_id: plantId,
    stage,
    height_cm: null,
    leaf_count: null,
    note: null,
    photo_url: photoUrl,
    ai_comment: comment,
  });
  if (insert.error) {
    if (isMigrationMissing(insert.error.message)) return fail("not-ready");
    console.error(`uploadPlantPhoto(${plantId}) record insert failed:`, insert.error.message);
    return fail("error", "upload_failed");
  }

  // ── Deterministic +1 Seed for the FIRST photo of the WIB day ───────────
  // Idempotent by ledger key (photo:<wib-date>). milestone18 absent → the
  // RPC errors → we log and continue: the photo save already succeeded.
  let seedGranted = false;
  try {
    const seed = await supabase.rpc("award_seeds", {
      p_plant_id: plantId,
      p_amount: 1,
      p_reward_key: photoRewardKey(now),
    });
    if (seed.error) {
      console.warn(`uploadPlantPhoto(${plantId}) seed grant skipped:`, seed.error.message);
    } else {
      seedGranted = !(seed.data as { duplicate?: boolean } | null)?.duplicate;
    }
  } catch (cause) {
    console.warn(`uploadPlantPhoto(${plantId}) seed grant skipped:`, cause);
  }

  revalidatePath("/diary");
  revalidatePath("/camera");
  return { status: "success", error: null, photoUrl, aiComment: comment, seedGranted };
}
```

- [ ] Type-check + lint the new file compiles against the real surrounding types: `npx tsc --noEmit` — expect zero errors (if `plant.personality` / `plant.name` flag, check `src/types/plant.ts` for the actual field names and adjust).
- [ ] Run the full suite to confirm nothing regressed: `npm test` — expect green.
- [ ] Commit: `git add src/app/camera/actions.ts && git commit -m "feat: camera upload server action (storage, AI comment, diary row, seed grant)"`

---

### Task 6: `/camera` route — server page + client capture component (canvas compression, retry)

**Files:**
- Create: `src/app/camera/page.tsx`
- Create: `src/components/camera-capture.tsx`
- Test: `tests/camera-page.test.ts` (static source assertions, `tests/ui-shell.test.ts` style — no DOM runtime in this repo's vitest setup)

**Interfaces:**
- Consumes: `CAMERA_COPY` (Task 4), `uploadPlantPhoto`/`CameraActionState` (Task 5), `MAX_PHOTO_BYTES` (Task 2), `getRequestLocale` (`@/lib/i18n-server`), `getServerSupabase`, `getPlant`, `Notice` (`@/components/notice`), `PageHeader` (`@/components/page-header`), React 19 `useActionState`/`startTransition`.
- Produces: default export `CameraPage` (async server component); default export `CameraCapture` (client component) with props `{ locale: AppLocale; bucketReady: boolean }`.

**Steps:**

- [ ] Write the failing test `tests/camera-page.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("/camera route", () => {
  it("exists, uses the shared page header, and probes the storage bucket server-side", () => {
    const page = source("src/app/camera/page.tsx");
    expect(page).toContain("<PageHeader");
    expect(page).toContain('from("plant-photos")');
    expect(page).toContain("force-dynamic");
  });

  it("captures via file input (no getUserMedia in MVP) and compresses on canvas", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain('"use client"');
    expect(capture).toContain('accept="image/*"');
    expect(capture).toContain('capture="environment"');
    expect(capture).toContain("1280");
    expect(capture).toContain("0.8");
    expect(capture).not.toContain("getUserMedia");
  });

  it("shows privacy copy and a retry path, and disables capture when the bucket is missing", () => {
    const capture = source("src/components/camera-capture.tsx");
    expect(capture).toContain("privacyPlantOnly");
    expect(capture).toContain("retryButton");
    expect(capture).toContain("bucketReady");
    expect(capture).toContain("notReadyBody");
  });
});
```

- [ ] Run it and watch it fail: `npx vitest run tests/camera-page.test.ts` — expected failure: `ENOENT ... src/app/camera/page.tsx`.
- [ ] Implement `src/app/camera/page.tsx`:

```tsx
// Camera AI — growth photo diary capture screen (spec:
// docs/superpowers/specs/2026-08-09-camera-photo-diary-design.md).
//
// Server component: resolves locale + Supabase setup states (the same
// Notice ladder as /diary) and probes the plant-photos bucket ONCE so the
// client can render the operator "coming soon" note with the camera input
// disabled when milestone19 hasn't been run (spec §Error handling).

import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
import CameraCapture from "@/components/camera-capture";
import { getRequestLocale } from "@/lib/i18n-server";
import { getPlant } from "@/lib/queries";
import { getServerSupabase } from "@/lib/supabase/server";
import { CAMERA_COPY } from "./copy";

export const dynamic = "force-dynamic";

const PLANT_ID = "plant-01";

export default async function CameraPage() {
  const locale = await getRequestLocale();
  const copy = CAMERA_COPY[locale];
  const supabase = getServerSupabase();

  if (!supabase) {
    return (
      <Notice
        title="Connecting..."
        lines={[
          "Supabase environment variables are not set yet.",
          "Copy .env.local.example to .env.local, fill in the values, then restart the dev server.",
          "Full steps: docs/SETUP-milestone1-2.md",
        ]}
      />
    );
  }

  const result = await getPlant(supabase, PLANT_ID);
  if (result.status === "no-schema") {
    return (
      <Notice
        title="Supabase tables don't exist yet"
        lines={[
          "Environment variables are connected, but the schema hasn't been run.",
          "In Supabase Dashboard → SQL Editor, run supabase/milestone1.sql first.",
          "Then refresh this page.",
        ]}
      />
    );
  }
  if (result.status === "error") {
    return (
      <Notice
        title="Supabase connection error"
        lines={[result.message, "Double-check your URL and key values."]}
      />
    );
  }
  if (result.status === "not-found") {
    return (
      <Notice
        title={`No data for ${PLANT_ID}`}
        lines={["Run supabase/milestone1.sql in the Supabase SQL Editor."]}
      />
    );
  }

  // Bucket probe: list() errors when milestone19 hasn't created the bucket.
  // Cheap (limit 1) and server-side only — the browser never sees storage
  // credentials beyond the public read URL.
  const probe = await supabase.storage.from("plant-photos").list("", { limit: 1 });
  const bucketReady = !probe.error;

  return (
    <main className="mx-auto w-full">
      <PageHeader icon="📷" title={copy.title} description={copy.description} />
      <div className="mx-auto w-full max-w-[640px]">
        <CameraCapture locale={locale} bucketReady={bucketReady} />
      </div>
    </main>
  );
}
```

- [ ] Implement `src/components/camera-capture.tsx`:

```tsx
"use client";

// Camera capture + compression client component (spec §Flow 1–3).
//
// MVP capture is <input type="file" capture="environment"> — zero
// permissions ceremony on school-managed Androids; a getUserMedia live
// viewfinder is roadmap, not MVP. Compression happens on-canvas BEFORE
// upload (max edge 1280px, JPEG q0.8) because school networks are slow
// and Storage is metered. The compressed Blob stays in state so a failed
// upload keeps the photo on-page behind a retry button (spec §Error
// handling) — no record row exists until the upload succeeds.

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { uploadPlantPhoto, type CameraActionState } from "@/app/camera/actions";
import { MAX_PHOTO_BYTES } from "@/lib/photo-diary";
import type { AppLocale } from "@/lib/i18n";
import { CAMERA_COPY } from "@/app/camera/copy";

const IDLE_STATE: CameraActionState = {
  status: "idle",
  error: null,
  photoUrl: null,
  aiComment: null,
  seedGranted: false,
};

const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.8;

/** Downscales to a 1280px max edge JPEG (q0.8). Any failure returns the
 *  original file — the server re-validates size/MIME regardless. */
async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolveBlob) =>
      canvas.toBlob(resolveBlob, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function CameraCapture({
  locale,
  bucketReady,
}: {
  locale: AppLocale;
  bucketReady: boolean;
}) {
  const copy = CAMERA_COPY[locale];
  const [state, formAction, pending] = useActionState(uploadPlantPhoto, IDLE_STATE);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<"too_large" | "bad_type" | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setClientError(null);
    if (!file.type.startsWith("image/")) {
      setClientError("bad_type");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setClientError("too_large");
      return;
    }
    const blob = await compressPhoto(file);
    setPhotoBlob(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  function submit() {
    if (!photoBlob || pending) return;
    const data = new FormData();
    data.append("plantId", "plant-01");
    data.append("locale", locale);
    data.append("photo", new File([photoBlob], "photo.jpg", { type: photoBlob.type || "image/jpeg" }));
    startTransition(() => formAction(data));
  }

  const notReady = !bucketReady || state.status === "not-ready";
  const errorCopy =
    clientError === "too_large" || state.error === "too_large"
      ? copy.tooLarge
      : clientError === "bad_type" || state.error === "bad_type"
        ? copy.wrongType
        : state.status === "error"
          ? copy.failedUpload
          : null;

  return (
    <section className="pm-panel flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="pm-heading text-xs">{copy.privacyTitle}</h2>
        <p className="text-[11px] leading-4 text-[#57684F]">{copy.privacyPlantOnly}</p>
        <p className="text-[11px] leading-4 text-[#57684F]">{copy.privacyNoNames}</p>
      </div>

      {notReady ? (
        <p className="rounded-xl border-2 border-dashed border-[#BCD3B4] bg-[#F4FAF1] px-3 py-2 text-xs text-[#57684F]">
          <strong className="block">{copy.notReadyTitle}</strong>
          {copy.notReadyBody}
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL preview; next/image cannot optimize object URLs
            <img
              src={previewUrl}
              alt={copy.chooseButton}
              className="w-full rounded-xl border-2 border-[#DCEAD5]"
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="pm-btn flex-1"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {previewUrl ? copy.retakeButton : copy.chooseButton}
            </button>
            {photoBlob && state.status !== "success" && (
              <button
                type="button"
                className="pm-btn pm-btn-primary flex-1"
                disabled={pending}
                onClick={submit}
              >
                {pending ? copy.uploading : state.status === "error" ? copy.retryButton : copy.submitButton}
              </button>
            )}
          </div>

          {errorCopy && <p className="text-xs text-[#A8552F]">{errorCopy}</p>}

          {state.status === "success" && (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-[#DCEAD5] bg-[#F4FAF1] px-3 py-2">
              <p className="pm-heading text-[10px] uppercase">{copy.successTitle}</p>
              {state.aiComment && (
                <p className="text-xs text-[#3A4A34]">
                  <span className="font-semibold">{copy.commentLabel}: </span>
                  “{state.aiComment}”
                </p>
              )}
              <p className="text-xs text-[#57684F]">
                {state.seedGranted ? copy.seedGranted : copy.seedAlready}
              </p>
              <Link href="/diary" className="text-xs font-semibold text-[#243421] underline">
                {copy.viewDiary}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] Run the test again: `npx vitest run tests/camera-page.test.ts` — expect green.
- [ ] Type-check: `npx tsc --noEmit` — expect zero errors.
- [ ] Commit: `git add src/app/camera/page.tsx src/components/camera-capture.tsx tests/camera-page.test.ts && git commit -m "feat: /camera route with file-input capture, canvas compression, and retry"`

---

### Task 7: Nav enablement — sidebar Camera button live in both navs

**Files:**
- Modify: `src/components/reno-app-shell.tsx` (NAV_ITEMS camera entry, line ~17)
- Modify: `public/farm/index.html` (camera nav span, line ~50 — this file was just touched by the FX workstream: re-read it first, change ONLY this one element)
- Test: `tests/ui-shell.test.ts` (update existing expectations)

**Interfaces:**
- Consumes: existing `NAV_ITEMS` const shape `{ key, href, icon, id, en }` and the `href === null` disabled-branch (which MUST remain — Shop is still disabled until the Seed Shop workstream ships).
- Produces: camera entry `{ key: "camera", href: "/camera", icon: "📷", id: "Kamera AI", en: "Camera AI" }`; farm sidebar `<a href="/camera" class="nav-item">…</a>`. Farm nav copy needs NO strings change — `nav.camera` already exists in `public/farm/live.js` COPY (lines 50/76).

**Steps:**

- [ ] Update `tests/ui-shell.test.ts` FIRST (TDD on the contract): in the first `it(...)` block, change
  - `expect(reactShell).toContain('key: "camera", href: null');` → `expect(reactShell).toContain('key: "camera", href: "/camera"');`
  - add `"/camera"` to the `TAB_HREFS` array (after `"/plants"`).
  - LEAVE `key: "shop", href: null` and the `reno-nav-disabled` expectation untouched (Shop is the remaining disabled tab; if the Seed Shop workstream already flipped it when you get here, keep whatever they asserted for shop and only touch the camera lines).
- [ ] Run and watch it fail: `npx vitest run tests/ui-shell.test.ts` — expected failure: `expected ... to contain 'key: "camera", href: "/camera"'`.
- [ ] In `src/components/reno-app-shell.tsx` change the NAV_ITEMS camera line from:

```ts
  { key: "camera", href: null, icon: "📷", id: "Kamera AI", en: "Camera AI" },
```

to:

```ts
  { key: "camera", href: "/camera", icon: "📷", id: "Kamera AI", en: "Camera AI" },
```

(The `href === null` branch stays — Shop still uses it.)
- [ ] In `public/farm/index.html` (READ THE CURRENT FILE FIRST — FX workstream edits are uncommitted) replace exactly this element:

```html
<span class="nav-item nav-disabled" aria-disabled="true" title="Segera hadir"><i class="icon">📷</i> <span data-i18n="nav.camera">Kamera AI</span></span>
```

with:

```html
<a href="/camera" class="nav-item"><i class="icon">📷</i> <span data-i18n="nav.camera">Kamera AI</span></a>
```

- [ ] Run again: `npx vitest run tests/ui-shell.test.ts` — expect green.
- [ ] Run the full suite (nav strings, shell contracts): `npm test` — expect green.
- [ ] Commit ONLY this task's files (index.html carries unrelated uncommitted FX edits — stage the whole file only if the FX work has already been committed; otherwise use `git add -p public/farm/index.html` to stage just the camera anchor hunk): `git add src/components/reno-app-shell.tsx tests/ui-shell.test.ts && git add -p public/farm/index.html && git commit -m "feat: enable Camera AI nav in both sidebars"`

---

### Task 8: Diary thumbnails — render `photo_url` + `ai_comment` inline in the growth timeline

**Files:**
- Modify: `src/lib/growth.ts` (extend `GrowthRecordRow`)
- Modify: `src/app/diary/page.tsx` (**uncommitted Codex edits exist here** — before editing, run `git status` / re-read the file, apply this change on top of WHATEVER content is present at execution time, and keep the diff strictly inside the `growthRecords.map(...)` card block; do not reformat or reorder anything else)
- Test: `tests/growth.test.ts` untouched (type-only change is compile-checked); visual behavior is covered by the QA task.

**Interfaces:**
- Consumes: `GrowthRecordRow` (Task consumers: `fetchGrowthRecords` already does `select("*")`, so the new columns flow through with zero query changes; pre-milestone19 databases simply return rows without the fields).
- Produces: `GrowthRecordRow` gains `photo_url?: string | null; ai_comment?: string | null` (optional — missing-migration rows stay type-valid).

**Steps:**

- [ ] In `src/lib/growth.ts`, extend the row interface (after the `note` field):

```ts
export interface GrowthRecordRow {
  id: string;
  plant_id: string;
  recorded_at: string;
  stage: GrowthStage;
  height_cm: number | null;
  leaf_count: number | null;
  note: string | null;
  /** Public Storage URL of the growth photo (milestone19); absent/null on
   *  manual records and on databases without the migration. */
  photo_url?: string | null;
  /** Jamkachu's observation line (Gemini or template) — display only,
   *  never parsed for game decisions. */
  ai_comment?: string | null;
  created_at: string;
}
```

- [ ] In `src/app/diary/page.tsx`, inside the `growthRecords.map((record) => { ... })` card `<div>` (currently rendering `dateLabel`, `details`, `record.note`), add photo + comment rendering after the `record.note` line:

```tsx
                    {record.note && <span className="text-[#3A4A34]">{record.note}</span>}
                    {record.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL; next/image would need remotePatterns config
                      <img
                        src={record.photo_url}
                        alt={
                          locale === "id"
                            ? `Foto pertumbuhan ${dateLabel}`
                            : `Growth photo ${dateLabel}`
                        }
                        loading="lazy"
                        className="mt-1 w-full max-w-[240px] rounded-lg border-2 border-[#DCEAD5]"
                      />
                    )}
                    {record.ai_comment && (
                      <span className="italic text-[#57684F]">“{record.ai_comment}”</span>
                    )}
```

(If the Codex edits have restructured the record card, keep the same three additions — guard on `record.photo_url`/`record.ai_comment`, lazy `<img>` capped at 240px, italic quote — wherever the note now renders.)
- [ ] Type-check: `npx tsc --noEmit` — expect zero errors.
- [ ] Run the suite: `npm test` — expect green (records without the columns render exactly as before — both fields are optional and guarded).
- [ ] Commit (same caution as Task 7 if Codex edits are still uncommitted — stage only this hunk): `git add src/lib/growth.ts && git add -p src/app/diary/page.tsx && git commit -m "feat: render photo diary thumbnails and Jamkachu comments in growth timeline"`

---

### Task 9: Runbook row 19 + operator notes

**Files:**
- Modify: `docs/RUNBOOK-filming-and-golive.md` (**has uncommitted edits from concurrent workstreams** — re-read the CURRENT tables first; the Seed Shop workstream may have already added row 18)
- Test: none (docs)

**Steps:**

- [ ] In the ENGLISH migration table (currently ends at `| 17 | milestone17-quiz-kind-scoring.sql | ... |`, around line 47), append after the LAST existing row (17, or 18 if the Seed Shop workstream already added it):

```markdown
| 19 | `milestone19-photo-diary.sql` | `plant-photos` Storage bucket + `growth_records.photo_url`/`ai_comment` — **required before the Camera photo diary can save photos**; without it `/camera` shows an operator "coming soon" note and the diary renders without thumbnails |
```

- [ ] Below the English table's checklist bullets (after the milestone17 bullet, around line 52), add:

```markdown
- [ ] Milestone 19 is required for the Camera photo diary. Without it `/camera` renders a "coming soon" operator note with the camera input disabled — nothing crashes. The +1 Seed first-photo-of-the-day grant additionally needs milestone18; without milestone18 the photo still saves and the grant is skipped silently. AI comments need `GEMINI_API_KEY` in Vercel — without it every photo gets the deterministic sensor-template comment (fully functional).
```

- [ ] Mirror both additions in the INDONESIAN table/checklist (table currently ends around line 173):

```markdown
| 19 | `milestone19-photo-diary.sql` | bucket Storage `plant-photos` + kolom `growth_records.photo_url`/`ai_comment` — **wajib sebelum Camera photo diary bisa menyimpan foto**; tanpanya `/camera` menampilkan catatan operator "hampir siap" dan diary tampil tanpa thumbnail |
```

```markdown
- [ ] Milestone 19 wajib untuk Camera photo diary. Tanpanya `/camera` menampilkan catatan operator dengan input kamera dinonaktifkan — tidak ada yang crash. Hadiah +1 Benih foto-pertama-hari-ini juga membutuhkan milestone18; tanpa milestone18 foto tetap tersimpan dan hadiahnya dilewati diam-diam. Komentar AI membutuhkan `GEMINI_API_KEY` di Vercel — tanpanya setiap foto mendapat komentar template sensor deterministik (tetap berfungsi penuh).
```

- [ ] Commit (stage only these hunks if other workstreams' runbook edits are uncommitted): `git add -p docs/RUNBOOK-filming-and-golive.md && git commit -m "docs: runbook row 19 — camera photo diary migration"`

---

### Task 10: Final QA — full suite, build, invariants sweep

**Files:**
- Modify: none expected (fix-forward only if a check fails)

**Steps:**

- [ ] Full test suite: `npm test` — every test green, including the four new files (`photo-diary`, `photo-comment`, `camera-copy`, `camera-page`) and the updated `ui-shell`.
- [ ] Production build: `npm run build` — completes with zero type errors (this is the gate for the server action + page wiring).
- [ ] Lint: `npm run lint` — no new errors (the two `@next/next/no-img-element` suppressions are annotated inline with reasons).
- [ ] Invariants sweep (read, don't trust memory):
  - `git diff main --stat` (or the task-range diff) contains NO changes to `src/lib/ai.ts`, `src/app/globals.css`, `src/app/api/memory-reflection/`, `src/lib/jamkachu-memory.ts`, `src/lib/farmer-chat.ts`, `public/farm/live.js`, `public/farm/strings.js`, `public/farm/style.css`, `public/farm/demo.js`.
  - `supabase/milestone19-photo-diary.sql` contains only guarded, additive statements.
  - `grep -n "ai_comment" src/` shows the comment is only ever WRITTEN and DISPLAYED — never read back into any engine/reward decision.
  - The only reward call is `award_seeds` with key `photo:<wib-date>` (+1, idempotent) — no `award_xp` call anywhere in the new code (photos grant Seeds, not XP; the weekly growth-record XP bonus in `addGrowthRecord` is intentionally NOT triggered by photo rows since the camera action inserts directly).
- [ ] Manual smoke (requires a Supabase project with milestone19 applied; skippable in CI, listed for the human operator): open `/camera` on a phone, take a plant photo → success card shows a comment; check `/diary` shows the thumbnail; take a second photo the same day → `seedAlready` copy; stop the network mid-upload → photo stays with retry button.
- [ ] Commit any fixes made during QA with focused messages, e.g. `git commit -m "fix: <specific issue found in QA>"`.

---

## Execution Order & Dependencies

```
Task 1 (SQL)          ──┐  independent
Task 2 (pure helpers) ──┼─→ Task 5 (server action) ─→ Task 6 (/camera route) ─→ Task 7 (nav)
Task 3 (comment layer)──┤
Task 4 (copy)         ──┘─→ Task 6
Task 1 ───────────────────→ Task 8 (diary thumbnails), Task 9 (runbook)
All ──────────────────────→ Task 10 (QA, last)
```

- Tasks 1–4 are mutually independent and parallelizable (four different new files, four different test files).
- Task 5 needs Tasks 2 + 3 (imports their symbols). Task 6 needs Tasks 4 + 5. Task 7 needs Task 6 (never link a nav to a 404).
- Task 8 and Task 9 only conceptually depend on Task 1 and can run any time after it; both touch files with concurrent-workstream churn (`src/app/diary/page.tsx`, `docs/RUNBOOK-filming-and-golive.md`, `public/farm/index.html` in Task 7) — ALWAYS re-read those files immediately before editing and stage hunks selectively (`git add -p`).
- Task 10 is strictly last.
- Nothing in this plan blocks on milestone16 (evolution ladder) or milestone18 (Seed Shop); if milestone18's `award_seeds` lands with a different parameter naming than `p_plant_id/p_amount/p_reward_key`, adjust ONLY the `supabase.rpc("award_seeds", ...)` call in Task 5 to match the committed `supabase/milestone18-seed-shop.sql` — the graceful-skip try/catch already isolates the blast radius to "no Seed granted".
