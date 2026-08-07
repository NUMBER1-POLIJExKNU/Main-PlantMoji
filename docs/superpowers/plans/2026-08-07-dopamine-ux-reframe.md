# Character-First UX Reframe + Dopamine Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn PlantMoji from "IoT dashboard" into "Tamagotchi + real plant care" — Jamkachu-first home hierarchy plus the full approved dopamine mechanic set — in 3 days.

**Architecture:** All home-screen work happens in the static farm trio (`public/farm/index.html` / `style.css` / `live.js`) which `/` rewrites to; new capabilities land as three new static files (`strings.js`, `sfx.js`, `demo.js`) loaded before `live.js`. The only backend change is the deterministic Lucky ×2 second `awardXp` call plus one SQL migration (bond_events → realtime). React pages get small client islands.

**Tech Stack:** Vanilla ES modules + WebAudio (no external assets), Next.js 16 App Router, Supabase JS + realtime, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-07-dopamine-ux-reframe-design.md` — read it first; its §4 ethics guardrails override everything.

## Global Constraints

- All UI copy 100% English; every new string lives in `public/farm/strings.js` (`window.PM_STRINGS`).
- Taps/petting/buttons NEVER grant XP; no hidden tap counters.
- Every new effect: respect `prefersReducedMotion()` (live.js:98) and the `MAX_PARTICLES = 120` budget; FX only fire on data *diffs*, never on first render or poll refresh.
- Everything degrades silently when Supabase is unconfigured (guard: `if (!supabase) return` pattern already in live.js).
- Palette tokens (spec §2.5): primary `#5FAE45`, dark text `#243421`, background `#F4FAF1`, surface `#FFFFFF`, border `#BCD3B4`. Keep existing cozy-green direction; do not invent new hues.
- Typography: Press Start 2P = headings/level/quest names/celebration only; body = system sans stack on farm page (`"Segoe UI", system-ui, sans-serif` via `--font-body`), `next/font` Inter on React pages.
- Backend never writes Node-RED tables (`sensor_readings`, `plant_state_events`, `game_state`, `game_events`). XP only via `awardXp()` (idempotent `reward_key`).
- Commit after every green task; never commit `.env.local`; check `git status` for other sessions' WIP before each commit — commit only files this plan owns.
- Sound: default ON, unlock on first `pointerdown`, mute toggle persisted at `localStorage["pm_sound"]` (`"off"` = muted, anything else = on).

## Execution Lanes (file-contention map)

- **Lane HOME (serial, one owner):** `index.html`, `style.css`, `live.js` — Tasks 2, 3, 6, 8, 9 then Day-2 Tasks 11–15 in order. Never two agents in this lane at once.
- **Lane ISO (parallel-safe):** Task 1 (tokens only touches `style.css` — run BEFORE lane HOME starts), Task 4 (`strings.js`), Task 5 (`sfx.js`), Task 7 (server lucky), Task 16 (collection island), Task 18 (reports island), Task 10 (settings). 
- **Lane FINAL:** Tasks 17, 19–22 after both lanes merge.

---

### Task 1: Contrast tokens + typography tiers + layout diet (farm CSS)

**Files:** Modify: `public/farm/style.css`

**Interfaces:** Produces CSS vars consumed by every later task: `--color-primary:#5FAE45`, `--color-text:#243421`, `--color-bg:#F4FAF1`, `--color-surface:#FFFFFF`, `--color-border:#BCD3B4`, `--font-display:'Press Start 2P',monospace`, `--font-body:"Segoe UI",system-ui,sans-serif`.

- [ ] Add the seven vars above to `:root` (keep all existing `--color-*` vars — they still drive the mascot/pot).
- [ ] Body copy → `--font-body`: `body { font-family: var(--font-body); color: var(--color-text); }`; keep `--font-display` on `h1, h2, h3, .username, .v-perc → remove, .badge, .pixel-btn, .brand h1` (headings/game elements only). Vital labels (`.v-label`) switch to body font; numbers may stay display.
- [ ] Cards: `.panel-glass { background: var(--color-surface); border: 3px solid var(--color-border); box-shadow: 0 4px 0 rgba(36,52,33,.15); }` — replace translucent light-on-light.
- [ ] Sidebar `.sidebar` width → `240px`; nav item font-size down accordingly.
- [ ] Add `.pm-card { max-width: 640px; }` utility (React settings reuses the value in Tailwind as `max-w-2xl`).
- [ ] Verify: open `http://localhost:3000/` — cards clearly separated from background, body text readable. Commit `style: contrast tokens, two-tier typography, slim sidebar`.

