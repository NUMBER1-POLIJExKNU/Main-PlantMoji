# Companion Evolution Ladder — design spec (2026-08-09)

## Goal

The player should feel visible growth for the whole deployment, not just the
first two weeks. Expand the companion evolution track from 5 stages to 10,
give every stage a distinct look on the mascot, celebrate each evolution, and
always show honest progress toward the next stage. (User request 2026-08-09:
"진화를 여러 단계 많이 — 계속 성장하고 있다는 느낌".)

This directly addresses two findings from the 2026-08-09 design-principles
audit: every progression track caps out in the 15–30-quest window, and the
companion's stage/form reach the player only as a raw English enum label
("COMPANION · SEED · BALANCED") with almost no visual payoff.

## What exists today (do not rebuild)

- `src/game/companion/companion-engine.ts` — monotonic, replay-safe
  evolution sweep. Stage from verified care quests only: count, distinct
  affinities (cool/air/light/soil/steady), distinct WIB days.
  Seed → Sprout(1) → Bud(3, 2aff) → Bloom(7, 3aff, 2d) → Guardian(15, 4aff, 3d).
- `supabase/milestone11-tamagotchi.sql` — `companion_state` (plant_id, cycle,
  stage, form_key), `companion_evolutions` history keyed (plant_id, cycle,
  stage), CHECK constraints pin the 5 stage names. Realtime on
  `companion_state`. Missing migration = safe no-op in the engine.
- `public/farm/live.js` `renderCompanion()` (line ~226) — applies
  `companion-<Stage>` class + `data-companion-form` to `.mascot-svg`, writes
  the raw label into `#companion-stage`.
- `public/farm/style.css:588-591` — stage visuals are only a leaf scale-up
  (1.03→1.18) plus Guardian gold glow. `data-companion-form` has no CSS at all.
- `COMPANION_EVOLVED` rows land in `bond_events` and surface in the diary
  memory feed; there is no home-screen evolution ceremony.

## Design

### 1. Ladder: 5 → 10 stages

Enum order (existing five names keep their relative order, so stored states
replay safely and the monotonic guard keeps working):

| # | Stage    | care | affinities | WIB days | note |
|---|----------|------|------------|----------|------|
| 0 | Seed     | 0    | –          | –        | unchanged |
| 1 | Sprout   | ≥1   | –          | –        | unchanged |
| 2 | Seedling | ≥2   | –          | ≥2       | new |
| 3 | Bud      | ≥3   | ≥2         | –        | unchanged (verbatim) |
| 4 | Bloom    | ≥7   | ≥3         | ≥2       | unchanged (verbatim) |
| 5 | Fruit    | ≥11  | ≥3         | ≥4       | new |
| 6 | Guardian | ≥15  | ≥4         | ≥5       | days 3→5 (upward-only rebalance; already-Guardian users are protected by the monotonic guard) |
| 7 | Elder    | ≥25  | ≥4         | ≥8       | new — past the old ceiling |
| 8 | Radiant  | ≥40  | ≥4         | ≥12      | new |
| 9 | Legend   | ≥60  | ≥4         | ≥20      | new — semester-scale target |

