# Camera Live Guardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A demo device mounted facing the REAL plant with `/camera` open watches the video feed continuously. A student stroking a real leaf triggers a deterministic frame-diff `MOTION_START` → the digital Jamkachu giggles INSTANTLY on the camera device (local, zero network) and, via a `camera_events` realtime row, on every farm-home screen. A motion-triggered + periodic (10 min) single-snapshot Gemini Vision pest check produces an advisory line ONLY — language, never truth, never rewards.

**Architecture:** A new `milestone19-camera-guardian.sql` migration adds the `camera_events` table (kind `touch|pest_advice`, jsonb note, realtime; NO storage bucket — nothing visual is ever persisted). A pure, exhaustively unit-tested frame-diff engine (`src/lib/motion-detect.ts`: 64×48 grayscale downscale, rolling EMA baseline, threshold + N-frame debounce, `MOTION_START`/`MOTION_END`, 10s cooldown, 18:00–06:00 WIB suspension) runs client-side in a rebuilt `/camera` React page (getUserMedia viewfinder + Screen Wake Lock + status chip + local mini-Jamkachu + events feed + bilingual privacy banner). Two service-role API routes fan out: `POST /api/camera-events` (validate + ≥10s server-side rate limit + insert, `touch` only) and `POST /api/camera-scan` (ONE ≤200KB JPEG in request memory only → Gemini pest-or-NO_PLANT with 4s timeout → localized advisory + text-only `pest_advice` row; `{disabled:true}` without `GEMINI_API_KEY`). Farm-home `live.js` consumes `camera_events` on an isolated realtime channel: `touch` → tickle via the existing `quickPetResponse` pet-response machinery (never asleep, never first render); `pest_advice` → T1 advisory bubble + why-card. This SUPERSEDES the photo-diary `/camera` (its capture UI and server action are removed; the dormant photo libs and old diary thumbnails stay).

**Tech Stack:** Next.js 16 App Router (READ `node_modules/next/dist/docs/` before writing Next code — this version has breaking changes), React 19, Supabase (Postgres + RLS + realtime, `@supabase/supabase-js` v2), Tailwind 4 + unlayered `pm-*` pixel CSS, Vitest 4, plain-JS farm layer (`public/farm/live.js` + `strings.js`), browser platform APIs only (getUserMedia, Screen Wake Lock, canvas) — **no new dependencies**.

**Spec:** `docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md` (supersedes `2026-08-09-camera-photo-diary-design.md`)

## Global Constraints

