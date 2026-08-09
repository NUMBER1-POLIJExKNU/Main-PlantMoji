# Companion Evolution Ladder (10 stages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the companion evolution track from 5 to 10 stages with per-stage mascot visuals, localized labels, an on-screen evolution ceremony, and an honest next-stage progress line.

**Architecture:** The ladder's single source of truth lives in `src/types/game.ts` (`COMPANION_LADDER`); the engine (`companion-engine.ts`) derives eligibility and ranks from it and now also persists display-only progress counters; the farm layer mirrors the table in `public/farm/companion-ladder.js` (parity-tested) and renders stages purely from `companion_state` via CSS classes — the browser never decides game truth.

**Tech Stack:** Next.js 16 + TypeScript (engine), Supabase (milestone15 SQL), vanilla ES-module JS + CSS/SVG (farm layer), vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-companion-evolution-ladder-design.md` — read it first.

## Global Constraints

- Stage enum order (never reorder, existing five names keep relative order): `Seed, Sprout, Seedling, Bud, Bloom, Fruit, Guardian, Elder, Radiant, Legend`.
- Thresholds (care / distinct affinities / distinct WIB days): Sprout 1/0/0 · Seedling 2/0/2 · Bud 3/2/0 · Bloom 7/3/2 · Fruit 11/3/4 · Guardian 15/4/5 · Elder 25/4/8 · Radiant 40/4/12 · Legend 60/4/20. Never require 5 affinities anywhere.
- The Next.js backend owns `companion_*` tables; Node-RED legacy tables are untouched. The farm layer is presentation-only: no XP, no writes, first render never celebrates.
- All player-facing copy exists in both `en` and `id` (the strings parity vitest fails otherwise). "JAMKACHU" / "PLANT MOJI" are never translated.
- Missing milestone11 or milestone15 must remain a safe no-op / graceful fallback — never a crash.
- After every task: `npx vitest run` green before committing. Commit messages follow repo style (`feat:`/`fix:`/`docs:` or plain sentence).

---

### Task 1: milestone15 migration

**Files:**
- Create: `supabase/milestone15-evolution-ladder.sql`

**Interfaces:**
- Produces: relaxed CHECK constraints accepting the 10 stage names; `companion_state.care_count/affinity_count/day_count integer` columns (Task 3 writes them, Task 5 reads them).

- [ ] **Step 1: Verify the auto-generated constraint names**

Run: `grep -n "check" supabase/milestone11-tamagotchi.sql`
The checks are inline column constraints, so Postgres auto-named them `companion_state_stage_check`, `companion_evolutions_stage_check`, `companion_evolutions_from_stage_check`, `companion_state_form_key_check`. If milestone11 shows explicit `constraint <name>` clauses instead, use those names in Step 2.

- [ ] **Step 2: Write the migration**

```sql
-- PlantMoji · Milestone 15 — 10-stage companion evolution ladder.
-- Run after milestone11-tamagotchi.sql. Additive and safe to re-run.
-- Ladder source of truth: src/types/game.ts COMPANION_LADDER.

alter table public.companion_state
  drop constraint if exists companion_state_stage_check;
