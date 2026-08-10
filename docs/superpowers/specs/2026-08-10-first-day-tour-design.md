# First-day tour — design spec (2026-08-10)

## Problem

The one-time hatching intro (spec §6.3, `live.js` `runHatchIntro`) ends on a
finale that spotlights the contextual care button and the Current Quest slot
("This button always shows what I need!"). Three honesty gaps open the moment
that finale closes:

1. **The finale points at a quest slot that can stay empty forever.** Quests
   are created by the server engine from real sensor events. On a fresh
   install with no Arduino connected yet, the slot the intro just promised
   ("quests will appear here") never fills — the first thing the game teaches
   is a promise the screen cannot keep.
2. **A configured-but-empty DB shows unexplained dashes.** With Supabase
   reachable but `sensor_readings` still empty (hardware not wired up yet),
   the environment tiles render bare dash placeholders with no explanation.
   To a student this reads as *broken*, not *waiting*.
3. **No post-hatch handoff.** After the finale the player is dropped onto the
   full farm HUD (mood, bond bar, streak flame, tiles) with no guided read of
   what each region means or when it will come alive.

## Solution — three parts

### 1. Four-step spotlight tour (reuses the hatch engine)

A short guided tour that plays exactly once, immediately after the hatching
intro finishes (same settle-delay pattern as `scheduleHatch`, live.js:4988).
It reuses the existing hatch card machinery — tap-to-advance, 5 s
auto-advance per step, always-visible Skip — and adds a dimmed overlay with a
spotlight cutout that steps through:

1. **Mascot + mood** — "my face shows how my environment feels";
2. **Current Quest slot** — what a quest is and *when* one appears (see
   part 3 for the honest empty copy it points at);
3. **Contextual care button** — the one safe action, zero XP;
4. **Environment tiles** — real sensor numbers, or the honest waiting state
   from part 2 when nothing has ever reported.

Each step's copy points at what is actually on screen right now — the tour
never claims a quest or a reading exists when it doesn't.

### 2. Honest sensor-waiting state

When **no reading has ever arrived** (configured-but-empty DB, or Supabase
unconfigured), the environment tiles replace the bare dashes with a labeled
waiting state — "Sensors aren't connected yet — numbers appear when your
Arduino reports" (en/id). Display-only relabeling of the existing empty
render: no polling change, no invented values, no demo data. The moment one
real reading lands, the normal value display takes over untouched.

### 3. Expectation-setting quest-empty copy

The empty Current Quest slot stops being a blank box. It says honestly that
quests begin when real sensor data flows — "My quests start when my sensors
notice something I need" (en/id). Copy only; the slot's live rendering path
for real quests is unchanged.

## Invariants (non-negotiable)

- **Display-only, zero writes.** The farm layer stays presentation-only: the
  tour and both empty states never write to Supabase, never grant XP or
  Seeds, never enqueue celebrations, and never touch the reward FX queue.
- **One-time, fail-closed flag `pm_tour_seen_v1`.** localStorage access is
  wrapped in try/catch exactly like `pm_streak_nudge` (live.js:4444) and
  `scheduleHatch` (live.js:4991): unreadable storage ⇒ the tour stays silent
  this visit — it must never replay forever. The flag is written *before*
  step 1 renders (flag-first, mirroring `HATCH_KEY` at live.js:5004) so a
  mid-tour reload cannot replay it; a failed flag write ⇒ skip the tour.
- **en/id parity.** All player copy lives in a new `strings.js` group in
  BOTH locales, plus a hardcoded English fallback constant in `live.js`
  matching the `HATCH_FALLBACK` pattern (live.js:4961) so stale cached
  strings can never blank the tour. Guarded by the strings-parity vitest.
- **Reduced-motion safe.** `prefers-reduced-motion` ⇒ same cards and same
  information with no spotlight sweep, dim transition, or pulse — identical
  to the hatch intro's reduced-motion contract.
- **Safety alerts always win.** The tour never covers or delays a safety
  alert. A problem-mood transition while the tour is showing dismisses the
  tour layer immediately (it does not resume mid-alert); the tour overlay
  sits below alert layers in stacking order.

## Deliberately NOT done

- **No engine-created starter quest.** The obvious fix for the empty slot —
  seeding a "Welcome" quest so the finale always has something to point at —
  was rejected. Every quest completion in PlantMoji is sensor-verified; a
  quest the engine invents client- or server-side without sensor truth
  behind it would put fake content in the one UI element whose honesty the
  whole game leans on. The empty slot gets honest copy instead.
- No demo-mode auto-switch, no placeholder sensor numbers, no replaying the
  tour on later visits (not even after an app update — `_v1` in the flag
  name reserves versioning for a future deliberate re-show).

## Files (implementation surface — live Codex workflow owns these)

- `public/farm/live.js` — tour scheduling/engine reuse, waiting/empty state
  rendering, `TOUR_FALLBACK`-style English constants
- `public/farm/strings.js` — new group, en + id
- `public/farm/index.html` / `style.css` — spotlight overlay + cutout styles
  if markup/styles are needed

Verify after edits: `node --check` on every touched farm JS file;
`npx vitest run` on tests/app-guide.test.ts, tests/strings-parity.test.ts,
tests/strings.test.ts, tests/farm-adventure-hud.test.ts,
tests/farmer-npc-ui.test.ts, tests/pet-response.test.ts,
tests/farm-mobile-nav.test.ts — all must stay green.