- **AI is language-only and reward-free — from ANY camera signal.** No XP, no Seeds, no quests, no bond writes from touch OR pest detection. Camera code (routes, libs, page, farm consumer) never imports `seed-engine`, `bonus-xp`, `event-router`, or calls any `award_*` RPC. Misdetection changes nothing in the game.
- **Video never leaves the device** except the single downscaled ≤200KB snapshot sent for analysis, which lives only in request memory and is **never stored**: no Storage bucket, no `Buffer.from(image)`, no fs writes, no base64 in any DB row. Person visible → Gemini must return the `NO_PLANT` sentinel → snapshot discarded, generic line shown, nothing persisted.
- **Deterministic touch events drive presentation + the `camera_events` log ONLY.** The farm layer stays display-only; `onCameraEventInsert` may animate and speak, never count, grant, or fetch.
- **All player-facing copy exists in en AND id** (typed `Record<AppLocale, ...>` in React copy modules; `strings.js` additions land in BOTH locales — `tests/strings-parity.test.ts` guards them).
- **Graceful degradation:** missing milestone19 → `/camera` still watches and the mini Jamkachu reacts fully locally, with an honest English operator note; missing `GEMINI_API_KEY` → labeled motion-only mode via `{disabled:true}`; camera permission denied / no camera / hidden tab → clear states, auto-resume on visibility. Nothing crashes, nothing queues (events are ephemeral by design — a missed giggle is not data loss).
- **Milestone SQL is additive and re-runnable** (`if not exists`, guarded publication add, no drops). Node-RED legacy tables untouched. `milestone19-photo-diary.sql` stays on disk (already applied at schools) — the runbook marks it superseded.
- **Superseded photo-diary handling:** `/camera`'s page + copy are REPLACED; `src/app/camera/actions.ts`, `src/components/camera-capture.tsx`, and `tests/camera-page.test.ts` are DELETED. `src/lib/photo-diary.ts`, `src/lib/photo-comment.ts` and their unit tests stay untouched (dormant, reserved for the future "growth album"); `/diary` keeps rendering old `photo_url` thumbnails.
- **CONCURRENT-WORK FENCE (re-check `git status` at execution time):** a Codex workstream is actively editing `public/farm/index.html`, `public/farm/live.js`, `public/farm/style.css` (farm clock UI) and owns `src/lib/ai.ts`, `src/app/globals.css`, `src/app/api/memory-reflection/`, `src/lib/jamkachu-memory.ts`, `src/lib/farmer-chat.ts`, and appearance files — never modify those owned files (that is why `src/lib/pest-advisory.ts` duplicates the Gemini plumbing instead of importing `ai.ts`). Farm-layer tasks (Task 8) must **re-read the current file content immediately before every edit**, anchor on the exact text found, and stay strictly additive. New React styles go in a NEW file `src/app/camera/camera.css` — never `globals.css`. Commit only the files each task names (`git add <specific paths>`, never `git add -A` — the tree carries other agents' uncommitted changes).

---

### Task 1: milestone19-camera-guardian.sql

**Files:**
- Create: `supabase/milestone19-camera-guardian.sql`
- Test: `tests/camera-guardian-sql.test.ts` (source-contract test, same style as `tests/seed-shop-sql.test.ts`)

**Interfaces:**
- Consumes: existing `public.plants` (milestone1), `supabase_realtime` publication.
- Produces (SQL):
  - `public.camera_events (id uuid pk default gen_random_uuid(), plant_id text fk, kind text check in ('touch','pest_advice'), occurred_at timestamptz, note jsonb, created_at timestamptz)`
  - index `camera_events_plant_time_idx (plant_id, kind, occurred_at desc)` — the rate-limit lookup path
  - RLS: public READ policy only — all writes go through the service-role API routes
  - guarded `supabase_realtime` publication add
  - **NO storage bucket** (the superseded photo-diary bucket is not recreated; nothing the guardian sees is ever persisted)

**Steps:**

- [ ] Write the failing test `tests/camera-guardian-sql.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the milestone19 invariants: additive + re-runnable, exactly two
// presentation kinds, text/jsonb rows only (the guardian NEVER persists
// what it sees), zero reward surface, browser read-only, realtime on.

const sql = readFileSync(
  resolve(process.cwd(), "supabase/milestone19-camera-guardian.sql"),
  "utf8",
).toLowerCase();

describe("milestone19-camera-guardian.sql", () => {
  it("is additive and re-runnable", () => {
    expect(sql).toContain("create table if not exists public.camera_events");
    expect(sql).toContain("create index if not exists camera_events_plant_time_idx");
    expect(sql).not.toContain("drop table");
  });

  it("allows exactly the two presentation kinds", () => {
    expect(sql).toContain("check (kind in ('touch', 'pest_advice'))");
  });

  it("creates NO storage bucket and no binary columns (nothing visual persists)", () => {
    expect(sql).not.toContain("storage.buckets");
    expect(sql).not.toContain("bytea");
    expect(sql).not.toContain("photo_url");
  });

  it("never touches XP, Bond Level, or the spendable currency (camera grants nothing)", () => {
    expect(sql).not.toMatch(/total_xp/);
    expect(sql).not.toMatch(/bond_level/);
    expect(sql).not.toMatch(/seeds/);
    expect(sql).not.toMatch(/xp_rewards/);
  });

  it("is read-only for browsers: public read policy, no anon write policy, RLS on", () => {
    expect(sql).toContain("alter table public.camera_events enable row level security");
    expect(sql).toContain('create policy "public read camera_events"');
    expect(sql).not.toMatch(/create policy [^;]*(insert|update|delete)/);
  });

  it("adds camera_events to realtime with the guarded pattern", () => {
    expect(sql).toContain("alter publication supabase_realtime add table public.camera_events");
    expect(sql).toContain("exception when duplicate_object then null");
  });
});
```

- [ ] Run it and confirm the failure: `npx vitest run tests/camera-guardian-sql.test.ts` → fails with `ENOENT ... supabase/milestone19-camera-guardian.sql`.
- [ ] Create `supabase/milestone19-camera-guardian.sql` with exactly this content (note: comments deliberately avoid the words the test bans):

```sql
-- PlantMoji · Milestone 19 — Camera Live Guardian events
-- (docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md)
--
-- ADDITIVE ONLY and re-runnable. Requires supabase/milestone1.sql.
-- Supersedes the photo-diary design's milestone19-photo-diary.sql for the
-- /camera route: NO storage bucket is created here, and none is required —
-- the guardian analyzes one downscaled snapshot in memory and persists
-- ONLY text/jsonb rows. Node-RED legacy tables are untouched.
--
-- Trust model: browsers may READ camera_events (the farm layer renders
-- reactions from it); every WRITE goes through the two service-role API
-- routes (/api/camera-events for kind 'touch', /api/camera-scan for kind
-- 'pest_advice'), each with its own >=10s rate limit. Rows are
-- presentation + log only: nothing in this file (or downstream of it) can
-- grant XP, currency, or quests — camera signals are never rewards.

-- ── camera_events ────────────────────────────────────────────────────────
create table if not exists public.camera_events (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants (id),
  kind text not null check (kind in ('touch', 'pest_advice')),
  occurred_at timestamptz not null default now(),
  -- pest_advice rows carry { "message": <advisory line>, "locale": "en"|"id" }.
  -- touch rows carry null. Text only, always.
  note jsonb,
  created_at timestamptz not null default now()
);

-- Rate-limit lookup path: latest row per (plant, kind).
create index if not exists camera_events_plant_time_idx
  on public.camera_events (plant_id, kind, occurred_at desc);

-- ── RLS: browsers read, only the engine writes ──────────────────────────
alter table public.camera_events enable row level security;

drop policy if exists "public read camera_events" on public.camera_events;
create policy "public read camera_events" on public.camera_events
  for select using (true);

-- No write policies on purpose: the service-role key bypasses RLS, and the
-- browser must never write a camera event directly (the API routes own
-- validation + rate limiting).

-- ── Realtime: touches giggle on every farm-home screen ──────────────────
do $$
begin
  alter publication supabase_realtime add table public.camera_events;
exception when duplicate_object then null;
end $$;
```

- [ ] Run again: `npx vitest run tests/camera-guardian-sql.test.ts` → all 6 tests pass.
- [ ] Commit: `git add supabase/milestone19-camera-guardian.sql tests/camera-guardian-sql.test.ts && git commit -m "feat: milestone19 camera guardian schema - camera_events table with realtime"`

---

### Task 2: `src/lib/motion-detect.ts` — pure frame-diff engine

**Files:**
- Create: `src/lib/motion-detect.ts`
- Test: `tests/motion-detect.test.ts`

**Interfaces:**
- Consumes: nothing (pure module — zero imports; runs in browser and vitest alike).
- Produces:
  - `export interface MotionConfig { width; height; sampleFps; diffThreshold; debounceFrames; cooldownMs; baselineAlpha }`
  - `export const MOTION_CONFIG: MotionConfig` — 64×48, 8 fps, threshold 9, debounce 3, cooldown 10 000 ms, alpha 0.08
  - `export function toGrayscale(rgba: Uint8ClampedArray | number[]): Float64Array` (luma 0.299/0.587/0.114)
  - `export function meanAbsDiff(a: Float64Array, b: Float64Array): number`
  - `export function updateBaseline(baseline: Float64Array, frame: Float64Array, alpha: number): void` (in-place EMA)
  - `export type MotionEventKind = "MOTION_START" | "MOTION_END"; export interface MotionEvent { kind; atMs; score }`
  - `export function createMotionDetector(config?: MotionConfig): { pushFrame(gray, nowMs): MotionEvent | null; isActive(): boolean; reset(): void }`
  - `export function isGuardianSuspendedWIB(date?: Date): boolean` — true 18:00–06:00 WIB (18:00 inclusive, 06:00 exclusive), false when the clock is unreadable (fail-open mirrors the live.js `isNightWIB` rule: Intl failure means never night)

**Steps:**

- [ ] Write the failing test `tests/motion-detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MOTION_CONFIG,
  createMotionDetector,
  isGuardianSuspendedWIB,
  meanAbsDiff,
  toGrayscale,
  updateBaseline,
  type MotionConfig,
} from "@/lib/motion-detect";

// Exhaustive synthetic-frame coverage: this engine is the DETERMINISTIC
// half of the guardian (the game-legal half), so its math is pinned hard.

const W = 4;
const H = 3;
const CFG: MotionConfig = {
  width: W,
  height: H,
  sampleFps: 8,
  diffThreshold: 10,
  debounceFrames: 3,
  cooldownMs: 10_000,
  baselineAlpha: 0.5,
};
const frame = (value: number) => new Float64Array(W * H).fill(value);

describe("MOTION_CONFIG", () => {
  it("matches the spec: ~64x48 @ ~8fps, 10s cooldown, real debounce", () => {
    expect(MOTION_CONFIG.width).toBe(64);
    expect(MOTION_CONFIG.height).toBe(48);
    expect(MOTION_CONFIG.sampleFps).toBe(8);
    expect(MOTION_CONFIG.cooldownMs).toBe(10_000);
    expect(MOTION_CONFIG.debounceFrames).toBeGreaterThanOrEqual(2);
    expect(MOTION_CONFIG.diffThreshold).toBeGreaterThan(0);
    expect(MOTION_CONFIG.baselineAlpha).toBeGreaterThan(0);
    expect(MOTION_CONFIG.baselineAlpha).toBeLessThan(1);
  });
});

describe("toGrayscale", () => {
  it("converts RGBA to luma and drops alpha", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 0]);
    const gray = toGrayscale(rgba);
    expect(gray.length).toBe(3);
    expect(gray[0]).toBeCloseTo(0.299 * 255, 3); // pure red
    expect(gray[1]).toBe(0); // black
    expect(gray[2]).toBeCloseTo(255, 3); // white — alpha is ignored
  });
});

describe("meanAbsDiff + updateBaseline", () => {
  it("meanAbsDiff is the plain mean of absolute differences, symmetric", () => {
    expect(meanAbsDiff(frame(50), frame(50))).toBe(0);
    expect(meanAbsDiff(frame(50), frame(80))).toBe(30);
    expect(meanAbsDiff(frame(80), frame(50))).toBe(30);
  });

  it("updateBaseline moves the baseline toward the frame by alpha, in place", () => {
    const baseline = frame(50);
    updateBaseline(baseline, frame(100), 0.5);
    expect(baseline[0]).toBe(75);
    expect(baseline[W * H - 1]).toBe(75);
  });
});

describe("createMotionDetector", () => {
  it("primes silently on the first frame", () => {
    const d = createMotionDetector(CFG);
    expect(d.pushFrame(frame(50), 0)).toBeNull();
    expect(d.isActive()).toBe(false);
  });

  it("fires MOTION_START on exactly the Nth consecutive motion frame, once", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0); // baseline
    expect(d.pushFrame(frame(80), 125)).toBeNull(); // run 1
    expect(d.pushFrame(frame(80), 250)).toBeNull(); // run 2
    const start = d.pushFrame(frame(80), 375); // run 3 → fire
    expect(start).toMatchObject({ kind: "MOTION_START", atMs: 375 });
    expect(start?.score).toBe(30);
    expect(d.isActive()).toBe(true);
    expect(d.pushFrame(frame(80), 500)).toBeNull(); // sustained motion stays silent
  });

  it("single-frame spikes and flicker never debounce into a START", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    expect(d.pushFrame(frame(90), 125)).toBeNull();
    expect(d.pushFrame(frame(50), 250)).toBeNull(); // calm — run resets
    expect(d.pushFrame(frame(90), 375)).toBeNull();
    expect(d.pushFrame(frame(50), 500)).toBeNull();
    expect(d.isActive()).toBe(false);
  });

  it("fires MOTION_END after debounceFrames calm frames, then enforces the 10s cooldown", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.pushFrame(frame(80), 250);
    expect(d.pushFrame(frame(80), 375)?.kind).toBe("MOTION_START");
    expect(d.pushFrame(frame(50), 500)).toBeNull(); // calm 1
    expect(d.pushFrame(frame(50), 625)).toBeNull(); // calm 2
    const end = d.pushFrame(frame(50), 750); // calm 3 → END
    expect(end).toMatchObject({ kind: "MOTION_END", atMs: 750 });
    expect(d.isActive()).toBe(false);
    // Cooldown: 750 + 10_000 = 10_750. Motion inside it never STARTs...
    expect(d.pushFrame(frame(80), 875)).toBeNull();
    expect(d.pushFrame(frame(80), 1_000)).toBeNull();
    expect(d.pushFrame(frame(80), 1_125)).toBeNull(); // debounce met, still cooling
    expect(d.pushFrame(frame(80), 5_000)).toBeNull();
    // ...and fires on the first debounced frame past it.
    expect(d.pushFrame(frame(80), 11_000)?.kind).toBe("MOTION_START");
  });

  it("absorbs slow lighting drift into the rolling baseline (no false START)", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    let fired: unknown = null;
    for (let i = 1; i <= 30; i += 1) {
      fired = d.pushFrame(frame(50 + i * 2), i * 125) ?? fired; // +60 total drift
    }
    expect(fired).toBeNull();
  });

  it("does NOT absorb motion frames into the baseline (a held hand keeps diffing)", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.pushFrame(frame(80), 250);
    const start = d.pushFrame(frame(80), 375);
    // If motion frames leaked into the EMA, the diff would have decayed
    // below threshold before the third frame. Score must still be full.
    expect(start?.score).toBe(30);
  });

  it("reset() returns to the pristine primed-on-next-frame state", () => {
    const d = createMotionDetector(CFG);
    d.pushFrame(frame(50), 0);
    d.pushFrame(frame(80), 125);
    d.reset();
    expect(d.isActive()).toBe(false);
    expect(d.pushFrame(frame(80), 250)).toBeNull(); // new baseline, not motion
    expect(d.pushFrame(frame(80), 375)).toBeNull(); // diff 0 vs new baseline
  });
});

describe("isGuardianSuspendedWIB", () => {
  it("suspends 18:00-06:00 WIB — 18:00 inclusive, 06:00 exclusive", () => {
    // WIB = UTC+7: 18:00 WIB == 11:00Z, 06:00 WIB == 23:00Z (prev day).
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T11:00:00Z"))).toBe(true); // 18:00
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T10:59:00Z"))).toBe(false); // 17:59
    expect(isGuardianSuspendedWIB(new Date("2026-08-08T22:59:00Z"))).toBe(true); // 05:59
    expect(isGuardianSuspendedWIB(new Date("2026-08-08T23:00:00Z"))).toBe(false); // 06:00
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T17:00:00Z"))).toBe(true); // 00:00 (midnight)
    expect(isGuardianSuspendedWIB(new Date("2026-08-09T05:00:00Z"))).toBe(false); // 12:00 (noon)
  });

  it("fails open (not suspended) when the clock is unreadable", () => {
    expect(isGuardianSuspendedWIB(new Date(Number.NaN))).toBe(false);
  });
});
```

- [ ] Run: `npx vitest run tests/motion-detect.test.ts` → fails (`Cannot find module '@/lib/motion-detect'`).
- [ ] Create `src/lib/motion-detect.ts`:

```ts
// Deterministic frame-diff motion engine for the Camera Live Guardian
// (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// PURE MODULE — zero imports, zero DOM. The /camera page owns the canvas
// work (drawImage + getImageData) and feeds raw RGBA here; everything below
// is plain math, which is what makes the touch reaction sensor-truth-legal:
// no AI anywhere in this file, and nothing downstream of a MotionEvent may
// ever grant XP, Seeds, or quests (presentation + log only).
//
// Pipeline per sampled frame (~8 fps):
//   RGBA 64×48 → toGrayscale → meanAbsDiff vs rolling baseline →
//   threshold → N-consecutive-frames debounce → MOTION_START / MOTION_END,
//   with a 10 s cooldown between motion episodes and an EMA baseline that
//   absorbs slow lighting drift (clouds, curtains) but never absorbs the
//   motion frames themselves (a resting hand keeps diffing until it leaves).

export interface MotionConfig {
  /** Downscale target, px. Small on purpose: 64×48 ≈ 3k pixels per diff. */
  width: number;
  height: number;
  /** Sampling rate the page should drive pushFrame at (informational). */
  sampleFps: number;
  /** Mean absolute grayscale diff (0–255 scale) that counts as motion. */
  diffThreshold: number;
  /** Consecutive frames over/under threshold to enter/leave motion. */
  debounceFrames: number;
  /** Minimum quiet gap between MOTION_END and the next MOTION_START. */
  cooldownMs: number;
  /** EMA weight for baseline updates on calm frames (0 < alpha < 1). */
  baselineAlpha: number;
}

export const MOTION_CONFIG: MotionConfig = {
  width: 64,
  height: 48,
  sampleFps: 8,
  diffThreshold: 9,
  debounceFrames: 3,
  cooldownMs: 10_000,
  baselineAlpha: 0.08,
};

/** ITU-R BT.601 luma. Input is RGBA (4 bytes/px); output one value per px. */
export function toGrayscale(rgba: Uint8ClampedArray | number[]): Float64Array {
  const out = new Float64Array(Math.floor(rgba.length / 4));
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    out[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return out;
}

/** Plain mean of absolute per-pixel differences (0–255 scale). */
export function meanAbsDiff(a: Float64Array, b: Float64Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** In-place EMA: baseline += alpha * (frame - baseline). */
export function updateBaseline(baseline: Float64Array, frame: Float64Array, alpha: number): void {
  const n = Math.min(baseline.length, frame.length);
  for (let i = 0; i < n; i += 1) baseline[i] += alpha * (frame[i] - baseline[i]);
}

export type MotionEventKind = "MOTION_START" | "MOTION_END";

export interface MotionEvent {
  kind: MotionEventKind;
  /** The nowMs the caller passed for the frame that fired the transition. */
  atMs: number;
  /** meanAbsDiff score of that frame — surfaced for debugging/QA overlays. */
  score: number;
}

export interface MotionDetector {
  /** Feed one grayscale frame; returns a transition event or null. */
  pushFrame(gray: Float64Array, nowMs: number): MotionEvent | null;
  isActive(): boolean;
  /** Full re-prime (used after tab-hidden pauses: a stale baseline is noise). */
  reset(): void;
}

export function createMotionDetector(config: MotionConfig = MOTION_CONFIG): MotionDetector {
  let baseline: Float64Array | null = null;
  let motionRun = 0;
  let calmRun = 0;
  let active = false;
  let cooldownUntil = 0;

  return {
    isActive: () => active,
    reset() {
      baseline = null;
      motionRun = 0;
      calmRun = 0;
      active = false;
      cooldownUntil = 0;
    },
    pushFrame(gray: Float64Array, nowMs: number): MotionEvent | null {
      if (!baseline) {
        baseline = Float64Array.from(gray); // first frame primes silently
        return null;
      }
      const score = meanAbsDiff(gray, baseline);
      const moving = score >= config.diffThreshold;
      // Adaptive baseline: calm frames teach it the room (lighting drift);
      // motion frames NEVER do — otherwise a slow stroke would erase itself.
      if (!moving) updateBaseline(baseline, gray, config.baselineAlpha);

      if (!active) {
        motionRun = moving ? motionRun + 1 : 0;
        if (motionRun >= config.debounceFrames && nowMs >= cooldownUntil) {
          active = true;
          motionRun = 0;
          calmRun = 0;
          return { kind: "MOTION_START", atMs: nowMs, score };
        }
        return null;
      }

      calmRun = moving ? 0 : calmRun + 1;
      if (calmRun >= config.debounceFrames) {
        active = false;
        calmRun = 0;
        cooldownUntil = nowMs + config.cooldownMs; // per-event cooldown
        return { kind: "MOTION_END", atMs: nowMs, score };
      }
      return null;
    },
  };
}

// ── Night suspension (spec: 18:00–06:00 WIB) ─────────────────────────────
// Dark frames are noise and Jamkachu sleeps — mirrors live.js's night
// window (SLEEP_START_HOUR/SLEEP_END_HOUR) including the "Intl failure ⇒
// never night" fail-open, so a broken clock never silently kills the demo.

export const GUARDIAN_SUSPEND_START_HOUR = 18; // inclusive, WIB
export const GUARDIAN_SUSPEND_END_HOUR = 6; // exclusive, WIB

export function isGuardianSuspendedWIB(date: Date = new Date()): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        hour12: false,
      }).format(date),
    );
    if (!Number.isFinite(hour)) return false;
    const h = hour % 24; // some engines print midnight as "24"
    return h >= GUARDIAN_SUSPEND_START_HOUR || h < GUARDIAN_SUSPEND_END_HOUR;
  } catch {
    return false;
  }
}
```

- [ ] Run again: `npx vitest run tests/motion-detect.test.ts` → all tests pass.
- [ ] Commit: `git add src/lib/motion-detect.ts tests/motion-detect.test.ts && git commit -m "feat: pure frame-diff motion engine with WIB night suspension"`

---

### Task 3: Guardian page copy — replace `src/app/camera/copy.ts`

The photo-diary copy module is REPLACED wholesale (same path, same `CAMERA_COPY` export name, new shape) so every consumer import stays stable. `tests/camera-copy.test.ts` is rewritten for the new shape.

**Files:**
- Replace: `src/app/camera/copy.ts`
- Replace: `tests/camera-copy.test.ts`

**Interfaces:**
- Consumes: `AppLocale` from `@/lib/i18n`.
- Produces: `export interface CameraCopy { title; description; privacyTitle; privacyLine1; privacyLine2; statusStarting; statusWatching; statusMotion; statusChecking; statusSuspended; statusHidden; motionOnlyLabel; guardianOfflineNote; eventsTitle; eventTouch; eventPest; eventsEmpty; deniedTitle; deniedBody; noCameraTitle; noCameraBody; scanGeneric }` and `export const CAMERA_COPY: Record<AppLocale, CameraCopy>`. Consumed by the page (Task 7) AND the scan route (Task 6 — `scanGeneric`).

**Steps:**

- [ ] Rewrite `tests/camera-copy.test.ts` FIRST (failing against the old module):

```ts
import { describe, expect, it } from "vitest";
import { CAMERA_COPY } from "@/app/camera/copy";

// en/id parity + the load-bearing privacy and degradation promises of the
// Live Guardian copy (spec §/camera page). The typed Record already pins
// key parity at compile time; this guards content at runtime.

function leafPaths(node: unknown, prefix = "", out: string[] = []): string[] {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    for (const key of Object.keys(node)) {
      leafPaths((node as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

describe("CAMERA_COPY (Live Guardian)", () => {
  it("en and id expose the identical key tree with non-empty values", () => {
    expect(leafPaths(CAMERA_COPY.en).sort()).toEqual(leafPaths(CAMERA_COPY.id).sort());
    for (const locale of ["en", "id"] as const) {
      for (const [key, value] of Object.entries(CAMERA_COPY[locale])) {
        expect(String(value).trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("carries the privacy promise: video stays on-device, snapshot never stored", () => {
    expect(CAMERA_COPY.en.privacyLine1).toContain("never leaves");
    expect(CAMERA_COPY.en.privacyLine2).toContain("never stored");
    expect(CAMERA_COPY.id.privacyLine2).toContain("tanpa disimpan");
  });

  it("names the exact migration in the operator note (graceful-degradation contract)", () => {
    for (const locale of ["en", "id"] as const) {
      expect(CAMERA_COPY[locale].guardianOfflineNote).toContain("milestone19-camera-guardian.sql");
    }
  });

  it("labels motion-only mode honestly when the AI half is off", () => {
    expect(CAMERA_COPY.en.motionOnlyLabel).toContain("GEMINI_API_KEY");
    expect(CAMERA_COPY.id.motionOnlyLabel).toContain("GEMINI_API_KEY");
  });

  it("keeps the status chips scannable (emoji-led, spec: 👀 / ✋ / 🔍)", () => {
    for (const locale of ["en", "id"] as const) {
      expect(CAMERA_COPY[locale].statusWatching).toContain("👀");
      expect(CAMERA_COPY[locale].statusMotion).toContain("✋");
      expect(CAMERA_COPY[locale].statusChecking).toContain("🔍");
    }
  });
});
```

- [ ] Run: `npx vitest run tests/camera-copy.test.ts` → fails (old shape has none of these keys).
- [ ] Replace the entire content of `src/app/camera/copy.ts` with:

```ts
// Camera Live Guardian — bilingual page copy (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md;
// supersedes the photo-diary copy that lived here). Typed Record keeps
// en/id parity at compile time; tests/camera-copy.test.ts guards content.
// Pure data — importable from server routes and client components alike
// (the scan route reads scanGeneric).

import type { AppLocale } from "@/lib/i18n";

export interface CameraCopy {
  title: string;
  description: string;
  privacyTitle: string;
  /** The load-bearing promise: video never leaves the device. */
  privacyLine1: string;
  /** One snapshot at analysis time, never stored. */
  privacyLine2: string;
  statusStarting: string;
  statusWatching: string;
  statusMotion: string;
  statusChecking: string;
  statusSuspended: string;
  statusHidden: string;
  /** Shown whenever pest scanning is off (no GEMINI_API_KEY / disabled). */
  motionOnlyLabel: string;
  /** milestone19 missing: local-only mode, honest operator note. */
  guardianOfflineNote: string;
  eventsTitle: string;
  eventTouch: string;
  eventPest: string;
  eventsEmpty: string;
  deniedTitle: string;
  deniedBody: string;
  noCameraTitle: string;
  noCameraBody: string;
  /** Shown when a snapshot was discarded (NO_PLANT sentinel — person seen). */
  scanGeneric: string;
}

export const CAMERA_COPY: Record<AppLocale, CameraCopy> = {
  en: {
    title: "Camera AI",
    description:
      "Mount this screen facing the real plant — Jamkachu feels touches instantly and keeps a gentle pest watch.",
    privacyTitle: "Privacy promise",
    privacyLine1: "The video never leaves this device.",
    privacyLine2:
      "Only one small snapshot is checked at the moment of analysis — and it is never stored.",
    statusStarting: "Starting camera…",
    statusWatching: "👀 Watching",
    statusMotion: "✋ Motion!",
    statusChecking: "🔍 Checking…",
    statusSuspended: "🌙 Night rest (18:00–06:00 WIB) — Jamkachu is sleeping",
    statusHidden: "⏸️ Paused — bring this tab back to keep watching",
    motionOnlyLabel: "Motion-only mode — pest checks are off (no GEMINI_API_KEY set)",
    guardianOfflineNote:
      "Reactions stay on this screen only for now. (ops: run supabase/milestone19-camera-guardian.sql to fan the giggle out to the farm)",
    eventsTitle: "Recent moments",
    eventTouch: "Something brushed the plant — Jamkachu giggled!",
    eventPest: "Pest watch",
    eventsEmpty: "All quiet so far — Jamkachu is watching happily.",
    deniedTitle: "Camera permission needed",
    deniedBody:
      "The guardian can't see without the camera. Allow camera access for this site in the browser, then reload this page.",
    noCameraTitle: "No camera found",
    noCameraBody:
      "This device has no usable camera. Open /camera on a device with one and mount it facing the plant.",
    scanGeneric: "I peeked but couldn't check properly this time — let's try again soon!",
  },
  id: {
    title: "Kamera AI",
    description:
      "Pasang layar ini menghadap tanaman asli — Jamkachu merasakan sentuhan seketika dan ikut mengawasi hama.",
    privacyTitle: "Janji privasi",
    privacyLine1: "Video tidak pernah keluar dari perangkat ini.",
    privacyLine2:
      "Hanya satu cuplikan kecil yang diperiksa saat analisis — dan tanpa disimpan.",
    statusStarting: "Menyalakan kamera…",
    statusWatching: "👀 Mengawasi",
    statusMotion: "✋ Ada gerakan!",
    statusChecking: "🔍 Memeriksa…",
    statusSuspended: "🌙 Istirahat malam (18.00–06.00 WIB) — Jamkachu sedang tidur",
    statusHidden: "⏸️ Jeda — buka kembali tab ini untuk terus mengawasi",
    motionOnlyLabel: "Mode gerakan saja — pemeriksaan hama mati (GEMINI_API_KEY belum diatur)",
    guardianOfflineNote:
      "Untuk sekarang reaksinya hanya di layar ini. (ops: run supabase/milestone19-camera-guardian.sql untuk meneruskan kikikan ke layar kebun)",
    eventsTitle: "Momen terbaru",
    eventTouch: "Ada yang menyentuh tanaman — Jamkachu terkikik!",
    eventPest: "Pengawas hama",
    eventsEmpty: "Masih tenang — Jamkachu mengawasi dengan senang.",
    deniedTitle: "Butuh izin kamera",
    deniedBody:
      "Penjaga tidak bisa melihat tanpa kamera. Izinkan akses kamera untuk situs ini di browser, lalu muat ulang halaman.",
    noCameraTitle: "Kamera tidak ditemukan",
    noCameraBody:
      "Perangkat ini tidak punya kamera yang bisa dipakai. Buka /camera di perangkat berkamera dan pasang menghadap tanaman.",
    scanGeneric: "Aku sudah mengintip tapi belum bisa memeriksa kali ini — coba lagi sebentar ya!",
  },
};
```

- [ ] Run again: `npx vitest run tests/camera-copy.test.ts` → passes. (The old `/camera` page and capture component still compile against the OLD keys until Task 7 replaces them — do NOT run `npm run build` between Task 3 and Task 7; run the vitest suites only. If Task 7 is executed by a different worker, execute Tasks 3 and 7 in the same session or back-to-back.)
- [ ] Commit: `git add src/app/camera/copy.ts tests/camera-copy.test.ts && git commit -m "feat: replace camera copy with Live Guardian bilingual copy"`

---

### Task 4: `src/lib/pest-advisory.ts` — Gemini Vision pest-or-NO_PLANT layer

**Files:**
- Create: `src/lib/pest-advisory.ts`
- Test: `tests/pest-advisory.test.ts`

**Interfaces:**
- Consumes: `AppLocale` from `@/lib/i18n`, `process.env.GEMINI_API_KEY`, global `fetch`. **Never imports `src/lib/ai.ts`** (Codex-owned) — it mirrors `src/lib/photo-comment.ts`'s standalone-vision contract instead.
- Produces:
  - `export type PestScanOutcome = { status: "disabled" } | { status: "clear" } | { status: "discarded" } | { status: "pest"; advisory: string }`
  - `export const NO_PLANT_SENTINEL = "NO_PLANT"; export const NO_PEST_SENTINEL = "NONE";`
  - `export async function analyzePestSnapshot(input: { imageBase64: string; mimeType: string; locale: AppLocale }): Promise<PestScanOutcome>` — never throws, never blocks past ~4s.

**Steps:**

- [ ] Write the failing test `tests/pest-advisory.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_PEST_SENTINEL,
  NO_PLANT_SENTINEL,
  analyzePestSnapshot,
} from "@/lib/pest-advisory";

// Every failure path collapses to { status: "disabled" } (motion-only mode)
// and a person in frame collapses to { status: "discarded" } — the module
// must never throw and never leak an advisory built from a person.

const INPUT = { imageBase64: "aGVsbG8=", mimeType: "image/jpeg", locale: "en" as const };

function geminiReply(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analyzePestSnapshot", () => {
  it("is disabled without GEMINI_API_KEY — and never calls the network", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps the NONE sentinel to clear (nothing shown, nothing persisted)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(NO_PEST_SENTINEL)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "clear" });
  });

  it("maps the NO_PLANT sentinel to discarded (person in frame)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(NO_PLANT_SENTINEL)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "discarded" });
  });

  it("returns the advisory line verbatim on a pest verdict", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const line = "Something tickles! Can you check my leaves? 🐛";
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(line)));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "pest", advisory: line });
  });

  it("treats overlong replies as disabled (malformed contract)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply("x".repeat(500))));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
  });

  it("treats non-2xx, malformed JSON, and network throws as disabled", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ nope: 1 }) })));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "disabled" });
  });

  it("is disabled on an empty image (never calls the network with nothing)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(
      await analyzePestSnapshot({ ...INPUT, imageBase64: "" }),
    ).toEqual({ status: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("catches a sentinel even when the model wraps it in chatter", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply("Sorry — NO_PLANT")));
    expect(await analyzePestSnapshot(INPUT)).toEqual({ status: "discarded" });
  });
});
```

- [ ] Run: `npx vitest run tests/pest-advisory.test.ts` → fails (module not found).
- [ ] Create `src/lib/pest-advisory.ts`:

```ts
// Pest scan — Gemini Vision advisory layer for the Camera Live Guardian
// (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// Mirrors src/lib/photo-comment.ts's standalone-vision contract (src/lib/ai.ts
// is text-only and owned by a concurrent workstream — never import it):
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

/** Extracts the first non-empty text part, tolerating any malformed shape
 *  by returning null (same defensive walk as src/lib/photo-comment.ts). */
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
```

- [ ] Run again: `npx vitest run tests/pest-advisory.test.ts` → all tests pass.
- [ ] Commit: `git add src/lib/pest-advisory.ts tests/pest-advisory.test.ts && git commit -m "feat: pest advisory Gemini Vision layer with NO_PLANT discard contract"`

---

### Task 5: `POST /api/camera-events` — validated, rate-limited touch fan-out

**Files:**
- Create: `src/app/api/camera-events/route.ts`
- Test: `tests/camera-events-api.test.ts` (route-level, mocked Supabase — same `vi.hoisted` convention as `tests/environment-scan-api.test.ts`)

**Interfaces:**
- Consumes: `getServerSupabase` (`@/lib/supabase/server`), `camera_events` table (Task 1).
- Produces: `POST` handler. Contract:
  - body `{ plantId?: string, kind: "touch", occurredAt?: ISO string }` — **only `"touch"` is ever accepted from the network**; `pest_advice` rows are created exclusively by `/api/camera-scan` server-side.
  - 400 invalid JSON / kind / plantId / occurredAt · 503 no Supabase or `migration_required` · 429 `rate_limited` (<10s since the last touch row) · 500 database error · 200 `{ ok: true }`.
  - The stored `occurred_at` is SERVER time (never trust a device clock); the client `occurredAt` is validated-but-advisory context only.

**Steps:**

- [ ] Write the failing test `tests/camera-events-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));

import { POST } from "@/app/api/camera-events/route";

// Table-aware stub: the route reads the latest touch row (rate limit) and
// then inserts. Chain methods self-return; awaiting the chain resolves the
// select responder; insert is a spy so tests can assert row shape.

interface StubError { code?: string; message: string }

function makeSupabase(options: {
  lastTouch?: string | null;
  selectError?: StubError | null;
  insertError?: StubError | null;
} = {}) {
  const insert = vi.fn(async () => ({ error: options.insertError ?? null }));
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) chain[method] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(
      options.selectError
        ? { data: null, error: options.selectError }
        : { data: options.lastTouch ? [{ occurred_at: options.lastTouch }] : [], error: null },
    ).then(resolve);
  return { from: vi.fn(() => ({ ...chain, insert })), insert };
}

function request(body: unknown) {
  return new Request("http://localhost/api/camera-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MISSING_TABLE: StubError = {
  code: "PGRST205",
  message: "Could not find the table 'public.camera_events' in the schema cache",
};

describe("POST /api/camera-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/camera-events", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects every kind except touch — the browser can NEVER forge a pest_advice row", async () => {
    for (const kind of ["pest_advice", "TOUCH", "", 7, null, undefined]) {
      const response = await POST(request({ kind }));
      expect(response.status, `kind=${String(kind)}`).toBe(400);
    }
  });

  it("rejects a malformed plantId and a malformed occurredAt", async () => {
    expect((await POST(request({ kind: "touch", plantId: "not ok!" }))).status).toBe(400);
    expect((await POST(request({ kind: "touch", occurredAt: "yesterday-ish" }))).status).toBe(400);
  });

  it("503s when Supabase is not configured", async () => {
    mocks.getServerSupabase.mockReturnValue(null);
    expect((await POST(request({ kind: "touch" }))).status).toBe(503);
  });

  it("503s migration_required while milestone19 is missing — graceful, no crash, no insert", async () => {
    const supabase = makeSupabase({ selectError: MISSING_TABLE });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("migration_required");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rate-limits: a touch within 10s of the last row is 429 with no insert", async () => {
    const supabase = makeSupabase({ lastTouch: new Date(Date.now() - 3_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch", occurredAt: new Date().toISOString() }));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("rate_limited");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("inserts a server-timestamped touch row once the 10s gap is respected", async () => {
    const supabase = makeSupabase({ lastTouch: new Date(Date.now() - 60_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request({ kind: "touch", occurredAt: new Date().toISOString() }));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const row = supabase.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ plant_id: "plant-01", kind: "touch", note: null });
    expect(typeof row.occurred_at).toBe("string");
  });

  it("accepts the very first event (empty table)", async () => {
    const supabase = makeSupabase({ lastTouch: null });
    mocks.getServerSupabase.mockReturnValue(supabase);
    expect((await POST(request({ kind: "touch" }))).status).toBe(200);
    expect(supabase.insert).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] Run: `npx vitest run tests/camera-events-api.test.ts` → fails (route module missing).
- [ ] Create `src/app/api/camera-events/route.ts`:

```ts
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/camera-events — deterministic touch fan-out from the guardian
 * camera page (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
 *
 * PRESENTATION + LOG ONLY: this route inserts one camera_events row and
 * nothing else — no XP, no Seeds, no quests, no bond writes, ever (project
 * invariant: camera signals are never rewards). The browser may only report
 * kind "touch"; pest_advice rows are created exclusively by /api/camera-scan.
 *
 * Rate limit (≥10s between rows) is enforced HERE against the table's own
 * latest row, so a stuck client, a reload loop, or a hand waved at the lens
 * can never flood the farm with giggles. Events are ephemeral by design:
 * a rejected or lost event is a missed giggle, not data loss.
 */

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/; // same rule as /api/daily-quiz
const MIN_GAP_MS = 10_000;

/** PostgREST "missing from schema cache": milestone19 hasn't been run. */
function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const plantId = typeof body.plantId === "string" ? body.plantId : "plant-01";
  if (!VALID_PLANT.test(plantId)) {
    return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });
  }
  if (body.kind !== "touch") {
    return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  // occurredAt is advisory client context only — the rate limit and the
  // stored timestamp both use SERVER time (never trust a device clock).
  if (
    body.occurredAt !== undefined &&
    (typeof body.occurredAt !== "string" || Number.isNaN(Date.parse(body.occurredAt)))
  ) {
    return Response.json({ ok: false, error: "invalid_occurred_at" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase is not configured (check .env.local)" },
      { status: 503 },
    );
  }

  const { data: lastRows, error: lastError } = await supabase
    .from("camera_events")
    .select("occurred_at")
    .eq("plant_id", plantId)
    .eq("kind", "touch")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (lastError) {
    if (isMissingSchemaError(lastError)) {
      return Response.json({ ok: false, error: "migration_required" }, { status: 503 });
    }
    console.error(`camera-events(${plantId}) rate-limit read failed:`, lastError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }

  const lastAt = lastRows?.[0]?.occurred_at ? Date.parse(String(lastRows[0].occurred_at)) : null;
  const now = Date.now();
  if (lastAt !== null && Number.isFinite(lastAt) && now - lastAt < MIN_GAP_MS) {
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const { error: insertError } = await supabase.from("camera_events").insert({
    plant_id: plantId,
    kind: "touch",
    occurred_at: new Date(now).toISOString(),
    note: null,
  });
  if (insertError) {
    if (isMissingSchemaError(insertError)) {
      return Response.json({ ok: false, error: "migration_required" }, { status: 503 });
    }
    console.error(`camera-events(${plantId}) insert failed:`, insertError.message);
    return Response.json({ ok: false, error: "database error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
```

- [ ] Run again: `npx vitest run tests/camera-events-api.test.ts` → all tests pass.
- [ ] Commit: `git add src/app/api/camera-events/route.ts tests/camera-events-api.test.ts && git commit -m "feat: camera-events route - validated, server-rate-limited touch fan-out"`

---

### Task 6: `POST /api/camera-scan` — one in-memory snapshot, advisory out

**Files:**
- Create: `src/app/api/camera-scan/route.ts`
- Test: `tests/camera-scan-api.test.ts`

**Interfaces:**
- Consumes: `analyzePestSnapshot` (Task 4), `CAMERA_COPY[locale].scanGeneric` (Task 3), `normalizeLocale` (`@/lib/i18n`), `getServerSupabase`, `camera_events` (Task 1).
- Produces: `POST` handler. Contract:
  - body `{ plantId?: string, imageBase64: string, mimeType: "image/jpeg", locale?: string }`; base64 decoded size ≤ 200KB.
  - 400 invalid JSON / plant / `bad_type` / `bad_image` / `too_large`.
  - `{ ok: true, disabled: true }` whenever the advisory layer is off (no key, timeout, network, malformed) — the client drops to labeled motion-only mode.
  - `{ ok: true, verdict: "none" }` on a clear scan; `{ ok: true, verdict: "none", advisory: scanGeneric }` when the snapshot was discarded (person in frame) — **nothing persisted in either case**.
  - `{ ok: true, verdict: "pest", advisory }` on a pest verdict, plus a best-effort TEXT-ONLY `pest_advice` row (own ≥10s rate limit; missing milestone19 or insert failure still returns the advisory).
  - **The image is NEVER persisted**: no `supabase.storage`, no fs, not even `Buffer.from` — the base64 string is only length-checked and forwarded to Gemini.

**Steps:**

- [ ] Write the failing test `tests/camera-scan-api.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  analyzePestSnapshot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }));
vi.mock("@/lib/pest-advisory", () => ({ analyzePestSnapshot: mocks.analyzePestSnapshot }));

import { POST } from "@/app/api/camera-scan/route";
import { CAMERA_COPY } from "@/app/camera/copy";

const SMALL_JPEG_B64 = "aGVsbG8taGVsbG8="; // any valid base64, well under 200KB

interface StubError { code?: string; message: string }

function makeSupabase(options: {
  lastAdvice?: string | null;
  selectError?: StubError | null;
  insertError?: StubError | null;
} = {}) {
  const insert = vi.fn(async () => ({ error: options.insertError ?? null }));
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) chain[method] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(
      options.selectError
        ? { data: null, error: options.selectError }
        : { data: options.lastAdvice ? [{ occurred_at: options.lastAdvice }] : [], error: null },
    ).then(resolve);
  return { from: vi.fn(() => ({ ...chain, insert })), insert };
}

function request(body: unknown) {
  return new Request("http://localhost/api/camera-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  plantId: "plant-01",
  imageBase64: SMALL_JPEG_B64,
  mimeType: "image/jpeg",
  locale: "en",
};

describe("POST /api/camera-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSupabase.mockReturnValue(makeSupabase());
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "clear" });
  });

  it("rejects non-JPEG payloads and malformed base64", async () => {
    expect((await POST(request({ ...BASE_BODY, mimeType: "image/png" }))).status).toBe(400);
    expect((await POST(request({ ...BASE_BODY, imageBase64: "!!not-base64!!" }))).status).toBe(400);
    expect((await POST(request({ ...BASE_BODY, imageBase64: "" }))).status).toBe(400);
  });

  it("rejects snapshots over 200KB decoded", async () => {
    const response = await POST(request({ ...BASE_BODY, imageBase64: "A".repeat(280_000) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("too_large");
    expect(mocks.analyzePestSnapshot).not.toHaveBeenCalled();
  });

  it("returns disabled without touching the database when the advisory layer is off", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "disabled" });
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, disabled: true });
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it("clear verdict returns none with no advisory and no row", async () => {
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, verdict: "none" });
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it("discarded (person in frame) returns the localized generic line and persists NOTHING", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "discarded" });
    const en = await (await POST(request(BASE_BODY))).json();
    expect(en).toEqual({ ok: true, verdict: "none", advisory: CAMERA_COPY.en.scanGeneric });
    const id = await (await POST(request({ ...BASE_BODY, locale: "id" }))).json();
    expect(id.advisory).toBe(CAMERA_COPY.id.scanGeneric);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it("pest verdict inserts a TEXT-ONLY pest_advice row and returns the advisory", async () => {
    const line = "Something tickles! Can you check my leaves? 🐛";
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: line });
    const supabase = makeSupabase({ lastAdvice: null });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect(await response.json()).toEqual({ ok: true, verdict: "pest", advisory: line });
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const row = supabase.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      plant_id: "plant-01",
      kind: "pest_advice",
      note: { message: line, locale: "en" },
    });
    // THE invariant: the snapshot never reaches the database in any form.
    expect(JSON.stringify(supabase.insert.mock.calls)).not.toContain(SMALL_JPEG_B64);
  });

  it("pest verdict still answers when milestone19 is missing or the insert fails", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: "Check me! 🐛" });
    const supabase = makeSupabase({
      selectError: { code: "PGRST205", message: "Could not find the table 'public.camera_events'" },
    });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect((await response.json()).verdict).toBe("pest");
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rate-limits pest_advice rows server-side (≥10s) while still answering", async () => {
    mocks.analyzePestSnapshot.mockResolvedValue({ status: "pest", advisory: "Check me! 🐛" });
    const supabase = makeSupabase({ lastAdvice: new Date(Date.now() - 3_000).toISOString() });
    mocks.getServerSupabase.mockReturnValue(supabase);
    const response = await POST(request(BASE_BODY));
    expect((await response.json()).verdict).toBe("pest");
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});