Rules:
- Never require 5 affinities: soil moods are chemically rare on one real pot
  (the audit's MOOD_SCHOLAR trap). 4 is the max anywhere.
- Care counts are strictly increasing down the ladder. Bud and Bloom keep
  their conditions verbatim, so a lower new stage (Seedling) may check an axis
  (days) that Bud ignores — the top-down eligibility chain handles this
  correctly: the highest satisfied stage wins.
- `STAGE_RANK` is derived from the `COMPANION_STAGES` array, not a second
  hand-written literal.

### 2. Data (backend-owned, milestone16)

`supabase/milestone16-evolution-ladder.sql`, additive and re-runnable:
- Drop & recreate the CHECK constraints on `companion_state.stage` and
  `companion_evolutions.stage` / `from_stage` with the 10 names.
- Add display-only progress columns to `companion_state`:
  `care_count int`, `affinity_count int`, `day_count int` (default 0).
  `evaluateCompanion` upserts them on **every** sweep — including sweeps that
  do not evolve — so the client can show honest next-stage progress without
  querying the quest history. The client never computes game truth.
- Table ownership unchanged: `companion_*` belongs to the Next.js backend;
  Node-RED tables untouched.

### 3. Farm layer (presentation only)

- **Stage silhouettes.** Each stage beyond the current scale ladder gets a
  visible SVG delta on the mascot: extra leaf pairs (Seedling), bud (Bud),
  blossom (Bloom), fruit cluster (Fruit), gold aura (Guardian, exists),
  thicker elder stem + second branch (Elder), light halo particles (Radiant),
  full crown + firefly ring (Legend). Implementation: new hidden groups inside
  the existing `.mascot-svg` in `public/farm/index.html`, toggled purely by
  the `companion-<Stage>` classes `renderCompanion()` already applies. Face
  groups, petting, sleep, and every existing FX stay untouched.
- **Form payoff** (audit fix): `[data-companion-form]` tints a small accent
  (leaf-tip highlight color) per form — cool/air/light/soil/steady/balanced.
  CSS variables only; no JS changes beyond what `renderCompanion()` sets today.
- **Localized labels** (audit fix): `strings.js` gains `companionStage` and
  `companionForm` tables ({en, id}); `renderCompanion()` renders
  "동반자 · 새싹 · 균형" instead of raw enum keys. The en/id key-parity test
  covers the new tables automatically.
- **Next-stage progress line.** Under the companion label:
  "Next: Fruit — care 9/11 · days 3/4" from the `companion_state` counters +
  a client-side copy of the threshold table (display only; thresholds also
  exported from one shared place, see §5). Hidden at Legend (top stage) in
  favor of a "fully grown" line.
- **Evolution ceremony.** When a realtime `companion_state` UPDATE (or poll
  refresh) raises the stage rank relative to the currently rendered stage, and
  it is not the first render, enqueue a T5 ceremony: stage name card, confetti,
  fanfare cue, mascot sparkle. `localStorage pm_evo_seen = "<cycle>:<stage>"`
  makes it replay-safe across reloads (same self-healing pattern as hatching
  and the lucky marker).
- **Demo/QA.** `PMFx.evolve()` presentation-only preview (next stage's look +
  ceremony, real state re-asserts on next data render — same contract as
  `PMFx.levelUp()`); `demo.js` hotkey `E`; QA overlay typeof check.

### 4. React surfaces

- `src/app/diary/page.tsx` and `src/lib/i18n.ts`: reuse the localized
  stage/form names instead of raw `companion.stage` / `form_key`.
- Collection "growth album" tab is explicitly **out of scope** (roadmap).

### 5. Single source of truth for the ladder

The threshold table lives once in `src/types/game.ts` (next to
`COMPANION_STAGES`) and is imported by the engine and tests. The farm layer
gets a small mirrored constant in a new `public/farm/companion-ladder.js`
(same vanilla-module pattern as `strings.js`) with a vitest asserting the two
tables are identical (same pattern as the chapter-title parity rule).

## Out of scope (roadmap)

- Cycle 2+ rebirth loop (schema is already keyed by `cycle`; a future
  "replant the seed" ceremony can reset stage while keeping history).
- Jember crop skins wardrobe (separate direction already chosen: skin
  variants, bond-level unlocks — own spec/plan when picked up).
- Collection growth-album tab.

## Error handling

- Missing milestone16 (old DB): constraint violation is impossible because the
  engine only writes new stage names after the migration relaxes the CHECK;
  `evaluateCompanion` treats a CHECK failure like today's insert errors
  (thrown, logged, next tick retries). Missing milestone11 stays a no-op.
- Unknown stage string reaching the client (old client + new DB or vice
  versa): `renderCompanion()` falls back to no stage class + Seed label;
  progress line hides.
- First render never celebrates (existing rule), so a fresh device at Elder
  shows Elder quietly.

## Testing

- `tests/companion-engine.test.ts`: boundary test per stage, multi-stage jump
  replay (history rows for every skipped stage), Guardian days-rebalance
  cannot demote, progress counters written on non-evolving sweeps, missing
  table no-op.
- Ladder parity test: farm-layer mirror table === engine table.
- strings.js en/id parity (existing suite, automatic).
- Full `npm test` + `npm run build` green.

## User actions after merge

- Run `supabase/milestone16-evolution-ladder.sql` in the Supabase SQL editor
  (after milestone11). Without it, everything keeps working at the old
  5-stage ceiling.
