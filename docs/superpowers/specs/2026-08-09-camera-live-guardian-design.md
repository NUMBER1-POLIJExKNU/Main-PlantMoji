# Camera AI — Live Guardian design spec (2026-08-09)

> Supersedes `2026-08-09-camera-photo-diary-design.md` (user correction:
> Camera AI is a continuously-running watch camera, not a photo tool).

## Goal

A demo device is mounted facing the REAL plant with `/camera` open. The
page watches the video feed continuously and detects two things:
1. **The plant was touched / something moved** — deterministic frame-diff,
   no AI — and the digital Jamkachu reacts INSTANTLY (tickle giggle), on
   the camera device and on every farm-home screen.
2. **A pest might be on the plant** — motion-triggered + periodic (10 min)
   single-snapshot Gemini Vision analysis producing an advisory line only
   ("간지러워! 뭐가 붙었나봐 🐛 확인해줄래?").

The magic beat: a student strokes the real leaf → Jamkachu giggles on
screen. Frame-diff is deterministic, so this game reaction is
sensor-truth-legal; the AI half stays language-only and reward-free.

## Invariants

- **AI never decides truth or rewards.** Pest analysis output is advisory
  copy; misdetection changes nothing in the game. No XP, no Seeds, no
  quests from any camera signal.
- **Video never leaves the device** except the single downscaled snapshot
  sent for analysis, which is processed in memory and **never stored**.
  Person visible → model must return the NO_PLANT sentinel → snapshot
  discarded, generic line shown, nothing persisted.
- Deterministic touch events MAY drive presentation (Jamkachu reaction)
  and an event log — never rewards.

## Architecture

### Detection engine (client, deterministic — `src/lib/motion-detect.ts`)

Pure, unit-testable functions: downscale frames to ~64×48 grayscale via
canvas, mean absolute pixel diff against a rolling baseline, threshold +
N-consecutive-frames debounce → `MOTION_START` / `MOTION_END` events;
adaptive baseline (lighting drift), 10 s per-event cooldown, sampling at
~8 fps. Suspended 18:00–06:00 WIB (dark frames are noise; Jamkachu sleeps).

### `/camera` page (React, pixel-farm styled)

getUserMedia viewfinder (environment camera) + Screen Wake Lock; big
status chip (👀 watching / ✋ motion! / 🔍 checking); mini Jamkachu that
plays the tickle reaction locally (instant, no network); recent-events
feed; prominent bilingual privacy banner ("영상은 기기 밖으로 나가지
않아요 — 분석 순간의 스냅샷 1장만, 저장 없이"). Camera permission denied
or no camera → honest operator note. Works fully with `GEMINI_API_KEY`
absent (motion-only mode, labeled).

### Event fan-out (backend-owned)

`POST /api/camera-events` — validates `{kind: "touch", occurredAt}`,
server-side rate limit (≥10 s between rows), inserts into the new
`camera_events` table (milestone19: id, plant_id, kind `touch|pest_advice`,
occurred_at, note jsonb; realtime enabled). Farm-home `live.js` subscribes:
`touch` → tickle reaction through the existing pet-response machinery
(never while asleep, never first render); `pest_advice` → advisory bubble
+ why-card, T1-level, no celebration.

`POST /api/camera-scan` — accepts one ≤200 KB downscaled JPEG, calls
Gemini Vision with the pest-or-NO_PLANT prompt (4 s timeout), returns
localized advisory copy or `none`; on a pest verdict also inserts a
`pest_advice` camera_events row (text only). The image is never written
anywhere. Missing key/failure → `{disabled: true}`, client stays in
motion-only mode.

### Data (milestone19-camera-guardian.sql)

`camera_events` + realtime. No storage bucket (superseded design's bucket
is dropped — nothing is stored). Missing migration → events aren't
persisted/fanned out; the camera page still runs fully locally (mini
Jamkachu reacts), with an operator note.

## Error handling

Camera permission denied / no camera / tab hidden → clear states, auto-
resume on visibility; wake-lock loss re-acquired on interaction; network
failure queues nothing (events are ephemeral by design — a missed giggle
is not data loss); scan endpoint failures silently degrade to motion-only.

## Testing

Unit: diff/threshold/debounce math (synthetic frames), WIB suspension
window, rate-limit logic, scan-response fallbacks, en/id copy parity.
Integration: camera_events POST validation + rate limit. Manual (runbook):
mount device, stroke leaf → giggle on both screens; wave hand → no reward
anywhere; unplug network → local reaction still instant.

## Out of scope (roadmap)

Hardware camera module via Node-RED (staged rollout note); teacher
notifications; time-lapse; multi-plant. The photo-diary feature may return
later as a separate "growth album" — explicitly NOT this feature.

## User actions after merge

Run `supabase/milestone19-camera-guardian.sql`; mount a device with
`/camera` open facing the plant; `GEMINI_API_KEY` optional (pest advice).