### Task 2: Home hierarchy restructure + nav + logo

**Files:** Modify: `public/farm/index.html`, `public/farm/style.css`, `public/farm/live.js`

**Interfaces:** Produces DOM ids consumed by later tasks: `#char-name`, `#char-mood`, `#current-quest` (name span `#cq-name`, progress span `#cq-progress`), `#env-strip` (spans `#env-temp #env-hum #env-light #env-ph`), `#hp-inline`. live.js exports nothing; render fns update these ids.

- [ ] Restructure `<main class="game-world">` to spec §2.1 order: mascot stage top (unchanged svg), then under it `<div class="char-id"><h2 id="char-name">JAMKACHU</h2><div id="char-mood">--</div></div>`, speech bubble stays attached to mascot, then `<div id="current-quest" class="panel-glass">🔥 <span id="cq-name">No active quest</span> <span id="cq-progress"></span></div>`, then the existing bond/XP block (move `.user-gamification` here from hud-top; add `<span id="hp-inline">HP --</span>` beside the XP bar), streak badge stays inside it, then divider, then `<div id="env-strip" class="panel-glass">🌡 <span id="env-temp">--°C</span> · 💧 <span id="env-hum">--%</span> · ☀️ <span id="env-light">--</span> · ⚗️ <span id="env-ph">pH --</span></div>`. Delete the old 5-row `.mini-sensors` panel (HP row moves to `#hp-inline`; detail lives in /monitoring).
- [ ] Nav (spec §2.3): `Home` → `/`, `Quests` 📜 → `/quests`, `Growth Diary` 🌱 → `/settings`, `Plant Status` 📈 → `/monitoring`, `Collection` 🏆 → `/collection`, `Settings` ⚙️ → `/settings`. Remove Camera AI + Shop `<a>` entirely. Brand h1 → `PLANT<br>MOJI`.
- [ ] live.js: update `renderSensors()` to write `#env-*` spans; `renderHp()` → `#hp-inline` text + color class; `renderBond()` unchanged targets still exist; add `renderQuestSlot(quests)` called from `refresh()`/`trackQuests()`: picks first ACTIVE else VERIFYING quest, writes `QUEST_META[quest_key].title` to `#cq-name`, and for maintain quests `elapsed/target min`, for VERIFYING `"verifying…"`, else empty to `#cq-progress`.
- [ ] Verify manually (both configured and unconfigured Supabase), `node --check public/farm/live.js`. Commit `feat: character-first home hierarchy, de-technicalized nav`.

### Task 3: Jamkachu mood faces + idle life

**Files:** Modify: `public/farm/index.html` (SVG), `public/farm/style.css`, `public/farm/live.js`

**Interfaces:** Produces `setMascotMood(state)` in live.js; mood → face class map `MOOD_FACE = {Happy:"face-happy", Overheating:"face-hot", DryAir:"face-dry", Sleepy:"face-sleepy", SoilAcidic:"face-acidic", SoilAlkaline:"face-alkaline"}`. `#char-mood` word from `PM_STRINGS.moods` (Task 4; until then hardcode English words, refactor in Task 4).