describe("camera-scan source contract — the image can never be persisted", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/api/camera-scan/route.ts"), "utf8");

  it("contains no storage, fs, or buffer materialization of the snapshot", () => {
    expect(source).not.toMatch(/supabase\.storage|from\(["']plant-photos/);
    expect(source).not.toMatch(/writeFile|createWriteStream|appendFile|node:fs/);
    expect(source).not.toMatch(/Buffer\.from/);
  });

  it("never imports reward machinery (AI is language-only)", () => {
    expect(source).not.toMatch(/seed-engine|bonus-xp|award|total_xp|bond_level/);
  });
});
```

- [ ] Run: `npx vitest run tests/camera-scan-api.test.ts` → fails (route module missing).
- [ ] Create `src/app/api/camera-scan/route.ts`:

```ts
import { CAMERA_COPY } from "@/app/camera/copy";
import { normalizeLocale } from "@/lib/i18n";
import { analyzePestSnapshot } from "@/lib/pest-advisory";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/camera-scan — ONE downscaled JPEG in, advisory language out
 * (spec: docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
 *
 * PRIVACY CONTRACT (spec §Invariants): the snapshot exists only as the
 * base64 string inside this request's memory. It is never decoded into a
 * buffer, never uploaded, never written to any table — the pest_advice row
 * is text/jsonb only. Person in frame → analyzePestSnapshot returns
 * "discarded" → generic line, nothing persisted.
 *
 * REWARDS CONTRACT: the verdict is advisory copy. This route grants
 * nothing, and nothing downstream may parse it into a game decision.
 */

const VALID_PLANT = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IMAGE_BYTES = 200 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_ADVICE_GAP_MS = 10_000;

function isMissingSchemaError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /could not find the (function|table)/i.test(error.message)
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const plantId = typeof body.plantId === "string" ? body.plantId : "plant-01";
  if (!VALID_PLANT.test(plantId)) {
    return Response.json({ ok: false, error: "invalid_plant" }, { status: 400 });
  }
  if (body.mimeType !== "image/jpeg") {
    return Response.json({ ok: false, error: "bad_type" }, { status: 400 });
  }
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64 || !BASE64_RE.test(imageBase64)) {
    return Response.json({ ok: false, error: "bad_image" }, { status: 400 });
  }
  // Size check on the ENCODED string (≈ decoded × 4/3) — the snapshot is
  // never decoded server-side; it stays an opaque string end to end.
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 400 });
  }
  const locale = normalizeLocale(body.locale);

  const outcome = await analyzePestSnapshot({ imageBase64, mimeType: "image/jpeg", locale });

  if (outcome.status === "disabled") {
    // No key / timeout / network / malformed → client stays motion-only.
    return Response.json({ ok: true, disabled: true });
  }
  if (outcome.status === "clear") {
    return Response.json({ ok: true, verdict: "none" });
  }
  if (outcome.status === "discarded") {
    // Person in frame → NO_PLANT sentinel → snapshot dropped, generic line
    // shown, NOTHING persisted (spec §Invariants).
    return Response.json({ ok: true, verdict: "none", advisory: CAMERA_COPY[locale].scanGeneric });
  }

  // Pest verdict → best-effort TEXT-ONLY advisory row for the farm fan-out.
  // Missing Supabase config, missing milestone19, a recent advisory (<10s),
  // or an insert failure all still return the advisory to the camera page.
  const supabase = getServerSupabase();
  if (supabase) {
    const { data: lastRows, error: lastError } = await supabase
      .from("camera_events")
      .select("occurred_at")
      .eq("plant_id", plantId)
      .eq("kind", "pest_advice")
      .order("occurred_at", { ascending: false })
      .limit(1);
    const lastAt =
      !lastError && lastRows?.[0]?.occurred_at ? Date.parse(String(lastRows[0].occurred_at)) : null;
    const gapRespected = lastAt === null || !Number.isFinite(lastAt) || Date.now() - lastAt >= MIN_ADVICE_GAP_MS;
    if (!lastError && gapRespected) {
      const { error: insertError } = await supabase.from("camera_events").insert({
        plant_id: plantId,
        kind: "pest_advice",
        occurred_at: new Date().toISOString(),
        note: { message: outcome.advisory, locale },
      });
      if (insertError && !isMissingSchemaError(insertError)) {
        console.error(`camera-scan(${plantId}) advisory insert failed:`, insertError.message);
      }
    }
  }

  return Response.json({ ok: true, verdict: "pest", advisory: outcome.advisory });
}
```

- [ ] Run again: `npx vitest run tests/camera-scan-api.test.ts` → all tests pass (needs Tasks 3 + 4 merged first — see dependency notes).
- [ ] Commit: `git add src/app/api/camera-scan/route.ts tests/camera-scan-api.test.ts && git commit -m "feat: camera-scan route - in-memory pest advisory, image never persisted"`

---

### Task 7: `/camera` page — guardian viewfinder replaces the photo diary

**Files:**
- Replace: `src/app/camera/page.tsx`
- Create: `src/components/camera-guardian.tsx`
- Create: `src/app/camera/camera.css` (NEW file — `globals.css` is fenced)
- Delete: `src/app/camera/actions.ts`, `src/components/camera-capture.tsx`, `tests/camera-page.test.ts` (superseded photo-diary capture flow)
- Keep untouched: `src/lib/photo-diary.ts`, `src/lib/photo-comment.ts`, `tests/photo-diary.test.ts`, `tests/photo-comment.test.ts` (dormant libs for the future "growth album"), `/diary`'s `photo_url` thumbnail rendering
- Test: `tests/camera-guardian-page.test.ts`

**Interfaces:**
- Consumes: `CAMERA_COPY` (Task 3), `motion-detect` engine (Task 2), `/api/camera-events` (Task 5), `/api/camera-scan` (Task 6), `PageHeader`, `Notice`, `getRequestLocale`, `getPlant`, `getServerSupabase`.
- Produces:
  - `export interface GuardianFeedItem { kind: "touch" | "pest_advice"; at: string; message: string | null }` (in `camera-guardian.tsx`)
  - `export default function CameraGuardian(props: { locale: AppLocale; plantId: string; guardianReady: boolean; scanConfigured: boolean; initialEvents: GuardianFeedItem[] })`
  - The island talks ONLY to the two API routes — no Supabase client, no storage, no reward imports.

**Steps:**

- [ ] Write the failing test `tests/camera-guardian-page.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("/camera route (Live Guardian)", () => {
  it("page probes camera_events (not the superseded photo bucket) server-side", () => {
    const page = source("src/app/camera/page.tsx");
    expect(page).toContain("<PageHeader");
    expect(page).toContain("force-dynamic");
    expect(page).toContain('from("camera_events")');
    expect(page).not.toContain("plant-photos");
    expect(page).toContain("GEMINI_API_KEY"); // scanConfigured flag comes from the server
  });

  it("guardian island watches with getUserMedia + wake lock and handles every state", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).toContain('"use client"');
    expect(guardian).toContain("getUserMedia");
    expect(guardian).toContain("wakeLock");
    expect(guardian).toContain("visibilitychange");
    expect(guardian).toContain("isGuardianSuspendedWIB");
    expect(guardian).toContain('"/api/camera-events"');
    expect(guardian).toContain('"/api/camera-scan"');
    for (const state of ["denied", "nocamera", "hidden", "suspended"]) {
      expect(guardian).toContain(`"${state}"`);
    }
  });

  it("keeps the privacy contract: no supabase client, no storage, no reward imports", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).not.toMatch(/supabase/i);
    expect(guardian).not.toMatch(/storage\.|upload\(/);
    expect(guardian).not.toMatch(/awardSeeds|awardXp|seed-engine|bonus-xp|total_xp|bond_level/);
  });

  it("labels motion-only mode and the local-only (no-migration) mode honestly", () => {
    const guardian = source("src/components/camera-guardian.tsx");
    expect(guardian).toContain("motionOnlyLabel");
    expect(guardian).toContain("guardianOfflineNote");
    expect(guardian).toContain("scanDisabled");
  });

  it("superseded photo-diary capture flow is fully removed", () => {
    expect(() => source("src/app/camera/actions.ts")).toThrow();
    expect(() => source("src/components/camera-capture.tsx")).toThrow();
  });
});
```

- [ ] Run: `npx vitest run tests/camera-guardian-page.test.ts` → fails.
- [ ] Delete the superseded capture flow: `git rm src/app/camera/actions.ts src/components/camera-capture.tsx tests/camera-page.test.ts`
- [ ] Create `src/app/camera/camera.css`:

```css
/* Camera Live Guardian route styles (milestone19). NEW file on purpose: a
   concurrent workstream owns src/app/globals.css. Namespaced pm-cam-*. */

