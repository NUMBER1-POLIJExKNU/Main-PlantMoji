# UI/UX Polish Implementation Plan (overnight, 2026-08-10 → 08-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise PlantMoji to demo-grade polish: zero visible bugs, Bahasa-first everywhere, intuitive without explanation, and a livelier Jamkachu — implemented in independently shippable waves overnight.

**Architecture:** No new systems. Every task fixes or finishes existing surfaces: the vanilla farm layer (`public/farm/`), the React shell (`src/app`, `src/components`), and the shared token/CSS layer. Source of truth for the defect list is the adversarially-verified audit (workflow `wf_47c7394d-a74`, 47 confirmed findings, full text in the session task output).

**Tech Stack:** Next.js 16, vanilla JS farm layer, vitest source-contract tests, WebAudio sfx.

## Global Constraints

- All player copy exists in **en AND id**; id is the default. Parity is contract-tested.
- **No engineering vocabulary in player UI** (sensors/XP writes/practice-mode/presentation-only) — that language lives in code comments and the `?demo=1` presenter overlay only.
- Farm layer is display-only; engine never demotes; quest truth = sensor-verified only; taps never grant rewards.
- Missing migrations / offline Supabase = graceful, presentable degradation — never dev placeholders.
- WFK lens on every decision: (a) visible educational value, (b) sustainability — self-explanatory UX that runs without an operator, (c) Jember-local social value.
- Every wave ends with the full QA gate: `npx vitest run` + `npm run lint` + `npm run build` all green before commit.
- A concurrent agent (Codex) edits `src/components/**` and `src/app/globals.css` live: re-read files immediately before editing, stage own hunks only (git apply --cached with filtered patches when a shared file is dirty), never sweep foreign WIP, `git pull --rebase --autostash` before push and re-check for autostash conflicts after.

---

### Wave 1: broken-visuals bug sweep (all S-effort, zero-risk fixes)