- [ ] In the mascot SVG add five more `<g class="mascot-face" data-face="...">` variants (hot: slanted brows + sweat-drop rect + deep cheeks; dry: X eyes; sleepy: closed-line eyes + "z" rects; acidic: wavy mouth + green cheek tint; alkaline: pinched eyes + zigzag mouth). All hidden by default: `.mascot-face[data-face]{display:none}` and `.mascot-svg.face-hot [data-face="hot"]{display:block}` etc.; default happy group shows when class list empty.
- [ ] `setMascotMood(state)`: swaps the `face-*` class on `.mascot-svg`, sets `#char-mood` text + emoji (😊🥵😵😴🤢😖). Call from `renderPlant()` where mood is already diffed; keep `fxMoodRecovered` behavior.
- [ ] Idle: CSS `@keyframes pm-blink { 0%,96%{transform:scaleY(1)} 98%{transform:scaleY(.1)} }` on eye rects (wrap eyes in `<g class="eyes">`), 5s loop, and existing breath sway stays. Gate both behind `@media (prefers-reduced-motion: no-preference)`.
- [ ] Verify: in DevTools run `setMascotMood("Overheating")` etc. for all six; `node --check`. Commit `feat: Jamkachu six mood faces + idle blink`.

### Task 4: String table

**Files:** Create: `public/farm/strings.js` · Modify: `index.html` (script tag before live.js), `live.js` (use it)

**Interfaces:** Produces `window.PM_STRINGS = { moods: {Happy:"Happy",...}, reasons: {quest:"Quest complete", lucky:"Lucky ×2!", badge:"New badge", chapter:"Story unlocked", streak:"Streak bonus", mood:"New mood found", daily:"Daily challenge", growth:"Diary entry"}, ritual: {water:"...", fertilize:"..."}, streakKeeper: {active:(d)=>`🔥 ${d} days going — Jamkachu would love a visit today.`, broken:"Every streak starts at day one. Welcome back!"}, luckyOdds:"1 in 8 quests sprouts a lucky bonus!", petting:[...5 lines], demoTag:"DEMO" }` (plain script, not module, so it loads sync before live.js).

- [ ] Write the file with ALL copy from spec §3 tables verbatim; every later task pulls copy from here — grep live.js for existing hardcoded FX strings ("LEVEL UP!", "Quest complete!") and move them in.
- [ ] `<script src="/farm/strings.js"></script>` before the live.js module tag. live.js references `window.PM_STRINGS` with fallback `|| {}` guards.
- [ ] Test `tests/strings.test.ts`: read the file with `fs`, `new Function` it with a stub window, assert every `reasons` key in `{quest,lucky,badge,chapter,streak,mood,daily,growth}` exists and all values are non-empty English strings. Run, commit `feat: central UI string table`.

### Task 5: 8-bit SFX engine + mute toggle + haptics helper

**Files:** Create: `public/farm/sfx.js` · Modify: `index.html`, `style.css` (toggle button), `src/app/layout.tsx` (⚠ reno-owned: ONLY add `<script src="/farm/strings.js"/><script src="/farm/sfx.js"/>` tags — check `git status` first)

**Interfaces:** Produces `window.PMSfx = { play(cue), muted():boolean, toggle():boolean, buzz(ms) }`. Cues: `"blip","coin","cascade","pod","jackpot","fanfare","chapter","pet","splash","whoosh","tick"`. `buzz(ms)` wraps `navigator.vibrate?.(ms)` and is a no-op when muted.

- [ ] Implement: lazy `AudioContext` created on first `pointerdown` (capture-phase listener, once). Each cue = square/triangle oscillator + gain envelope, e.g. `coin`: square 988Hz→1319Hz 2-step 90ms; `jackpot`: 4-note rising arpeggio (C5 E5 G5 C6, 60ms each); `fanfare`: 6 notes 500ms; `chapter`: 2-bar 8-note motif; `pet`: triangle 300→500Hz 80ms; `splash`: filtered noise burst 120ms (white noise buffer through lowpass); `whoosh`: noise + rising bandpass; `tick`/`blip`: 30–50ms single square. Per-category rate limit: skip if same cue played <1.5s ago. `muted()` reads localStorage each call; `toggle()` flips + fires `storage` event manually for same-page listeners; if ctx state stays `"suspended"` (policy-blocked), render the toggle with a crossed-out speaker and keep silent.
- [ ] Toggle button: fixed top-right pixel speaker `🔊/🔇` (`#sound-toggle`), injected by sfx.js itself so React pages get it too; Press Start 2P glyph, `aria-pressed`.
- [ ] Wire existing live.js FX: `fxXpGain`→`coin`, `fxLevelUp`→`fanfare`+`buzz(30)`, `celebrateQuest`→`whoosh`, `fxStreakUp`→`blip`, `fxMoodRecovered`→`pet`.
- [ ] Verify by hand on `/` and `/quests` (toggle persists across pages); `node --check`. Commit `feat: WebAudio 8-bit SFX engine, default on with mute`.