.pm-cam { display: grid; gap: 14px; }

.pm-cam-privacy {
  padding: 12px 16px;
  border: 3px solid var(--color-outline, #243421);
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
}
.pm-cam-privacy strong { display: block; margin-bottom: 4px; }
.pm-cam-privacy-alt { opacity: 0.65; font-size: 11px; margin-top: 4px; }

.pm-cam-chip {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 3px solid var(--color-outline, #243421);
  border-radius: 20px;
  background: #fff;
  font-family: var(--font-heading, "Press Start 2P", monospace);
  font-size: 11px;
}
.pm-cam-chip.is-motion { background: #fff3c4; }
.pm-cam-chip.is-checking { background: #dcebff; }
.pm-cam-chip.is-suspended,
.pm-cam-chip.is-hidden { background: #e8e6f4; opacity: 0.85; }

.pm-cam-stage { position: relative; }
.pm-cam-video {
  width: 100%;
  border: 3px solid var(--color-outline, #243421);
  border-radius: 12px;
  background: #111;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

/* Mini Jamkachu: plays the tickle reaction locally, zero network. */
.pm-cam-jamkachu {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border: 3px solid var(--color-outline, #243421);
  border-radius: 50%;
  background: #eaf6dc;
  font-size: 40px;
  line-height: 1;
}
.pm-cam-jamkachu.is-tickled { animation: pm-cam-tickle 0.5s steps(4, end); }
@keyframes pm-cam-tickle {
  0% { transform: scale(1, 1); }
  35% { transform: scale(1.12, 0.88); }
  70% { transform: scale(0.94, 1.06); }
  100% { transform: scale(1, 1); }
}
@media (prefers-reduced-motion: reduce) {
  .pm-cam-jamkachu.is-tickled { animation: none; }
}

.pm-cam-note {
  font-size: 12px;
  padding: 8px 12px;
  border: 3px dashed var(--color-outline, #243421);
  border-radius: 10px;
  background: #fffbe8;
}

.pm-cam-blocked { padding: 18px; text-align: center; }
.pm-cam-blocked h2 { font-size: 14px; margin-bottom: 6px; }

.pm-cam-empty { font-size: 12px; opacity: 0.75; }
.pm-cam-feed { display: grid; gap: 8px; list-style: none; padding: 0; }
.pm-cam-event {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 12px;
}
.pm-cam-event time { margin-left: auto; opacity: 0.6; font-size: 11px; }
.pm-cam-event.is-pest_advice { background: #fff3c4; }
```

- [ ] Create `src/components/camera-guardian.tsx`:

```tsx
"use client";

// Camera Live Guardian client island (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md).
//
// PRIVACY CONTRACT: the video feed never leaves this component. Frames are
// downscaled into an in-memory 64×48 canvas for the deterministic frame-diff
// engine (src/lib/motion-detect — math, never AI), and at most ONE ≤200KB
// JPEG snapshot per scan window is POSTed for advisory analysis — nothing
// is kept anywhere, and this island talks ONLY to the two camera API routes.
//
// REWARDS CONTRACT: nothing here grants anything, ever. Touch events drive
// presentation (mini Jamkachu + the farm fan-out) and a camera_events log
// row — no XP, no Seeds, no quests. Network failure queues nothing: events
// are ephemeral by design (a missed giggle is not data loss).

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_COPY } from "@/app/camera/copy";
import {
  MOTION_CONFIG,
  createMotionDetector,
  isGuardianSuspendedWIB,
  toGrayscale,
  type MotionEvent,
} from "@/lib/motion-detect";
import type { AppLocale } from "@/lib/i18n";

export interface GuardianFeedItem {
  kind: "touch" | "pest_advice";
  at: string; // ISO timestamp
  message: string | null;
}

type GuardianStatus =
  | "starting"
  | "watching"
  | "motion"
  | "checking"
  | "suspended"
  | "hidden"
  | "denied"
  | "nocamera";

const SAMPLE_MS = Math.round(1000 / MOTION_CONFIG.sampleFps); // ≈125ms — ~8fps
const SCAN_MIN_GAP_MS = 10 * 60_000; // one analyzed snapshot per 10 min, motion or timer
const TOUCH_POST_GAP_MS = 10_000; // client-side mirror of the server rate limit
const SNAPSHOT_WIDTH = 640;
const MAX_SNAPSHOT_BYTES = 200 * 1024;
const MOTION_CHIP_MS = 2_500;
const FEED_LIMIT = 12;

interface WakeLockSentinel {
  release: () => Promise<void>;
}

export default function CameraGuardian({
  locale,
  plantId,
  guardianReady,
  scanConfigured,
  initialEvents,
}: {
  locale: AppLocale;
  plantId: string;
  guardianReady: boolean;
  scanConfigured: boolean;
  initialEvents: GuardianFeedItem[];
}) {
  const copy = CAMERA_COPY[locale];
  const mirrorCopy = CAMERA_COPY[locale === "id" ? "en" : "id"]; // bilingual banner

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef(createMotionDetector());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTouchPostRef = useRef(0);
  const lastScanRef = useRef(0);
  const motionChipTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<GuardianStatus>("starting");
  const [scanDisabled, setScanDisabled] = useState(!scanConfigured);
  const [feed, setFeed] = useState<GuardianFeedItem[]>(initialEvents);
  const [tickle, setTickle] = useState(0); // increments to replay the reaction

  const pushFeed = useCallback((item: GuardianFeedItem) => {
    setFeed((prev) => [item, ...prev].slice(0, FEED_LIMIT));
  }, []);

  /** Deterministic touch fan-out — fire and forget (ephemeral by design). */
  const postTouch = useCallback(() => {
    if (!guardianReady) return; // milestone19 missing: local-only mode
    const now = Date.now();
    if (now - lastTouchPostRef.current < TOUCH_POST_GAP_MS) return;
    lastTouchPostRef.current = now;
    fetch("/api/camera-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, kind: "touch", occurredAt: new Date().toISOString() }),
    }).catch(() => {
      // A missed giggle is not data loss — nothing queues, nothing retries.
    });
  }, [guardianReady, plantId]);

  /** ONE ≤200KB JPEG → /api/camera-scan. Shared 10-min gate for both the
   *  motion trigger and the periodic timer. Silent degrade on any failure. */
  const runScan = useCallback(async () => {
    if (scanDisabled) return;
    const video = videoRef.current;
    const canvas = snapCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const now = Date.now();
    if (now - lastScanRef.current < SCAN_MIN_GAP_MS) return;
    lastScanRef.current = now;
    setStatus((prev) => (prev === "watching" || prev === "motion" ? "checking" : prev));
    try {
      const sourceWidth = video.videoWidth || SNAPSHOT_WIDTH;
      const scale = SNAPSHOT_WIDTH / sourceWidth;
      canvas.width = SNAPSHOT_WIDTH;
      canvas.height = Math.max(1, Math.round((video.videoHeight || 480) * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // ≤200KB contract: step JPEG quality down until the payload fits.
      let base64 = "";
      for (const quality of [0.7, 0.5, 0.35]) {
        base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
        if ((base64.length * 3) / 4 <= MAX_SNAPSHOT_BYTES) break;
      }
      if (!base64 || (base64.length * 3) / 4 > MAX_SNAPSHOT_BYTES) return;
      const response = await fetch("/api/camera-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, imageBase64: base64, mimeType: "image/jpeg", locale }),
      });
      if (!response.ok) return; // scan failures silently degrade (spec)
      const body = (await response.json()) as {
        disabled?: boolean;
        verdict?: string;
        advisory?: string | null;
      };
      if (body.disabled) {
        setScanDisabled(true); // labeled motion-only mode from here on
        return;
      }
      if (typeof body.advisory === "string" && body.advisory) {
        setTickle((n) => n + 1);
        pushFeed({ kind: "pest_advice", at: new Date().toISOString(), message: body.advisory });
      }
    } catch {
      // Network failure → advisory is skipped; motion mode continues.
    } finally {
      setStatus((prev) => (prev === "checking" ? "watching" : prev));
    }
  }, [locale, plantId, pushFeed, scanDisabled]);

  const handleMotionEvent = (event: MotionEvent) => {
    if (event.kind !== "MOTION_START") return;
    // INSTANT and local: the mini Jamkachu giggles with zero network.
    setTickle((n) => n + 1);
    setStatus((prev) => (prev === "watching" ? "motion" : prev));
    if (motionChipTimerRef.current !== null) window.clearTimeout(motionChipTimerRef.current);
    motionChipTimerRef.current = window.setTimeout(() => {
      motionChipTimerRef.current = null;
      setStatus((prev) => (prev === "motion" ? "watching" : prev));
    }, MOTION_CHIP_MS);
    pushFeed({ kind: "touch", at: new Date().toISOString(), message: null });
    postTouch();
    void runScan(); // motion-triggered scan (shared 10-min gate inside)
  };

  // Latest-handler refs keep the mount-once effects below closure-safe.
  const motionHandlerRef = useRef(handleMotionEvent);
  useEffect(() => {
    motionHandlerRef.current = handleMotionEvent;
  });
  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  });

  // Camera + sampling loop + wake lock + visibility (mount once).
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const acquireWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
        };
        const sentinel = await nav.wakeLock?.request("screen");
        if (sentinel) wakeLockRef.current = sentinel;
      } catch {
        // Best-effort: re-tried on visibility and interaction.
      }
    };

    const sample = () => {
      if (document.hidden) return;
      if (isGuardianSuspendedWIB()) {
        // Night window (18:00–06:00 WIB): dark frames are noise; Jamkachu sleeps.
        setStatus((prev) =>
          prev === "watching" || prev === "motion" || prev === "checking" ? "suspended" : prev,
        );
        return;
      }
      const video = videoRef.current;
      const canvas = sampleCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, MOTION_CONFIG.width, MOTION_CONFIG.height);
      const rgba = context.getImageData(0, 0, MOTION_CONFIG.width, MOTION_CONFIG.height).data;
      const event = detectorRef.current.pushFrame(toGrayscale(rgba), Date.now());
      setStatus((prev) => (prev === "suspended" ? "watching" : prev)); // dawn auto-resume
      if (event) motionHandlerRef.current(event);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("nocamera");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        await acquireWakeLock();
        setStatus(isGuardianSuspendedWIB() ? "suspended" : "watching");
        intervalId = window.setInterval(sample, SAMPLE_MS);
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        setStatus(name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "denied");
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setStatus((prev) => (prev === "denied" || prev === "nocamera" ? prev : "hidden"));
        return;
      }
      void acquireWakeLock(); // wake locks release on hide — re-acquire
      detectorRef.current.reset(); // a stale baseline after a pause is noise
      setStatus((prev) =>
        prev === "denied" || prev === "nocamera"
          ? prev
          : isGuardianSuspendedWIB()
            ? "suspended"
            : "watching",
      );
    };
    const onInteract = () => {
      void acquireWakeLock(); // wake-lock loss re-acquired on interaction
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onInteract);
    void start();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteract);
      void wakeLockRef.current?.release().catch(() => undefined);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // Mount-once by design: all changing values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic pest check (spec: motion-triggered + periodic 10 min).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || isGuardianSuspendedWIB()) return;
      void runScanRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const statusLabel: Record<GuardianStatus, string> = {
    starting: copy.statusStarting,
    watching: copy.statusWatching,
    motion: copy.statusMotion,
    checking: copy.statusChecking,
    suspended: copy.statusSuspended,
    hidden: copy.statusHidden,
    denied: copy.deniedTitle,
    nocamera: copy.noCameraTitle,
  };

  return (
    <section className="pm-cam">
      {/* Prominent bilingual privacy banner (spec §/camera page). */}
      <div className="pm-panel pm-cam-privacy" role="note">
        <strong>{copy.privacyTitle}</strong>
        <p>
          {copy.privacyLine1} {copy.privacyLine2}
        </p>
        <p className="pm-cam-privacy-alt">
          {mirrorCopy.privacyLine1} {mirrorCopy.privacyLine2}
        </p>
      </div>

      <div className={`pm-cam-chip is-${status}`} role="status" aria-live="polite">
        {statusLabel[status]}
      </div>

      {status === "denied" || status === "nocamera" ? (
        <div className="pm-panel pm-cam-blocked">
          <h2>{status === "denied" ? copy.deniedTitle : copy.noCameraTitle}</h2>
          <p>{status === "denied" ? copy.deniedBody : copy.noCameraBody}</p>
        </div>
      ) : (
        <div className="pm-cam-stage">
          <video ref={videoRef} className="pm-cam-video" muted playsInline aria-label={copy.title} />
          <div
            key={tickle}
            className={`pm-cam-jamkachu${tickle > 0 ? " is-tickled" : ""}`}
            aria-hidden="true"
          >
            <span>{tickle > 0 ? "😆" : "🌱"}</span>
          </div>
        </div>
      )}

      {!guardianReady && <p className="pm-cam-note">{copy.guardianOfflineNote}</p>}
      {scanDisabled && <p className="pm-cam-note">{copy.motionOnlyLabel}</p>}

      <section aria-label={copy.eventsTitle}>
        <h2 className="pm-heading text-sm">{copy.eventsTitle}</h2>
        {feed.length === 0 ? (
          <p className="pm-cam-empty">{copy.eventsEmpty}</p>
        ) : (
          <ul className="pm-cam-feed">
            {feed.map((item, index) => (
              <li key={`${item.at}-${index}`} className={`pm-panel pm-cam-event is-${item.kind}`}>
                <span aria-hidden="true">{item.kind === "touch" ? "✋" : "🐛"}</span>
                <span>{item.kind === "touch" ? copy.eventTouch : (item.message ?? copy.eventPest)}</span>
                <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Off-DOM work canvases: the 64×48 diff input and the one scan snapshot. */}
      <canvas ref={sampleCanvasRef} width={MOTION_CONFIG.width} height={MOTION_CONFIG.height} hidden />
      <canvas ref={snapCanvasRef} hidden />
    </section>
  );
}
```

- [ ] Replace the entire content of `src/app/camera/page.tsx` with:

```tsx
// Camera AI — Live Guardian watch screen (spec:
// docs/superpowers/specs/2026-08-09-camera-live-guardian-design.md;
// supersedes the photo-diary capture screen that lived here).
//
// Server component: locale + the same Supabase Notice ladder as /diary,
// then ONE camera_events probe decides whether events persist/fan out
// (milestone19). The guardian runs fully locally either way — the mini
// Jamkachu reacts on-device even with no migration and no network.

import "./camera.css";
import CameraGuardian, { type GuardianFeedItem } from "@/components/camera-guardian";
import Notice from "@/components/notice";
import PageHeader from "@/components/page-header";
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

  // milestone19 probe + recent-events seed: the SELECT errors while
  // camera_events is missing → guardianReady=false → local-only mode with
  // an honest operator note (never a crash).
  const probe = await supabase
    .from("camera_events")
    .select("kind, occurred_at, note")
    .eq("plant_id", PLANT_ID)
    .order("occurred_at", { ascending: false })
    .limit(8);
  const guardianReady = !probe.error;
  const initialEvents: GuardianFeedItem[] = guardianReady
    ? ((probe.data ?? []) as Array<{ kind: string; occurred_at: string; note: unknown }>).map(
        (row) => ({
          kind: row.kind === "pest_advice" ? ("pest_advice" as const) : ("touch" as const),
          at: String(row.occurred_at),
          message:
            typeof (row.note as { message?: unknown } | null)?.message === "string"
              ? ((row.note as { message: string }).message)
              : null,
        }),
      )
    : [];

  return (
    <main className="mx-auto w-full">
      <PageHeader icon="📷" title={copy.title} description={copy.description} />
      <div className="mx-auto w-full max-w-[720px]">
        <CameraGuardian
          locale={locale}
          plantId={PLANT_ID}
          guardianReady={guardianReady}
          scanConfigured={Boolean(process.env.GEMINI_API_KEY)}
          initialEvents={initialEvents}
        />
      </div>
    </main>
  );
}
```

  Note (AGENTS.md): before writing, skim `node_modules/next/dist/docs/` and confirm page-level CSS imports are still valid in this Next version — `src/app/shop/page.tsx` already does `import "./shop.css"` and builds clean, so mirror it exactly.

- [ ] Run: `npx vitest run tests/camera-guardian-page.test.ts tests/camera-copy.test.ts tests/photo-diary.test.ts tests/photo-comment.test.ts` → all pass (the dormant photo libs keep their green tests).
- [ ] `npm run build` → compiles clean (proves the RSC/client split, the deletions left no dangling imports, and the copy replacement reached every consumer).
- [ ] Commit: `git add -u src/app/camera src/components/camera-capture.tsx tests/camera-page.test.ts && git add src/app/camera/camera.css src/components/camera-guardian.tsx tests/camera-guardian-page.test.ts && git commit -m "feat: /camera becomes the Live Guardian watch page (supersedes photo diary)"`

---

### Task 8: Farm layer — camera_events realtime consumer + strings

**FENCED FILES.** `public/farm/live.js` and `public/farm/strings.js` are being edited by the Codex farm-clock workstream. **Re-read each file's CURRENT content immediately before every edit**, anchor on the exact text you find (never on line numbers), keep every change strictly additive, and commit only these files. If an anchor below no longer exists verbatim, find its moved equivalent — do not recreate it.

**Files:**
- Modify: `public/farm/live.js` (one handler + one isolated realtime channel)
- Modify: `public/farm/strings.js` (`cameraGuardian` section, BOTH locales)
- Test: `tests/farm-camera-layer.test.ts` (+ the existing `tests/strings-parity.test.ts` guards the strings edit)

**Interfaces:**
- Consumes: `camera_events` realtime INSERTs (Task 1); existing live.js machinery — `quickPetResponse()`, `showTransientBubble(line, ms)`, `fxEnqueue(tier, ...)`, `floatWhyCard(text, rect)`, `mascotRect()`, `sleepShown`, `hatchActive`, `PM()`.
- Produces:
  - `onCameraEventInsert(row)` in live.js — `touch` → tickle through the existing pet-response helper + giggle line; `pest_advice` → transient advisory bubble + T2-queued why-card. Never while asleep or hatching; never celebratory (no tier ≥3, no XP/Seed surface).
  - `PM().cameraGuardian.touchLine` / `PM().cameraGuardian.pestWhy` in both locales.

**Steps:**

- [ ] Write the failing test `tests/farm-camera-layer.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const live = readFileSync(resolve(process.cwd(), "public/farm/live.js"), "utf8");
const strings = readFileSync(resolve(process.cwd(), "public/farm/strings.js"), "utf8");

function handlerBody(): string {
  const start = live.indexOf("function onCameraEventInsert(");
  expect(start).toBeGreaterThan(-1);
  return live.slice(start, start + 1_800);
}

describe("farm camera layer (presentation-only)", () => {
  it("consumes camera_events on its own isolated channel", () => {
    expect(live).toContain('table: "camera_events"');
    expect(live).toContain("farm-camera-");
    expect(live).toContain("onCameraEventInsert(payload.new)");
  });

  it("touch rides the existing pet-response machinery, guarded against sleep/hatch", () => {
    const body = handlerBody();
    expect(body).toContain("quickPetResponse()");
    expect(body).toContain("sleepShown");
    expect(body).toContain("hatchActive");
  });

  it("touch reactions are throttled client-side too (replayed backlog can never spam)", () => {
    expect(live).toContain("CAMERA_TOUCH_GAP_MS");
    expect(handlerBody()).toContain("lastCameraTouchAt");
  });

  it("pest_advice is a T1/T2 advisory (bubble + why-card), never a celebration", () => {
    const body = handlerBody();
    expect(body).toContain("pest_advice");
    expect(body).toContain("floatWhyCard");
    expect(body).not.toMatch(/fxEnqueue\(\s*[345]/);
  });

  it("the handler is display-only: no awards, no counters, no network", () => {
    const body = handlerBody();
    expect(body).not.toMatch(/orbCascade|fxXpGain|fxStreakUp|award|total_xp|bond_level|seeds|fetch\(/);
  });

  it("strings.js carries cameraGuardian copy in BOTH locales", () => {
    expect(strings.match(/cameraGuardian:/g)).toHaveLength(2);
    expect(strings.match(/touchLine:/g)).toHaveLength(2);
    expect(strings.match(/pestWhy:/g)).toHaveLength(2);
  });
});
```

- [ ] Run: `npx vitest run tests/farm-camera-layer.test.ts` → fails.
- [ ] **strings.js (re-read it first):** in the `en` object, directly AFTER the `seedShop: { ... },` block, add:

```js
      // Camera Live Guardian (milestone19): farm-side reactions to
      // camera_events realtime rows. Presentation only — never rewards.
      cameraGuardian: {
        touchLine: "Hehe, that tickles! Someone touched my real leaves 🌿",
        pestWhy: "The watch camera thinks something might be on the real plant — just a hint, worth a look!",
      },
```

  and in the `id` object, directly AFTER its `seedShop: { ... },` block, add:

```js
      // Camera Live Guardian (milestone19): reaksi kebun untuk baris
      // realtime camera_events. Hanya presentasi — tidak pernah hadiah.
      cameraGuardian: {
        touchLine: "Hihi, geli! Ada yang menyentuh daun asliku 🌿",
        pestWhy: "Kamera penjaga menduga ada sesuatu di tanaman asli — sekadar petunjuk, coba lihat ya!",
      },
```

- [ ] **live.js — handler (re-read the file first):** directly AFTER the closing `}` of `function onBondEventInsert(row) { ... }` (anchor: the line `}` that follows the `LUCKY_DEFER_MS);` block and precedes the `/** Record a quest row's status; ...` comment), insert:

```js
// ── Camera Live Guardian (milestone19) ──────────────────────────────────
// camera_events realtime → presentation ONLY. `touch` rows ride the
// existing pet-response machinery (quickPetResponse: compositor squash +
// heart + pet sfx — instant, no bubble churn) plus one giggle line;
// `pest_advice` rows show a transient advisory bubble and a T2-queued
// why-card. No XP, no Seed surface, no counters, no network — a camera
// signal can never be a reward (spec §Invariants). Never while asleep or
// hatching. First-render safety: postgres_changes INSERTs only arrive for
// rows created after subscribe, and the 10s client throttle additionally
// swallows any replayed backlog on a flaky reconnect.
let lastCameraTouchAt = 0;
const CAMERA_TOUCH_GAP_MS = 10_000;

function onCameraEventInsert(row) {
  if (!row || typeof row !== "object") return;
  if (sleepShown || hatchActive) return; // sleeping Jamkachu is never tickled awake
  if (row.kind === "touch") {
    const now = Date.now();
    if (now - lastCameraTouchAt < CAMERA_TOUCH_GAP_MS) return;
    lastCameraTouchAt = now;
    quickPetResponse();
    showTransientBubble(
      PM().cameraGuardian?.touchLine ?? "Hehe, that tickles! Someone touched my real leaves 🌿",
      4000,
    );
    return;
  }
  if (row.kind === "pest_advice") {
    const note = row.note && typeof row.note === "object" ? row.note : {};
    const line = typeof note.message === "string" && note.message ? note.message : null;
    if (line) showTransientBubble(line, 6000);
    fxEnqueue(
      2,
      () =>
        floatWhyCard(
          PM().cameraGuardian?.pestWhy ??
            "The watch camera thinks something might be on the real plant — worth a look!",
          mascotRect(),
        ),
      1200,
    );
  }
}
```

- [ ] **live.js — realtime channel (re-read again if any time passed):** in `main()`, directly AFTER the closing `}` of the `farm-shop-${PLANT_ID}` try/catch block (anchor: the `// Purchases still land via the 15s refresh poll — never block the page.` comment and its closing `}`), insert:

```js
  // Camera guardian realtime (milestone19) — isolated channel, same
  // rationale as farm-events/farm-shop above: until the migration runs,
  // this join errors and must never touch the main plant/bond/quest
  // subscriptions. touch → tickle giggle; pest_advice → advisory bubble.
  try {
    supabase
      .channel(`farm-camera-${PLANT_ID}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "camera_events", filter: `plant_id=eq.${PLANT_ID}` },
        (payload) => onCameraEventInsert(payload.new),
      )
      .subscribe();
  } catch {
    // The camera page's own mini Jamkachu still reacts — never block here.
  }
```

- [ ] Run: `npx vitest run tests/farm-camera-layer.test.ts tests/strings-parity.test.ts tests/strings.test.ts` → all pass.
- [ ] Manual smoke (no migration needed): `npm run dev`, open `http://localhost:3000/` — the farm renders exactly as before, no console errors from the isolated channel.
- [ ] Verify with `git diff public/farm/live.js public/farm/strings.js` that ONLY the additive blocks above changed (the files carry the Codex workstream's uncommitted clock edits — do not revert or reformat them).
- [ ] Commit ONLY these files: `git add public/farm/live.js public/farm/strings.js tests/farm-camera-layer.test.ts && git commit -m "feat: farm layer reacts to camera guardian events - tickle giggle and pest advisory"`

---

### Task 9: Runbook — milestone19 rows (three languages) + guardian mounting in §2

**Files:**
- Modify: `docs/RUNBOOK-filming-and-golive.md` (re-read first — it may carry uncommitted edits from other workstreams; anchor on the milestone rows' text, never on line numbers)

**Interfaces:** none (docs).

**Steps:**

- [ ] **English migration table (§1):** directly AFTER the `| 19 | \`milestone19-photo-diary.sql\` | ... |` row, add:

```
| 19 | `milestone19-camera-guardian.sql` | Live Guardian `camera_events` table (kind `touch`/`pest_advice`, jsonb note) + realtime — **required before a real-leaf touch can make Jamkachu giggle on the farm screen**; without it `/camera` still watches and reacts locally with an operator note. Creates NO storage bucket: the guardian never stores what it sees |
```

  Then edit the existing photo-diary row's description by appending ` **(superseded — `/camera` is now the Live Guardian; this migration remains only for old diary thumbnails / the future growth album)**` before its closing `|`.
- [ ] **English §1 bullets:** directly after the existing "Milestone 19 is required for the Camera photo diary..." bullet, rewrite that bullet to open with `- [ ] (superseded)` and add a new bullet:

```
- [ ] Milestone 19 (`milestone19-camera-guardian.sql`) is required for the Live Guardian fan-out. Without it `/camera` still watches, the on-device mini Jamkachu still giggles instantly, and an operator note explains that reactions stay local — nothing crashes. Pest advisories additionally need `GEMINI_API_KEY` in Vercel; without it the page runs in labeled motion-only mode. No camera signal ever grants XP or Seeds — reactions are presentation only.
```

- [ ] **English §2 QA checklist:** add one item at the end of the §2 list:

```
- [ ] Guardian mount: open `/camera` on a second device (tablet/phone), allow the camera, and mount it facing the real plant with the screen visible (the Wake Lock keeps it on). Stroke a real leaf → the mini Jamkachu on the camera device giggles INSTANTLY and the farm-home Jamkachu giggles within ~2s (realtime). Wave a hand in front of the lens → at most a giggle — verify NO XP, Seeds, or quest movement anywhere. Disconnect the network → the camera-device reaction stays instant (local); the farm reaction resumes on reconnect. Between 18:00–06:00 WIB the chip shows night rest and detection is suspended.
```

- [ ] **Indonesian table (§1):** directly AFTER its `| 19 | \`milestone19-photo-diary.sql\` | ... |` row, add:

```
| 19 | `milestone19-camera-guardian.sql` | tabel `camera_events` Live Guardian (kind `touch`/`pest_advice`, note jsonb) + realtime — **wajib sebelum sentuhan daun asli bisa membuat Jamkachu terkikik di layar kebun**; tanpanya `/camera` tetap mengawasi dan bereaksi lokal dengan catatan operator. TANPA bucket Storage: penjaga tidak pernah menyimpan yang dilihatnya |
```

  Append to the Indonesian photo-diary row's description: ` **(digantikan — `/camera` kini Live Guardian; migrasi ini tinggal untuk thumbnail diary lama / growth album di masa depan)**`.
- [ ] **Indonesian bullets:** mark the old milestone19 photo-diary bullet with `- [ ] (digantikan)` at its start, and add:

```
- [ ] Milestone 19 (`milestone19-camera-guardian.sql`) wajib untuk penyebaran Live Guardian. Tanpanya `/camera` tetap mengawasi, mini Jamkachu di perangkat tetap terkikik seketika, dan catatan operator menjelaskan bahwa reaksi hanya lokal — tidak ada yang crash. Saran hama juga membutuhkan `GEMINI_API_KEY` di Vercel; tanpanya halaman berjalan dalam mode gerakan-saja yang diberi label. Tidak ada sinyal kamera yang pernah memberi XP atau Benih — reaksi hanyalah presentasi.
```

- [ ] **Indonesian §2 QA checklist**, add at the end:

```
- [ ] Pemasangan penjaga: buka `/camera` di perangkat kedua (tablet/ponsel), izinkan kamera, dan pasang menghadap tanaman asli dengan layar terlihat (Wake Lock menjaganya tetap menyala). Usap daun asli → mini Jamkachu di perangkat kamera terkikik SEKETIKA dan Jamkachu di layar kebun terkikik dalam ~2 detik (realtime). Lambaikan tangan di depan lensa → paling banyak kikikan — pastikan TIDAK ada XP, Benih, atau pergerakan misi di mana pun. Putuskan jaringan → reaksi di perangkat kamera tetap seketika (lokal); reaksi kebun kembali saat tersambung. Pukul 18.00–06.00 WIB chip menampilkan istirahat malam dan deteksi ditangguhkan.
```

- [ ] **Korean table (§1, `## 한국어` → `### 1.`):** re-read the Korean migration table; if it has a `| 19 | milestone19-photo-diary... |` row, add the new row after it (and append the superseded note `**(대체됨 — `/camera`는 이제 Live Guardian입니다; 이 마이그레이션은 예전 다이어리 썸네일 / 향후 growth album 용으로만 남습니다)**`); otherwise add after its last milestone row:

```
| 19 | `milestone19-camera-guardian.sql` | Live Guardian `camera_events` 테이블 (kind `touch`/`pest_advice`, note jsonb) + realtime — **진짜 잎을 만졌을 때 농장 화면의 Jamkachu가 웃으려면 필수**; 없어도 `/camera`는 로컬로 계속 감시·반응하며 운영자 안내를 표시합니다. Storage 버킷 없음: 가디언은 본 것을 절대 저장하지 않습니다 |
```

  and add the bullet:

```
- [ ] Milestone 19(`milestone19-camera-guardian.sql`)는 Live Guardian 팬아웃에 필요합니다. 없어도 `/camera`는 계속 감시하고 기기 내 미니 Jamkachu는 즉시 웃으며, 운영자 안내가 반응이 로컬에만 머문다고 설명합니다 — 아무것도 깨지지 않습니다. 해충 안내는 Vercel의 `GEMINI_API_KEY`가 추가로 필요하며, 없으면 라벨이 붙은 모션 전용 모드로 동작합니다. 어떤 카메라 신호도 XP나 Seeds를 주지 않습니다 — 반응은 오직 표현입니다.
```

- [ ] **Korean §2 QA checklist**, add at the end:

```
- [ ] 가디언 거치: 두 번째 기기(태블릿/폰)에서 `/camera`를 열고 카메라를 허용한 뒤 실제 식물을 향해 화면이 보이게 거치합니다(Wake Lock이 화면을 유지). 진짜 잎을 쓰다듬으면 → 카메라 기기의 미니 Jamkachu가 즉시 웃고, 농장 홈 Jamkachu도 ~2초 안에 웃습니다(realtime). 렌즈 앞에서 손을 흔들면 → 기껏해야 웃음뿐 — 어디에서도 XP·Seeds·퀘스트 변화가 없는지 확인합니다. 네트워크를 끊으면 → 카메라 기기 반응은 그대로 즉시(로컬)이고, 농장 반응은 재연결 시 재개됩니다. 18:00–06:00 WIB에는 칩이 야간 휴식을 표시하고 감지가 중단됩니다.
```

- [ ] Verify with `git diff docs/RUNBOOK-filming-and-golive.md` that only the intended lines changed (the file may carry unrelated uncommitted edits — do not revert them).
- [ ] Commit ONLY this file: `git add docs/RUNBOOK-filming-and-golive.md && git commit -m "docs: runbook rows and guardian mounting steps for milestone19-camera-guardian in en/id/ko"`

---

### Task 10: Final QA — full suite, build, invariant sweeps

**Files:** none created; fixes only if something fails.

**Steps:**

- [ ] `npm test` → the ENTIRE vitest suite passes, including the new files (`camera-guardian-sql`, `motion-detect`, `camera-copy` [rewritten], `pest-advisory`, `camera-events-api`, `camera-scan-api`, `camera-guardian-page`, `farm-camera-layer`) and the untouched dormant ones (`photo-diary`, `photo-comment`). `tests/camera-page.test.ts` no longer exists.
- [ ] `npm run lint` → clean.
- [ ] `npm run build` → clean production build.
- [ ] **AI-language-only / no-rewards invariant sweep:** `grep -n "award\|total_xp\|bond_level\|seed" supabase/milestone19-camera-guardian.sql src/lib/motion-detect.ts src/lib/pest-advisory.ts src/app/api/camera-events/route.ts src/app/api/camera-scan/route.ts src/components/camera-guardian.tsx src/app/camera/page.tsx src/app/camera/copy.ts` → every hit is a comment stating the invariant; ZERO code hits (no imports, no calls, no RPCs). Then confirm the farm handler: `grep -n "onCameraEventInsert" public/farm/live.js` and re-check its body contains no award/XP/seed/fetch calls (the `tests/farm-camera-layer.test.ts` regex already pins this).
- [ ] **Never-store-image invariant sweep:** `grep -n "storage\|writeFile\|createWriteStream\|appendFile\|Buffer.from\|plant-photos" src/app/api/camera-scan/route.ts src/app/api/camera-events/route.ts src/components/camera-guardian.tsx src/lib/pest-advisory.ts src/app/camera/page.tsx supabase/milestone19-camera-guardian.sql` → zero code hits (comment mentions of the contract are fine); additionally confirm the only network destinations in `camera-guardian.tsx` are `/api/camera-events` and `/api/camera-scan`, and the only external URL in `pest-advisory.ts` is the Gemini endpoint.
- [ ] Manual QA WITHOUT migration and WITHOUT `GEMINI_API_KEY`: `npm run dev`; open `/camera`, allow the camera → chip shows 👀; wave a hand → mini Jamkachu tickle plays instantly, feed gains a touch row, console shows no errors even though POST fan-out is skipped (operator note visible, motion-only label visible); deny the permission in a fresh profile → honest denied state; switch tabs → paused state, auto-resume on return; `/` (farm) renders unchanged.
- [ ] Manual QA WITH migration (if a dev Supabase project is available): run `supabase/milestone19-camera-guardian.sql` twice (second run silent — re-runnable); with `/camera` and `/` open side by side, wave at the lens → farm Jamkachu plays the tickle squash + giggle bubble within ~2s; spam motion for a minute → farm reacts at most every 10s (server rate limit + client throttle); confirm `bond_state.total_xp` and `seeds` are byte-identical before/after the session (SQL: `select total_xp, seeds from bond_state where plant_id = 'plant-01';`).
- [ ] Manual QA WITH `GEMINI_API_KEY` (optional): point the camera at a plant photo with a visible insect → within the scan window the camera feed gains a 🐛 advisory and the farm shows the advisory bubble + why-card; point it at a person → nothing persists, generic line only (check `camera_events` has NO new row).
- [ ] If anything failed, fix it, re-run the failing command, and commit the fix with a `fix:` message referencing the task number.
- [ ] Do NOT push and do NOT run the migration on the shared/production Supabase project — per the spec's "User actions after merge", the user runs `supabase/milestone19-camera-guardian.sql`, mounts the device, and optionally sets `GEMINI_API_KEY`.

---

## Execution order & dependency notes

```
Task 1 (SQL)            ──┐
Task 2 (motion engine)  ──┼──► Task 7 (/camera page) ──► Task 10 (QA, last)
Task 3 (guardian copy)  ──┤        ▲
Task 4 (pest advisory)  ──┴─► Task 6 (camera-scan route)
Task 1 ────────────────────► Task 5 (camera-events route)
Task 1 ────────────────────► Task 8 (farm layer)
Task 1 ────────────────────► Task 9 (runbook)
```

- **Parallel-safe groups:** {Task 1, Task 2, Task 3, Task 4} have no mutual dependencies. Task 5 needs Task 1 (semantically — the table contract). Task 6 needs Tasks 3 + 4 (imports `CAMERA_COPY.scanGeneric` and `analyzePestSnapshot`). Task 7 needs Tasks 2 + 3 (imports) and semantically 5 + 6 (endpoints it calls). Task 8 needs Task 1 only. Task 9 needs only Task 1's filename. Task 10 strictly last.
- **Build gate:** between Task 3 (copy replaced) and Task 7 (old consumers deleted) the repo does NOT `npm run build` cleanly — the old `camera-capture.tsx` still references removed copy keys. Run Tasks 3 and 7 back-to-back (same worker) or accept red builds in between; all vitest suites stay runnable throughout.
- **Contention warning:** Task 8 edits the Codex-fenced `public/farm/live.js` + `strings.js` — schedule it when no other farm-layer edit is mid-flight, re-read both files immediately before editing, and keep the diff strictly additive. Task 9's runbook may also carry others' uncommitted edits — same rule.
- **Concurrent-workstream discipline (repeated because it is the #1 way to break this repo today):** never touch `src/lib/ai.ts`, `src/app/globals.css`, `src/app/api/memory-reflection/`, `src/lib/jamkachu-memory.ts`, `src/lib/farmer-chat.ts`, or appearance files; `pest-advisory.ts` deliberately duplicates the Gemini plumbing from `photo-comment.ts` instead of importing `ai.ts`. Commit only the files each task names — `git add <specific paths>`, never `git add -A`.
- milestone19-photo-diary.sql is NOT deleted or modified (already applied at schools); the runbook supersession note is the only trace this plan leaves on the photo-diary feature besides removing its `/camera` UI.