**Files:** `public/farm/style.css`, `public/farm/index.html`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/settings/page.tsx`, `src/app/diary/page.tsx`, `src/components/monitoring-live.tsx`, `src/app/diary/diary.css`, `src/components/collection-tabs.tsx`

- [ ] `.badge[hidden] { display:none }` in farm style.css (seeds "0 Benih" chip shows forever — audit farm-home #1)
- [ ] `:root` tokens `--font-pixel: var(--font-display)` + `--color-text-muted: #7B8876` in farm style.css (identity line renders 16px Geist — farm-home #3)
- [ ] Fix `--color-harvest` focus ring → `var(--color-water)` in globals.css (invisible keyboard focus — a11y #4)
- [ ] Night-theme legibility: wisdom-trial ink `#243421` pinned (white-on-white quiz — a11y #1), `.pm-story-node > span { color:#243421 }` (a11y #2), diary night summary/kicker colors (a11y #3), INK_MUTED night remap (a11y #6)
- [ ] `viewport-fit=cover` in layout.tsx viewport export + farm index.html meta (safe-area math inert on iPhone — mobile #5)
- [ ] Camera process rail 2-col on ≤760px with matching specificity (labels wrap to 3 chars — mobile #3)
- [ ] More-sheet z-index above guide FAB (FAB steals Settings tap — mobile #1)
- [ ] Settings/diary inputs `text-base` + appearance select 16px (iOS auto-zoom — mobile #2)
- [ ] Appearance panel static flow on ≤800px (covers Settings header — mobile #4)
- [ ] Demo director bar lifted above dock on ≤760px (covers nav — mobile #7)
- [ ] Farm ambient animations behind `prefers-reduced-motion: no-preference` (clouds/particles/weather/bounce — a11y #5)
- [ ] `motion-safe:animate-pulse` in monitoring-live.tsx (a11y #8)
- [ ] Sub-40px touch targets: shop preview close/toggle, More sheet close → ≥40px (mobile #6)
- [ ] QA gate → commit → push

### Wave 2: Bahasa-first farm layer (id players never see stray English)

**Files:** `public/farm/live.js`, `public/farm/strings.js`, `public/farm/index.html`, `public/farm/quiz.js`, `src/lib/i18n.ts`, `tests/strings-parity` (existing contract)

- [ ] MOODS bubble templates localized (en+id) via strings.js; index.html static bubble → Indonesian Happy line (copy #1 / farm-home #2 — the single most camera-visible string)
- [ ] Quest titles localized table (id verbatim from QUEST_COPY_ID so both pages share one name — copy #2)
- [ ] Farmer tag via `t("npc.ai")` (farm-home #4)
- [ ] Quiz chip `data-i18n="hud.quiz"` + COPY entries; quiz.js `CASE →KASUS`, "FARM CASE" fallback, category names (farm-home #5, copy #4)
- [ ] Memory bubbles: badge display names from strings.js, prettifyKey fallback only (copy #8)
- [ ] Mood vocabulary unified: one id + one en name per mood across farm strings and MOOD_COPY (copy #6)
- [ ] Quest verify console: replace techy 4-line English console with the already-localized amber "checking" line (kills text clutter AND the i18n gap — copy #7; final call deferred to text-density audit)
- [ ] Tap-a-tile comments driven by the active crop profile (two pH truths taught — copy #5; educational integrity = WFK social value)
- [ ] QA gate → commit → push

### Wave 3: React pages — locale + honest states

**Files:** `src/lib/plant-messages.ts`, `src/app/reports/page.tsx`, `src/lib/queries.ts`, `src/lib/i18n.ts`, `src/components/monitoring-live.tsx`, `src/app/quests/page.tsx`, `src/components/notice.tsx`, all nine `page.tsx` Notice call sites, `src/app/plants/page.tsx`, `src/app/diary/page.tsx`

- [ ] getWeeklyReportNarration takes locale; id templates for the five personalities; locale into AI call + cache key (react #2 / copy #3)
- [ ] STAGE_LABELS display map (stored enum untouched) for settings/diary selects + postcards (react #3)
- [ ] monitoring "Live reading"/"No data" localized (react #4)
- [ ] /quests XP-boost pill id branch (react #5)
- [ ] Notice locale-aware chrome + shared bilingual table for the nine call sites (react #6)
- [ ] /plants stops blocking navigation on live Gemini: reuse the existing client-side `/api/environment-explanation` path or Suspense with deterministic fallback (react #1 — nav freeze up to 4s)
- [ ] Diary/camera PageHeader eyebrows; diary icon 📖; diary empty state in pm-panel with pointer to the form (react #7, #8)
- [ ] QA gate → commit → push

### Wave 4: feedback & juice (nothing feels dead)

**Files:** `public/farm/sfx.js`, `src/app/globals.css`, `src/app/shop/shop.css`, `src/components/shop-grid.tsx`, `src/app/shop/loading.tsx` (new), `src/app/camera/loading.tsx` (new), `src/components/pixel-loading.tsx`, `src/components/pixel-loading-toy.tsx`, `src/components/collection-tabs.tsx`, `src/components/reno-app-shell.tsx`, `public/farm/live.js`, `src/components/quest-done-pill.tsx`

- [ ] Register missing sfx cues `error` + `levelup` (collection currently plays dead cues — feedback #3)
- [ ] Wire orphaned bespoke cues: relief* by care mood, emberCrackle on streak tier, stamp on done-pill (feedback #6)
- [ ] shop/camera `loading.tsx` with PixelLoading variants (tab tap freezes silent — feedback #2)
- [ ] Shop tabs/filters/preview press states + tick sfx; buy/equip busy label "Menanam…" + aria-busy, only pressed card dims (feedback #4, #5)
- [ ] Loading toy plays "pet" on poke (feedback #7); locale switch :active/:focus-visible + tick (feedback #8)
- [ ] Sound toggle clearance on React mobile routes (covers ID/EN switch — feedback #1)
- [ ] QA gate → commit → push

### Wave 5: Jamkachu expression variety (direct user request)

**Files:** `public/farm/live.js`, `public/farm/style.css` (+ mirror check on `src/components/mascot.tsx` if Codex hasn't taken it)

- [ ] Per-mood tap-reaction face pools (3+ faces per mood instead of one fixed response); deterministic pick per tap count so repeat taps cycle expressions
- [ ] Occasional idle micro-expressions on the farm mascot (blink/glance) behind reduced-motion gate, night-sleep respected
- [ ] Contract intact: taps grant nothing, quiet gates (hatch/tour) respected, first render never celebrates
- [ ] Pin behavior in a source-contract test
- [ ] QA gate → commit → push

### Wave 6: text diet & intuitiveness (input: two Explore agents, pending)

- [ ] Apply confirmed wall-of-text / dilution / competing / unintuitive findings from the two text-density audits (farm + React)
- [ ] Every cut re-checked against the WFK lens: educational content is made GLANCEABLE (why-cards stay, but behind a tap), never deleted
- [ ] QA gate → commit → push

### Wave 7: sustainability hardening (if night time allows)

- [ ] Vendor Google Fonts woff2 into `/farm/vendor/fonts` with local @font-face (farm identity must survive offline — farm-home #7; same rationale as vendored supabase.js), or minimally add preconnect hints
- [ ] Disconnected-Supabase home: presentable defaults instead of "--" placeholders (farm-home #6)
- [ ] Final adversarial review pass over the night's diff + full QA → commit → push
- [ ] Morning report (Korean) + memory update

## Self-Review Notes

- Spec coverage: all 46 non-deferred confirmed audit findings map to a wave; the 1 refuted finding is dropped; text-density findings integrate at Wave 6 by design.
- No placeholders: every task names exact files and the concrete change; audit output holds the full per-finding detail (problem + fix strings) for implementers.
- Type consistency: no new cross-task interfaces — waves touch disjoint concerns; shared-file contention (globals.css, collection-tabs.tsx) is handled by the Global Constraints staging rule, not by task ordering.