### Task 6: Celebration queue

**Files:** Modify: `public/farm/live.js`

**Interfaces:** Produces `fxEnqueue(tier, runFn, durationMs)` — tiers 1–5; queue plays strictly in enqueue order EXCEPT a higher tier arriving while idle-adjacent items wait jumps ahead of lower tiers not yet started; per-item duration cap `[T1:300, T2:1200, T3:2600, T4:3500, T5:8000]`; total backlog cap 6s — when exceeded, T1/T2 items collapse (merge amounts into one chip). All later FX route through this.

- [ ] Implement as a simple array + `playing` flag; `runFn` receives a `done` callback but the queue also force-advances at the duration cap (`setTimeout`).
- [ ] Reroute existing direct calls (`fxXpGain`, `fxLevelUp`, `celebrateQuest`, `fxStreakUp`) through `fxEnqueue` with tiers 2/4/3/2.
- [ ] Sanity test in DevTools: fire `fxEnqueue` ×5 mixed tiers → sequential, no overlap. `node --check`, commit `feat: celebration queue with tier budget`.

### Task 7: Lucky Sprout ×2 (server) + migration

**Files:** Create: `src/game/random/lucky.ts`, `supabase/milestone8-dopamine.sql`, Test: `tests/lucky.test.ts` · Modify: `src/game/events/event-router.ts`

**Interfaces:** Produces `isLuckyQuest(questId: string): boolean` and `luckyRewardKey(questId: string): string` (`"lucky:" + questId`), reason string `` `lucky-bonus:${quest.quest_key}` `` (Reason Chips Task 14 matches prefix `lucky-bonus:`).

- [ ] Failing test first:
```ts
import { isLuckyQuest, luckyRewardKey } from "@/game/random/lucky";
it("is deterministic", () => { expect(isLuckyQuest("q-1")).toBe(isLuckyQuest("q-1")); });
it("hits roughly 1/8", () => {
  const hits = Array.from({length: 8000}, (_, i) => isLuckyQuest(`q-${i}`)).filter(Boolean).length;
  expect(hits).toBeGreaterThan(600); expect(hits).toBeLessThan(1400);
});
it("builds the ledger key", () => expect(luckyRewardKey("abc")).toBe("lucky:abc"));
```
- [ ] Implement `lucky.ts` reusing `hashDailyKey` from `@/game/random/daily-events`: `hashDailyKey(\`lucky:${questId}\`) % 8 === 0`. Run tests → pass.
- [ ] `event-router.ts` settle block (after the base `awardXp(...rewardKeyFor(quest)...)` succeeds, ~line 245): 
```ts
if (isLuckyQuest(quest.id)) {
  await awardXp(supabase, plantId, luckyRewardKey(quest.id), amount, `lucky-bonus:${quest.quest_key}`);
}
```
- [ ] `milestone8-dopamine.sql`: `alter publication supabase_realtime add table public.bond_events;` (+ header comment: run in Supabase SQL Editor; safe to re-run guard `do $$ begin ... exception when duplicate_object then null; end $$;`).
- [ ] Full vitest run green, commit `feat: deterministic lucky x2 quest bonus + bond_events realtime migration`.

### Task 8: Rituals + petting + universal micro-juice

**Files:** Modify: `public/farm/live.js`, `index.html`, `style.css`

**Interfaces:** Consumes `PMSfx`, `PM_STRINGS.ritual/petting`. Produces `spawnDroplets(rect,n)` (blue square particles falling) reused by Task 11.