alter table public.companion_state
  add constraint companion_state_stage_check check (stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_stage_check check (stage in
    ('Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant','Legend'));

alter table public.companion_evolutions
  drop constraint if exists companion_evolutions_from_stage_check;
alter table public.companion_evolutions
  add constraint companion_evolutions_from_stage_check check (from_stage in
    ('Seed','Sprout','Seedling','Bud','Bloom','Fruit','Guardian','Elder','Radiant'));

-- Display-only progress counters, written by evaluateCompanion each sweep.
alter table public.companion_state add column if not exists care_count integer not null default 0;
alter table public.companion_state add column if not exists affinity_count integer not null default 0;
alter table public.companion_state add column if not exists day_count integer not null default 0;
```

- [ ] **Step 3: Sanity-check re-runnability by reading it once more** (every statement is `drop if exists` / `add if not exists` / `add constraint` after its own drop — re-running is safe)

- [ ] **Step 4: Commit**

```bash
git add supabase/milestone15-evolution-ladder.sql
git commit -m "feat: milestone15 relaxes companion stage checks to the 10-stage ladder"
```

---

### Task 2: Ladder source of truth + eligibility rewrite

**Files:**
- Modify: `src/types/game.ts` (around line 97–99 where `COMPANION_STAGES` / `CompanionStage` live)
- Modify: `src/game/companion/companion-engine.ts:9` (STAGE_RANK) and `:34-42` (eligibleCompanionStage) and `:68` (stages slice)
- Test: `tests/companion-engine.test.ts`

**Interfaces:**
- Produces: `COMPANION_STAGES` (10 names, in the Global Constraints order), `COMPANION_LADDER: readonly { stage; care; affinities; days }[]` exported from `@/types/game`; `eligibleCompanionStage(care: VerifiedCare[]): CompanionStage` unchanged signature.
- Consumed by: Task 3 (engine), Task 4 (parity test), Task 8 (reference sweep).

- [ ] **Step 1: Write failing boundary tests** (append to `tests/companion-engine.test.ts`; reuse the file's existing import of `eligibleCompanionStage` and its care-item helper if one exists — otherwise use this local helper)

```ts
import { eligibleCompanionStage } from "@/game/companion/companion-engine";

// n care items spread across `days` distinct WIB days and `affinities` distinct
// quest families (order: steady, cool, air, light, soil).
const FAMILY: Record<string, string> = { steady: "KEEP_ME_HAPPY", cool: "COOL_ME_DOWN", air: "HUMIDIFY_MY_AIR", light: "GIVE_ME_MORE_LIGHT", soil: "BALANCE_SOIL_ACIDIC" };
function ladderCare(n: number, affinities: number, days: number) {
  const fams = Object.values(FAMILY).slice(0, affinities);
  return Array.from({ length: n }, (_, i) => ({
    questKey: fams[i % fams.length] as never,
    // 05:00 UTC = 12:00 WIB, +1 day per bucket
    completedAt: new Date(Date.UTC(2026, 0, 1 + (i % days), 5)).toISOString(),
  }));
}

describe("10-stage ladder", () => {
  it("requires two distinct days for Seedling", () => {
    expect(eligibleCompanionStage(ladderCare(2, 1, 1))).toBe("Sprout");
    expect(eligibleCompanionStage(ladderCare(2, 1, 2))).toBe("Seedling");
  });
  it("keeps Bud and Bloom verbatim", () => {
    expect(eligibleCompanionStage(ladderCare(3, 2, 1))).toBe("Bud");
    expect(eligibleCompanionStage(ladderCare(7, 3, 2))).toBe("Bloom");
  });
  it("adds Fruit between Bloom and Guardian", () => {
    expect(eligibleCompanionStage(ladderCare(11, 3, 4))).toBe("Fruit");
    expect(eligibleCompanionStage(ladderCare(11, 3, 3))).toBe("Bloom");
  });
  it("rebalances Guardian to five days", () => {
    expect(eligibleCompanionStage(ladderCare(15, 4, 3))).toBe("Bloom"); // 3 days < Fruit's 4
    expect(eligibleCompanionStage(ladderCare(15, 4, 5))).toBe("Guardian");
  });
  it("extends past the old ceiling", () => {
    expect(eligibleCompanionStage(ladderCare(25, 4, 8))).toBe("Elder");
    expect(eligibleCompanionStage(ladderCare(40, 4, 12))).toBe("Radiant");
    expect(eligibleCompanionStage(ladderCare(60, 4, 20))).toBe("Legend");
    expect(eligibleCompanionStage(ladderCare(60, 4, 19))).toBe("Radiant");
  });
});
```

- [ ] **Step 2: Run and verify they fail**

Run: `npx vitest run tests/companion-engine.test.ts`
Expected: FAIL — `Seedling`/`Fruit`/`Elder` are not valid stages yet.

- [ ] **Step 3: Extend `src/types/game.ts`**

Find the existing `COMPANION_STAGES` const (just above line 99) and replace its array with the 10 names, then add the ladder next to it:

```ts
export const COMPANION_STAGES = [
  "Seed", "Sprout", "Seedling", "Bud", "Bloom",
  "Fruit", "Guardian", "Elder", "Radiant", "Legend",
] as const;
export type CompanionStage = (typeof COMPANION_STAGES)[number]; // (already present)

/** Evolution requirements — care count / distinct affinities / distinct WIB days.
 *  Mirrored (display-only) in public/farm/companion-ladder.js; a parity vitest
 *  keeps the two identical. */
export const COMPANION_LADDER: readonly {
  stage: CompanionStage; care: number; affinities: number; days: number;
}[] = [
  { stage: "Seed", care: 0, affinities: 0, days: 0 },
  { stage: "Sprout", care: 1, affinities: 0, days: 0 },
  { stage: "Seedling", care: 2, affinities: 0, days: 2 },
  { stage: "Bud", care: 3, affinities: 2, days: 0 },
  { stage: "Bloom", care: 7, affinities: 3, days: 2 },
  { stage: "Fruit", care: 11, affinities: 3, days: 4 },
  { stage: "Guardian", care: 15, affinities: 4, days: 5 },
  { stage: "Elder", care: 25, affinities: 4, days: 8 },
  { stage: "Radiant", care: 40, affinities: 4, days: 12 },
  { stage: "Legend", care: 60, affinities: 4, days: 20 },
];
```

- [ ] **Step 4: Rewrite the engine's rank + eligibility in `companion-engine.ts`**

Replace line 9's hand-written `STAGE_RANK` literal and the body of `eligibleCompanionStage` (lines 34–42):

```ts
import { COMPANION_LADDER, COMPANION_STAGES } from "@/types/game";

const STAGE_RANK = Object.fromEntries(
  COMPANION_STAGES.map((stage, rank) => [stage, rank]),
) as Record<CompanionStage, number>;

export function careAxes(care: VerifiedCare[]) {
  return {
    careCount: care.length,
    affinityCount: new Set(care.map((item) => affinityForQuest(item.questKey))).size,
    dayCount: new Set(care.map((item) => wibDay(item.completedAt))).size,
  };
}

export function eligibleCompanionStage(care: VerifiedCare[]): CompanionStage {
  const { careCount, affinityCount, dayCount } = careAxes(care);
  for (let i = COMPANION_LADDER.length - 1; i >= 0; i--) {
    const req = COMPANION_LADDER[i];
    if (careCount >= req.care && affinityCount >= req.affinities && dayCount >= req.days) {
      return req.stage;
    }
  }
  return "Seed";
}
```

Also replace the hardcoded slice source at line 68 — `(["Seed","Sprout","Bud","Bloom","Guardian"] as CompanionStage[])` — with `([...COMPANION_STAGES] as CompanionStage[])`.

- [ ] **Step 5: Run the whole companion suite; update stale expectations**

Run: `npx vitest run tests/companion-engine.test.ts`
Pre-existing assertions written against the 5-stage ladder may now differ; update each one according to the new table (typical mapping: an old "Guardian at 15 care / 4 aff / 3 days" expectation becomes `Bloom` — 3 days fails Fruit's 4; an old Bloom/Bud case is unchanged). Do not weaken the new boundary tests.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/game.ts src/game/companion/companion-engine.ts tests/companion-engine.test.ts
git commit -m "feat: 10-stage companion ladder with derived ranks and eligibility"
```

---

### Task 3: Progress counters in the evolution sweep

**Files:**
- Modify: `src/game/companion/companion-engine.ts:44-80` (`missingTable`, `evaluateCompanion`)
- Test: `tests/companion-engine.test.ts`

**Interfaces:**
- Consumes: `careAxes()` from Task 2.
- Produces: `companion_state` rows always carry fresh `care_count`, `affinity_count`, `day_count` after a sweep; `evaluateCompanion` return value includes them. Missing milestone15 columns degrade gracefully (counters skipped, sweep still works).

- [ ] **Step 1: Write failing tests** (the existing file already builds a fake Supabase client for `evaluateCompanion` — follow its fixture pattern; the assertions to add:)

```ts
it("writes progress counters on a non-evolving sweep", async () => {
  // fixture: state already Sprout; care = 1 completed quest (no evolution due)
  // run evaluateCompanion, then:
  expect(upserts.companion_state.at(-1)).toMatchObject({
    care_count: 1, affinity_count: 1, day_count: 1, stage: "Sprout",
  });
});

it("skips counters when milestone15 is missing", async () => {
  // fixture: companion_state upsert rejects once with
  // { code: "PGRST204", message: "Could not find the 'care_count' column" }
  // evaluateCompanion must retry without counter fields and not throw.
});

it("writes one history row per skipped stage on a multi-stage jump", async () => {
  // fixture: state Seed; care = ladderCare(11, 3, 4) → target Fruit.
  // Expect companion_evolutions upserts for Sprout, Seedling, Bud, Bloom,
  // Fruit — in ladder order, each from_stage = the previous stage.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/companion-engine.test.ts`
Expected: FAIL (no counter writes yet).

- [ ] **Step 3: Implement**

In `companion-engine.ts` add next to `missingTable`:

```ts
function missingColumn(error: { code?: string; message: string }) {
  return error.code === "PGRST204" || /could not find the '.+' column/i.test(error.message);
}

async function upsertCompanionState(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("companion_state")
    .upsert(payload, { onConflict: "plant_id" });
  if (!error) return;
  if (missingColumn(error)) {
    // milestone15 not applied yet — retry without the counter columns.
    const { care_count, affinity_count, day_count, ...legacy } = payload;
    const retry = await supabase.from("companion_state")
      .upsert(legacy, { onConflict: "plant_id" });
    if (retry.error) throw new Error(`companion: state update failed: ${retry.error.message}`);
    return;
  }
  throw new Error(`companion: state update failed: ${error.message}`);
}
```

Then in `evaluateCompanion`, after `const target = eligibleCompanionStage(care);` compute `const axes = careAxes(care);` and:

1. Replace the early return (line 63) with: if no evolution is due AND the stored counters differ from `axes`, call `upsertCompanionState` with `{ plant_id, cycle: state.cycle, stage: state.stage, form_key: state.form_key, care_count: axes.careCount, affinity_count: axes.affinityCount, day_count: axes.dayCount, updated_at: now.toISOString() }`, then `return { ...state, care_count: axes.careCount, affinity_count: axes.affinityCount, day_count: axes.dayCount }`. If the counters are unchanged, return `state` untouched (no write churn on every tick).
2. Replace the final `companion_state` upsert (line 77) with `upsertCompanionState(...)` carrying the same counter fields plus the existing stage/form/last_evolved_at payload, and include the counters in the returned object.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/companion-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/companion/companion-engine.ts tests/companion-engine.test.ts
git commit -m "feat: companion sweep persists care/affinity/day progress counters"
```

---

### Task 4: Farm-layer ladder mirror + parity test

**Files:**
- Create: `public/farm/companion-ladder.js`
- Modify: `public/farm/index.html` (script include, next to the existing `strings.js` include)
- Test: Create `tests/companion-ladder-parity.test.ts`

**Interfaces:**
- Produces: `window.PM_LADDER` (array identical to `COMPANION_LADDER`) and `window.PM_NEXT_STAGE(stageName)` → `{ stage, care, affinities, days } | null` for the farm layer; parity is test-enforced.

- [ ] **Step 1: Check how `strings.js` exposes itself** — open `public/farm/strings.js:1-30` and `public/farm/index.html`'s script tags. Match that exact pattern (plain script attaching to `window`, or module export) for the new file, and mirror how the parity vitest imports `strings.js` (see `tests/` for the existing strings parity suite) for Step 3.

- [ ] **Step 2: Write the mirror module**

```js
// public/farm/companion-ladder.js
// Display-only mirror of COMPANION_LADDER in src/types/game.ts.
// tests/companion-ladder-parity.test.ts fails if the two tables drift.
const PM_LADDER = [
  { stage: "Seed", care: 0, affinities: 0, days: 0 },
  { stage: "Sprout", care: 1, affinities: 0, days: 0 },
  { stage: "Seedling", care: 2, affinities: 0, days: 2 },
  { stage: "Bud", care: 3, affinities: 2, days: 0 },
  { stage: "Bloom", care: 7, affinities: 3, days: 2 },
  { stage: "Fruit", care: 11, affinities: 3, days: 4 },
  { stage: "Guardian", care: 15, affinities: 4, days: 5 },
  { stage: "Elder", care: 25, affinities: 4, days: 8 },
  { stage: "Radiant", care: 40, affinities: 4, days: 12 },
  { stage: "Legend", care: 60, affinities: 4, days: 20 },
];
function PM_NEXT_STAGE(stageName) {
  const index = PM_LADDER.findIndex((row) => row.stage === stageName);
  if (index < 0 || index === PM_LADDER.length - 1) return null;
  return PM_LADDER[index + 1];
}
if (typeof window !== "undefined") {
  window.PM_LADDER = PM_LADDER;
  window.PM_NEXT_STAGE = PM_NEXT_STAGE;
}
```

(Adjust the tail — e.g. add `export`s — only if Step 1 showed `strings.js` uses module exports; keep both files consistent.)

- [ ] **Step 3: Write the parity test**

```ts
// tests/companion-ladder-parity.test.ts
import { COMPANION_LADDER } from "@/types/game";
// Import the farm mirror the same way the strings parity test imports strings.js.
import { PM_LADDER } from "../public/farm/companion-ladder.js"; // adjust to Step 1's pattern

it("farm ladder mirror matches the engine ladder exactly", () => {
  expect(PM_LADDER).toEqual(
    COMPANION_LADDER.map(({ stage, care, affinities, days }) => ({ stage, care, affinities, days })),
  );
});
```

- [ ] **Step 4: Add the script include** to `public/farm/index.html`, immediately before the `live.js` include so `window.PM_LADDER` exists when `live.js` boots.

- [ ] **Step 5: Run tests, then commit**

Run: `npx vitest run tests/companion-ladder-parity.test.ts` → PASS.

```bash
git add public/farm/companion-ladder.js public/farm/index.html tests/companion-ladder-parity.test.ts
git commit -m "feat: farm-layer companion ladder mirror with parity test"
```

---

### Task 5: Localized labels + next-stage progress line

**Files:**
- Modify: `public/farm/strings.js` (both `en` and `id` tables)
- Modify: `public/farm/live.js:226-240` (`renderCompanion`) and the `companion_state` select at `:3589` (add the three counter columns)
- Modify: `public/farm/index.html` (add `<div id="companion-next"></div>` directly under the existing `#companion-stage` element)
- Modify: `public/farm/style.css` (style `#companion-next` like `.companion-stage`, one size smaller)

**Interfaces:**
- Consumes: `window.PM_LADDER` / `window.PM_NEXT_STAGE` (Task 4); `care_count/affinity_count/day_count` columns (Tasks 1+3).
- Produces: localized stage/form labels used again by Task 7's ceremony (`t("companionEvolved")`-style lookups via the `PM()` accessor `live.js` already uses for strings).

- [ ] **Step 1: Add strings** (inside the existing `en` and `id` objects; keys must exist in BOTH locales or the parity vitest fails)

```js
// en
companionStage: { Seed: "Seed", Sprout: "Sprout", Seedling: "Seedling", Bud: "Bud", Bloom: "Bloom", Fruit: "Fruit", Guardian: "Guardian", Elder: "Elder", Radiant: "Radiant", Legend: "Legend" },
companionForm: { cool: "Cool-headed", air: "Fresh-air", light: "Sun-chaser", soil: "Soil-wise", steady: "Steady", balanced: "Balanced" },
companionWord: "COMPANION",
companionNext: (stage, care, needCare, days, needDays) => `Next: ${stage} — care ${care}/${needCare} · days ${days}/${needDays}`,
companionMax: "Fully grown — a legend of Jember!",
companionEvolved: (stage) => `Evolved into ${stage}!`,

// id
companionStage: { Seed: "Benih", Sprout: "Kecambah", Seedling: "Semai", Bud: "Kuncup", Bloom: "Mekar", Fruit: "Berbuah", Guardian: "Penjaga", Elder: "Tetua", Radiant: "Bercahaya", Legend: "Legenda" },
companionForm: { cool: "Kepala dingin", air: "Udara segar", light: "Pengejar cahaya", soil: "Paham tanah", steady: "Tekun", balanced: "Seimbang" },
companionWord: "SAHABAT",
companionNext: (stage, care, needCare, days, needDays) => `Berikutnya: ${stage} — rawatan ${care}/${needCare} · hari ${days}/${needDays}`,
companionMax: "Tumbuh penuh — legenda Jember!",
companionEvolved: (stage) => `Berevolusi menjadi ${stage}!`,
```

- [ ] **Step 2: Extend the `companion_state` select** at `live.js:3589` to `select("stage, form_key, cycle, updated_at, care_count, affinity_count, day_count")` (Task 7's ceremony key needs `cycle`) (old DBs without milestone15 return an error for unknown columns via PostgREST — so wrap exactly like the existing `.catch(() => ({ data: null }))` chain already does; on error retry the legacy three-column select so pre-milestone15 keeps rendering).

- [ ] **Step 3: Rewrite `renderCompanion`'s label + progress line** (visual classes stay as-is for now; Task 6 upgrades them)

```js
function renderCompanion(state) {
  if (!state || typeof state.stage !== "string") return;
  const known = (window.PM_LADDER ?? []).some((row) => row.stage === state.stage);
  const stage = known ? state.stage : "Seed";
  const form = typeof state.form_key === "string" ? state.form_key : "balanced";
  const svg = $(".mascot-svg");
  if (svg) {
    for (const row of window.PM_LADDER ?? []) svg.classList.remove(`companion-${row.stage}`);
    svg.classList.add(`companion-${stage}`);
    svg.dataset.companionForm = form;
  }
  const label = $("#companion-stage");
  if (label) {
    const stageName = PM().companionStage?.[stage] ?? stage;
    const formName = PM().companionForm?.[form] ?? form;
    label.textContent = `${PM().companionWord ?? "COMPANION"} · ${stageName} · ${formName}`;
  }
  const next = $("#companion-next");
  if (next) {
    const req = window.PM_NEXT_STAGE?.(stage);
    const haveCounts = Number.isFinite(state.care_count);
    if (!req) {
      next.textContent = PM().companionMax ?? "";
    } else if (haveCounts) {
      next.textContent = PM().companionNext?.(
        PM().companionStage?.[req.stage] ?? req.stage,
        state.care_count, req.care, state.day_count, req.days,
      ) ?? "";
    } else {
      next.textContent = ""; // pre-milestone15: no invented numbers
    }
  }
}
```

- [ ] **Step 4: Verify**

Run: `node --check public/farm/live.js && node --check public/farm/strings.js && npx vitest run` (strings parity + everything else)
Expected: PASS. Then load `http://localhost:3000/?demo=1` once and confirm the label reads localized text (Indonesian default), not `SEED · BALANCED`.

- [ ] **Step 5: Commit**

```bash
git add public/farm/strings.js public/farm/live.js public/farm/index.html public/farm/style.css
git commit -m "feat: localized companion labels and honest next-stage progress line"
```

---

### Task 6: Per-stage mascot visuals + form tint

**Files:**
- Modify: `public/farm/index.html` (new SVG groups inside `.mascot-svg`, after the leaves group and before the first `.mascot-face` group so faces stay on top)
- Modify: `public/farm/style.css:587-591` area (stage rules) + form tint variables

**Interfaces:**
- Consumes: `companion-<Stage>` classes + `data-companion-form` set by `renderCompanion` (Task 5). No JS changes in this task.

- [ ] **Step 1: Add hidden stage-accent groups to the mascot SVG** (pixel-art style: plain rects/circles, `stroke="var(--color-outline)" stroke-width="6"` to match existing parts; every group starts `display:none` via the shared `.stage-extra` class)

```html
<g class="stage-extra stage-seedling"><rect x="112" y="150" width="26" height="12" rx="6" fill="var(--color-forest)"/><rect x="162" y="150" width="26" height="12" rx="6" fill="var(--color-forest)"/></g>
<g class="stage-extra stage-bud"><circle cx="150" cy="92" r="10" fill="var(--companion-accent, #FFDE6A)"/></g>
<g class="stage-extra stage-bloom"><circle cx="150" cy="88" r="8" fill="#fff"/><circle cx="138" cy="94" r="7" fill="var(--companion-accent, #F7A6C1)"/><circle cx="162" cy="94" r="7" fill="var(--companion-accent, #F7A6C1)"/><circle cx="150" cy="102" r="7" fill="var(--companion-accent, #F7A6C1)"/></g>
<g class="stage-extra stage-fruit"><circle cx="128" cy="128" r="8" fill="#E4572E"/><circle cx="172" cy="132" r="8" fill="#E4572E"/></g>
<g class="stage-extra stage-elder"><rect x="134" y="96" width="32" height="10" rx="4" fill="var(--color-forest)"/><rect x="120" y="118" width="14" height="42" rx="6" fill="var(--color-forest)"/></g>
<g class="stage-extra stage-radiant"><circle cx="150" cy="70" r="26" fill="none" stroke="var(--companion-accent, #FFDE6A)" stroke-width="4" opacity="0.7"/></g>
<g class="stage-extra stage-legend"><polygon points="132,58 141,44 150,58 159,44 168,58 168,68 132,68" fill="var(--companion-accent, #FFDE6A)" stroke="var(--color-outline)" stroke-width="4"/></g>
```

(Coordinates target the stem/leaf area of the `viewBox="0 0 300 350"` skeleton at `index.html:117-140`; nudge them visually in Step 3 — position latitude is fine, structure is not.)

- [ ] **Step 2: CSS — show accents cumulatively, keep the existing scale ladder, add the new stages, add form tints**

```css
.mascot-svg .stage-extra { display: none; }
.mascot-svg.companion-Seedling .stage-seedling { display: block; }
.mascot-svg.companion-Bud .stage-seedling, .mascot-svg.companion-Bud .stage-bud { display: block; }
.mascot-svg.companion-Bloom .stage-seedling, .mascot-svg.companion-Bloom .stage-bloom { display: block; }
.mascot-svg.companion-Fruit .stage-seedling, .mascot-svg.companion-Fruit .stage-bloom, .mascot-svg.companion-Fruit .stage-fruit { display: block; }
.mascot-svg.companion-Guardian .stage-seedling, .mascot-svg.companion-Guardian .stage-bloom, .mascot-svg.companion-Guardian .stage-fruit { display: block; }
.mascot-svg.companion-Elder .stage-seedling, .mascot-svg.companion-Elder .stage-bloom, .mascot-svg.companion-Elder .stage-fruit, .mascot-svg.companion-Elder .stage-elder { display: block; }
.mascot-svg.companion-Radiant .stage-seedling, .mascot-svg.companion-Radiant .stage-bloom, .mascot-svg.companion-Radiant .stage-fruit, .mascot-svg.companion-Radiant .stage-elder, .mascot-svg.companion-Radiant .stage-radiant { display: block; }
.mascot-svg.companion-Legend .stage-seedling, .mascot-svg.companion-Legend .stage-bloom, .mascot-svg.companion-Legend .stage-fruit, .mascot-svg.companion-Legend .stage-elder, .mascot-svg.companion-Legend .stage-radiant, .mascot-svg.companion-Legend .stage-legend { display: block; }

/* extend the existing scale ladder (style.css:588-591) */
.mascot-svg.companion-Seedling .animated-leaves { transform: scale(1.05); transform-origin: 150px 140px; }
.mascot-svg.companion-Fruit .animated-leaves { transform: scale(1.15); transform-origin: 150px 140px; filter: saturate(1.2); }
.mascot-svg.companion-Elder .animated-leaves { transform: scale(1.2); transform-origin: 150px 140px; filter: saturate(1.3); }
.mascot-svg.companion-Radiant .animated-leaves { transform: scale(1.22); transform-origin: 150px 140px; filter: saturate(1.35) drop-shadow(0 0 6px #f5c94a); }
.mascot-svg.companion-Legend .animated-leaves { transform: scale(1.25); transform-origin: 150px 140px; filter: saturate(1.4) drop-shadow(0 0 8px #f5c94a); }

/* form tint (audit fix: care-affinity form finally shows on the character) */
.mascot-svg[data-companion-form="cool"] { --companion-accent: #7FD0E8; }
.mascot-svg[data-companion-form="air"] { --companion-accent: #B7E3CC; }
.mascot-svg[data-companion-form="light"] { --companion-accent: #FFDE6A; }
.mascot-svg[data-companion-form="soil"] { --companion-accent: #C79A6B; }
.mascot-svg[data-companion-form="steady"] { --companion-accent: #9BB871; }
.mascot-svg[data-companion-form="balanced"] { --companion-accent: #F7A6C1; }
```

- [ ] **Step 3: Visual QA** — `npm run dev`, open `/?demo=1`, and in the browser console step through every stage: `for (const s of window.PM_LADDER) console.log(s.stage);` then apply each with `document.querySelector(".mascot-svg").classList.add("companion-Legend")` (etc.). Confirm: accents sit on the plant (nudge coordinates if not), faces render above accents, sleep face and petting still work, nothing overlaps the speech bubble at 360px width.

- [ ] **Step 4: Run checks and commit**

Run: `npx vitest run` → PASS (no JS touched; parity/strings suites still green).

```bash
git add public/farm/index.html public/farm/style.css
git commit -m "feat: distinct mascot visuals for all ten companion stages + form tint"
```

---

### Task 7: Evolution ceremony + demo trigger

**Files:**
- Modify: `public/farm/live.js` — new `fxEvolveNow`/`fxEvolve` beside `fxLevelUpNow` (`:694-735`), ceremony trigger inside `renderCompanion`, `PMFx.evolve` beside `PMFx.levelUp` (`:2670-2682`)
- Modify: `public/farm/strings.js` (already has `companionEvolved` from Task 5 — no new keys expected)
- Modify: `public/farm/demo.js` (hotkey `E` + QA typeof row, following the exact pattern of the existing `G` grandpa hotkey and hotkey legend added on 2026-08-09)

**Interfaces:**
- Consumes: `fxEnqueue(tier, fn, ms)`, `PMSfx`/sound cue names from `sfx.js` (use the existing `"chapter"` cue — do NOT invent a new cue name; the audit caught a nonexistent `"levelup"` cue elsewhere), localized labels from Task 5.
- Produces: `window.PMFx.evolve()` for demo.js.

- [ ] **Step 1: Ceremony renderer** (mirror `fxLevelUpNow`'s card structure at `live.js:694-735`)

```js
/** T5: companion evolution ceremony. Presentation only. */
function fxEvolveNow(stage) {
  const stageName = PM().companionStage?.[stage] ?? stage;
  const overlay = document.createElement("div");
  overlay.className = "fx-overlay";
  const card = document.createElement("div");
  card.className = "fx-levelup-card"; // reuse the level-up card look
  card.innerHTML =
    `<div class="fx-levelup-title">${PM().companionEvolved?.(stageName) ?? `Evolved into ${stageName}!`}</div>` +
    `<div class="fx-levelup-sub">${PM().companionWord ?? "COMPANION"} · ${stageName}</div>`;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  spawnConfetti();
  try { PMSfx?.play?.("chapter"); } catch {}
  setTimeout(() => overlay.remove(), 2600);
}
function fxEvolve(stage) { fxEnqueue(5, () => fxEvolveNow(stage), 2800); }
```

(Before writing, check how `fxLevelUpNow` actually mounts/removes its card — if it uses a shared overlay helper instead of a bare div, reuse that helper verbatim.)

- [ ] **Step 2: Trigger from `renderCompanion`** — add a module-level `let lastCompanionStage = null;` and, inside `renderCompanion` after the classes are applied:

```js
const rank = (window.PM_LADDER ?? []).findIndex((row) => row.stage === stage);
const prevRank = (window.PM_LADDER ?? []).findIndex((row) => row.stage === lastCompanionStage);
const seenKey = `${state.cycle ?? 1}:${stage}`;
if (lastCompanionStage !== null && rank > prevRank &&
    localStorage.getItem("pm_evo_seen") !== seenKey) {
  localStorage.setItem("pm_evo_seen", seenKey); // set BEFORE playing — crash-safe, no double ceremony
  fxEvolve(stage);
}
lastCompanionStage = stage;
```

First render sets `lastCompanionStage` without celebrating (existing "first render never celebrates" rule holds because `lastCompanionStage` starts `null`).

- [ ] **Step 3: Demo trigger** — add to the `window.PMFx` object (beside `levelUp()` at `live.js:2670`):

```js
/** T5 evolution ceremony preview for the next ladder stage. Display only —
 *  real companion_state re-asserts on the next data render. */
evolve() {
  const svg = $(".mascot-svg");
  const current = (window.PM_LADDER ?? []).find((row) => svg?.classList.contains(`companion-${row.stage}`))?.stage ?? "Seed";
  const next = window.PM_NEXT_STAGE?.(current);
  if (!next) return;
  for (const row of window.PM_LADDER ?? []) svg?.classList.remove(`companion-${row.stage}`);
  svg?.classList.add(`companion-${next.stage}`);
  fxEvolve(next.stage);
},
```

- [ ] **Step 4: demo.js hotkey `E`** — copy the `G` hotkey's switch-case + legend-row + QA-check pattern exactly: `case "e": case "E": window.PMFx?.evolve?.();` with legend line `E · evolution ceremony` and a QA overlay `typeof window.PMFx?.evolve === "function"` row.

- [ ] **Step 5: Verify**

Run: `node --check public/farm/live.js && node --check public/farm/demo.js && npx vitest run` → PASS.
Manual: on `/?demo=1` press `E` twice — two queued ceremonies, stage advances visually each time, real state restores on next poll; reload — no replay (pm_evo_seen).

- [ ] **Step 6: Commit**

```bash
git add public/farm/live.js public/farm/demo.js
git commit -m "feat: companion evolution ceremony with demo hotkey"
```

---

### Task 8: React localization, reference sweep, docs, final QA

**Files:**
- Modify: `src/lib/i18n.ts` (companion stage/form dictionaries), `src/app/diary/page.tsx:117,141-143`
- Check & extend if they enumerate stages: `src/game/emotions/event-emotions.ts`, `src/game/personality/dialogue-bank.ts`, `src/game/badges/keepsakes.ts`, `src/game/demo/demo-max.ts`, `src/game/demo/demo-reset.ts`, `src/game/events/event-router.ts` (+ their tests)
- Modify: `docs/RUNBOOK-filming-and-golive.md` (milestone table: add row 15 in all three languages), `README.md` (evolution section if it lists the 5 stages)

**Interfaces:**
- Consumes: `COMPANION_STAGES` / `COMPANION_LADDER` from Task 2; localized names mirroring Task 5's tables.

- [ ] **Step 1: i18n dictionaries** — in `src/lib/i18n.ts` add `companionStageNames: Record<CompanionStage, { en: string; id: string }>` and `companionFormNames` using exactly the same words as Task 5's strings.js tables (en "Seedling"/id "Semai", etc.). In `diary/page.tsx` replace the raw `${data.stage}` (line 117) and `${companion.stage} · ${companion.form_key}` (line 142) with lookups through those dictionaries, falling back to the raw value for unknown strings.

- [ ] **Step 2: Reference sweep** — run `grep -rn "Guardian\|'Bloom'\|\"Bloom\"" src tests --include="*.ts" --include="*.tsx"` and for every site that enumerates the 5-stage ladder decide: (a) tables keyed by stage (emotions/dialogue) get entries for the 5 new stages — reuse each file's existing Guardian entry as the template and vary the copy per stage in both locales; (b) logic reading `COMPANION_STAGES` is already correct via Task 2; (c) demo fixtures (`demo-max`, `demo-reset`) that hardcode `"Guardian"` as "max stage" switch to `COMPANION_STAGES.at(-1)`. Update the matching tests the same way.

- [ ] **Step 3: Docs** — runbook §1.2: add `| 15 | milestone15-evolution-ladder.sql | 10-stage companion evolution ladder + progress counters |` (EN), `| 15 | milestone15-evolution-ladder.sql | tangga evolusi companion 10 tahap + penghitung progres |` (ID), `| 15 | milestone15-evolution-ladder.sql | 10단계 컴패니언 진화 사다리 + 진행 카운터 |` (KO); bump "all fourteen"→"all fifteen" / "keempat belas"→"kelima belas" / "열네 개"→"열다섯 개" and "milestone9–milestone14"→"milestone9–milestone15" ("verify all six"→"all seven") in all three sections. README: update the companion/evolution feature bullet to name the 10-stage ladder.

- [ ] **Step 4: Full QA**

Run: `npx vitest run` (expect 315+ tests, all green) then `npm run build` (expect "Compiled successfully" + type check clean).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ten-stage evolution across React surfaces, docs, and demo fixtures"
```

---

## Post-merge user action

Run `supabase/milestone15-evolution-ladder.sql` in the Supabase SQL editor (after milestone11). Until then the game keeps working at the old 5-stage ceiling with no progress line — by design.