- [ ] WATER: `pointerdown` → 3px press CSS (`:active` already exists — add `.pressed` class for touch), `splash` cue, `spawnDroplets` over mascot, mascot quick bounce, then once per 30s max a floating why-card chip: `PM_STRINGS.ritual.water` ending "Real care = real XP. The sensors will notice." FERTILIZE: same shape, `tick` cue + green sparkles + `ritual.fertilize`. Zero writes, zero XP.
- [ ] Petting: `pointerdown` on `.mascot-wrapper` → squash-stretch (`transform: scale(1.06,.94)` 150ms), heart pixel particle, `pet` cue, rotate through `PM_STRINGS.petting` lines in the speech bubble (restore real mood message after 4s). 600ms cooldown; every 5th tap within 30s → yawn line + 10s satiation (no counter persisted anywhere).
- [ ] Micro-juice: ensure ALL `.pixel-btn` and nav links get `blip` on press via one delegated listener; keep sub-100ms (no awaits before visual response).
- [ ] `node --check`, manual pass, commit `feat: living care buttons, Jamkachu petting, button micro-juice`.

### Task 9: Tap-to-Claim Reward Pod

**Files:** Modify: `public/farm/live.js`, `style.css`

**Interfaces:** Rewires `celebrateQuest(quest)`: instead of immediate banner it now enqueues T3 `podDrop(quest)`. Produces `podDrop` internally; on pop calls existing banner + Task-13 cascade if present (else `fxXpGain`).

- [ ] Pod: 48×48 pixel seed-pod div (CSS art: layered box-shadows) drops (steps(6) fall) beside mascot, wiggles every 1.2s, `pointer-events:auto` on the pod ONLY. Tap → `pod` cue + `buzz(15)` + burst confetti + banner + XP presentation; auto-burst at 8s and on `visibilitychange` hidden. Only one pod at a time — additional completions queue behind (fxEnqueue handles).
- [ ] Reduced-motion: pod appears without fall/wiggle, still tappable.
- [ ] Manual test incl. ignoring the pod; `node --check`; commit `feat: tap-to-claim reward pod`.

### Task 10: Demo Max hide + settings diet + goal-gradient label

**Files:** Modify: `src/app/settings/page.tsx`, `src/components/demo-max-form.tsx` (wrap), `public/farm/live.js` (label)

- [ ] Settings: render `<DemoMaxForm/>` only when `searchParams.demo === "1"` (server component reads `searchParams` — Next 16: `await searchParams`). Cards get `max-w-2xl mx-auto`; inputs `w-auto`/`max-w-xs`; button content-width.
- [ ] live.js `renderBond`: bar label `#xp-label` → `` `${totalXp % 100}/100 · ${100 - (totalXp % 100)} to Lv.${level + 1}` `` (add span in index.html near xp bar).
- [ ] `next build` passes; commit `feat: hide demo panel behind ?demo=1, settings layout diet, goal-gradient XP label`.

### Task 11: Causal Echo (Day 2 starts)

**Files:** Modify: `public/farm/live.js`

**Interfaces:** Consumes `renderSensors` prev-value trackers (add `prevSensors` object starting `null` — first render silent), `spawnDroplets`, `floatChip`, VERIFYING set from Task 2's `renderQuestSlot`.

- [ ] On diff: humidity +8pts → chip `"Air +${d}% — Jamkachu breathes easy!"` over `#env-hum`; temp entering 18–28 from outside → `"Nice and cool again"`; light 0→1 → `"Sunshine!"`. If any quest VERIFYING: chip text `"Sensor saw your care — verifying…"` instead (T2 tier). Throttle: one echo chip per sensor per 5 min.
- [ ] `node --check`, commit `feat: causal echo chips bind real care to feedback`.

### Task 12: Verifying Shimmer

**Files:** Modify: `public/farm/live.js`, `style.css`

- [ ] `renderQuestSlot`: VERIFYING quest renders `#current-quest` in amber with 🔍 + three blinking dots (CSS steps animation) + "Sensor is checking…", soft `tick` every 2s (max 5 ticks). On transition VERIFYING→COMPLETED in `trackQuest`: enqueue 600ms hold (overlay dim 10% + 3-note rising arpeggio via `cascade` cue) then the pod. Already-COMPLETED arrivals skip the hold (existing 5-min guard).
- [ ] Commit `feat: verifying shimmer anticipation`.

### Task 13: XP Orb Cascade

**Files:** Modify: `public/farm/live.js`

**Interfaces:** Replaces the XP presentation inside pod-pop and `fxXpGain`: `orbCascade(amount, {gold})` — ceil(amount/10) orbs, cap 8 (16 when `gold`), each a 10px square flying a 400ms two-keyframe arc (CSS custom props for start/end, `transform` only), landing calls `setXpBar` incremental share + `animateXpCount` tick + pentatonic blip rising per index (`coin` cue with `detune` per orb).
- [ ] Reduced-motion → existing single count-up path unchanged. Respect MAX_PARTICLES.
- [ ] Manual: complete a quest in dev (or DevTools call) — orbs land sequentially <2.5s total. Commit `feat: xp orb cascade`.

### Task 14: Reason Chips (bond_events realtime)

**Files:** Modify: `public/farm/live.js`

**Interfaces:** Consumes migration Task 7 (graceful without it), `PM_STRINGS.reasons`. Reason→label mapping by prefix: `lucky-bonus:`→`reasons.lucky`, `badge:`→badge, `chapter:`→chapter, `streak-milestone:`→streak, `mood:`→mood, `daily:`→daily, `growth`→growth, else quest.

- [ ] Subscribe `bond_events` INSERTs on channel; on `XP_AWARDED` set `pendingReason = label` (10s TTL). `fxXpGain`/orb chip text becomes `` `+${delta} XP · ${pendingReason ?? ""}` ``. When `lucky-bonus:` arrives: after normal celebration enqueue T3 gold `LUCKY! ×2` stamp (scale-slam, gold confetti, `jackpot` cue, `buzz(25)`).
- [ ] Fallback: channel error → chips stay unlabeled (never block). Commit `feat: labeled reward chips + lucky jackpot reveal`.

### Task 15: Streak keeper + flame press

**Files:** Modify: `public/farm/live.js`, `style.css`

- [ ] Once per day (localStorage `pm_streak_nudge=<wibDate>`), hour 07–20 WIB, streak>0 and no device event today (reuse refresh data): chip `PM_STRINGS.streakKeeper.active(days)`. Streak reset detected (prev>new, new===0/1): `streakKeeper.broken` warm chip. No countdowns.
- [ ] Flame tap → chip `` `${d} days in a row! Care today makes ${d+1}.` `` + `blip`. Flame emoji upgrades at milestones: 🔥(1+) → 🔥🔥(7+) → 🔥🔥🔥(14+) → 💛🔥(30+) (text-level, no sprite work).
- [ ] Commit `feat: honest streak keeper + flame press`.

### Task 16: Silhouette Collection island

**Files:** Modify: `src/components/collection-tabs.tsx` · Test: extend `tests/` only if pure helpers added

- [ ] Locked badges: replace `opacity-40 grayscale` with true dark silhouette (`brightness-0 opacity-30`) + honest hint line (existing descriptions). Near-complete: when `unlocked === total-1` in any tab render pulsing `1 more to go!` pill; counters become progress bars (`<div className="h-2 bg-[#BCD3B4]"><div style={{width:pct}} className="bg-[#5FAE45]"/></div>`).
- [ ] Realtime flip: client `useEffect` subscribing `plant_badges` INSERT (browser client already exists in repo — `src/lib/supabase/client.ts` pattern used by live pages); on insert, badge card flips (CSS `rotateY`, 4s total budget) + `PMSfx.play("coin")`.
- [ ] Disclose lucky odds: small line under badges tab: `PM_STRINGS.luckyOdds` (hardcode same English text; React can't read farm strings.js at build — duplicate knowingly with a comment pointing at strings.js).
- [ ] `next build` + lint green; commit `feat: collection comes alive`.

### Task 17: Chapter Gate (T5 peak)

**Files:** Modify: `public/farm/live.js`, `style.css`

- [ ] Detect chapter unlock via Task-14 reason prefix `chapter:`. Enqueue T5: full-screen pixel vignette (dark overlay, chapter title in Press Start 2P, 2–3 dialogue lines from the story defs already exposed via `/api` — if no endpoint, hardcode title-only card: `"Chapter ${n} unlocked!"` + first line), `chapter` cue, tap-through with 4s auto-advance, gold confetti finale. Max 8s total.
- [ ] Commit `feat: chapter gate peak celebration`.

### Task 18: /reports weekly recap island

**Files:** Create: `src/components/reports-recap.tsx` · Modify: `src/app/reports/page.tsx`

- [ ] Client component receiving `{xpWeek, questsWeek, bestDay, streak}` (page already computes tiles — pass same numbers). `useEffect` rAF count-up (reuse the 800ms ease-out cubic pattern from live.js `animateXpCount`, reimplemented in React ~15 lines), streak arc as simple progress bar, "Best care day: Tuesday 🌟". Reduced-motion: static numbers.
- [ ] `next build` green; commit `feat: reports weekly recap with count-ups`.

### Task 19: Pressable vital rows

**Files:** Modify: `public/farm/live.js` (`#env-strip` spans clickable), `src/app/monitoring/page.tsx` gauges optional-skip

- [ ] Tap an env span → speech bubble shows a threshold-true comment (reuse the same boundaries as mood engine: temp>32 "Phew, vent please!", 18–28 "Perfect temperature!", hum<40 "Air feels dry", light 0 "Pretty dark here", ph in 6.0–7.0 "Soil feels great") + `blip`. Copy in strings.js `vitals` map. Never contradicts current mood (comments derive from same reading values).
- [ ] Commit `feat: tappable environment strip with Jamkachu commentary`.

### Task 20: Sunrise welcome

**Files:** Modify: `public/farm/live.js`, `style.css`

- [ ] Once per WIB day (localStorage `pm_sunrise=<date>`): on load, 3s sun-rise translate + sky lighten + birds-free (no reward iconography, no sound except soft `blip` end). Reduced-motion: skip entirely. FIRST sacrificial item.
- [ ] Commit `feat: one-time sunrise welcome`.

### Task 21: Demo script + QA overlay

**Files:** Create: `public/farm/demo.js` · Modify: `index.html` (conditional load)

- [ ] live.js loads it only when `new URLSearchParams(location.search).has("demo")`: keys 1=lucky stamp, 2=level-up, 3=chapter gate, 4=pod drop, 0=self-test overlay (fires each FX sequentially, lists PASS/FAIL per cue + audio unlock state). PRESENTATION ONLY — no Supabase writes; add banner tag `PM_STRINGS.demoTag` while active.
- [ ] Commit `feat: presenter demo hotkeys + QA self-test`.

### Task 22: Integration QA + docs

**Files:** Modify: `README.md`, `docs/PLAN-gameplay-usability.md` (check off Workstream 10)

- [ ] Full pass: `npx vitest run` (all green), `npx eslint src tests`, `next build`, `node --check` on all four farm JS files.
- [ ] Manual matrix: sound unlock+mute persistence across pages; pod ignored 8s; stacked quest+lucky+level-up plays sequentially ≤6s backlog; offline reload (Supabase unset) → zero errors, DEMO tag; reduced-motion pass; ?demo=1 hotkeys; contrast on bright screen.
- [ ] Update README (features + demo instructions + milestone8 migration step) — English. Commit `docs: reflect dopamine layer + UX reframe`, push.

## Self-Review Notes

- Spec §2.1–2.6 → Tasks 1–3, 10; §3 infra → 4–6; server → 7; taps → 8, 9, 15, 19; loop → 11–14; peaks → 17, 18, 20, 21; §5 tests → 4, 7, 22. HP relocation covered in Task 2. Coverage complete.
- Deliberate scope cuts honored: sacrificial order = Task 20 → 19 → 17-simplify.
- Type consistency: `fxEnqueue(tier, fn, ms)` used by Tasks 6, 9, 12, 13, 14, 17; `PMSfx.play/buzz` by 5, 8, 9, 12–17, 19; `PM_STRINGS` keys defined once in Task 4.
