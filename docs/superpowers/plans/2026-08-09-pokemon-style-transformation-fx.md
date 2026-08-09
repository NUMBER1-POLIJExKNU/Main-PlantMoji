# Pokémon-Style Transformation FX (Level-Up + Evolution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage Bond Level-ups and companion evolutions like a Pokémon evolution sequence — dialog beat, accelerating silhouette strobe between old and new form, white flash, star burst, reveal with cry + fanfare — tuned to PlantMoji's pixel-farm world, WCAG flash-safety, and cheap Android phones.

**Architecture:** Everything lives in the farm layer (presentation only, no game truth): a phase-driven sequencer in `live.js` (anticipate → suspense → payoff, driven by a precomputed schedule table, not CSS loops), discrete-state CSS classes in `style.css` (silhouette filter, flash overlay, shake — compositor-only properties), WebAudio-synthesized riser/fanfare cues in `sfx.js`, and en/id dialog lines in `strings.js`. Two presets: **evolution = full ~7s sequence (T5)**, **level-up = ~2.2s hitstop-and-swap (T4)** — the frequent event must never borrow the rare event's gravity.

**Tech Stack:** vanilla ES modules, CSS keyframes + Web Animations API, WebAudio (no audio files), existing fxEnqueue celebration queue.

## Research references (all read 2026-08-09; details in the workflow research notes)

- Original sequence anatomy + exact frame tables: `pret/pokered engine/movie/evolution.asm`, `pret/pokecrystal engine/movie/evolution_animation.asm` — Gen2 cadence: inter-burst waits `[14,12,10,8,6,4,2]` frames (×16.7ms), burst length `i+1` alternations, self-terminating; 80-frame dialog beat; particles 2-per-2-frames × 16 steps + 32-frame tail; hard cuts, never fades.
- Web techniques: CSS silhouette via `filter: brightness(0) invert(1)` (raster-safe for inline SVG incl. strokes; avoid animating filters per-frame — toggle as discrete state); WAAPI particle bursts with `onfinish` cleanup (css-tricks.com/playing-with-particles-using-the-web-animations-api); `will-change` armed just-in-time and cleared after (web.dev/articles/animations-and-performance).
- **Flash safety (hard constraint):** WCAG 2.3.1 — ≤3 large-area high-contrast flashes per rolling second (w3.org/TR/UNDERSTANDING-WCAG20/seizure-does-not-violate.html). The mascot-local strobe sits inside the small-area safe harbor; the **full-screen flash fires exactly once** (80ms) at reveal. `prefers-reduced-motion` gets a 900ms crossfade with no strobe/flash/shake.
- Game feel & audio: three-act structure with a 200-300ms **silence beat** before the reveal sting (wayline.io/blog/power-of-silence-game-audio); hitstop 2-4 frames + shake amplitude by tier; riser = looping root-fifth-octave arpeggio, interval ×0.85 per loop + whole-tone transpose; fanfare = dotted major run resolving to a sustained triad; `exponentialRampToValueAtTime` must never touch 0 (MDN) — ramp to 0.0001.

## Global Constraints

- Farm layer is presentation-only: this plan reads companion/bond state, never writes any. First render never celebrates. Sequence fires only via fxEnqueue (evolution T5, level-up T4).
- No cancel mechanic: unlike Pokémon's B-button, the evolution already happened server-side (sensor truth) — a tap during the sequence **fast-forwards** to the payoff, never reverts.
- Full-screen flash: exactly one ≤100ms pulse per sequence. Mascot strobe: silhouette on the mascot element only. Reduced-motion path: crossfade only.
- Compositor discipline: animate transform/opacity only; silhouette filter is a toggled class, never a tweened value; `will-change` set right before the sequence, cleared right after; particle nodes removed in `onfinish`; respect the existing 120-particle FX budget.
- All player-facing text in strings.js {en, id} (parity vitest). Audio via sfx.js cue table only — never invent a cue name at a call site (the "levelup" cue bug class).
- Kiosk safety: every phase has a hard timeout; auto-dismiss after 6s if the player never taps; sequence must self-heal if interrupted by a re-render (re-assert real state from the next data render, same contract as PMFx.levelUp()).
- Relationship to the evolution-ladder plan (2026-08-09-companion-evolution-ladder.md): **Task 4 here replaces that plan's Task 7 ceremony renderer** (fxEvolveNow); the trigger wiring (renderCompanion rank-increase detection, pm_evo_seen, PMFx.evolve, demo hotkey E) from that plan is kept as-is. This plan works with today's 5 stage classes and automatically gets richer when the 10-stage ladder ships.

---

### Task 1: sfx.js — riser, fanfare, chirp, cry cues

**Files:**
- Modify: `public/farm/sfx.js` (CUES table + two sequence helpers)

**Interfaces:**
- Produces: `PMSfx.play("evoChirp")` (level-up, ~0.35s), `PMSfx.evoRiser(loops)` → returns `{ totalMs, stop() }`, `PMSfx.evoFanfare()` (~2.0s incl. sustain), `PMSfx.cry()` (~0.4s Jamkachu chirp). All respect the existing mute flag and audio-unlock/suspend-resume machinery — read sfx.js's existing cue pattern first and register through the same table.

- [ ] **Step 1: Read sfx.js's cue architecture** (how CUES entries schedule oscillators, how mute/unlock gates play) and add four entries following it exactly.

- [ ] **Step 2: Implement the riser** (structure from the research, adapted to sfx.js's context/gain plumbing):

```js
// Accelerating root-fifth-octave arpeggio: interval ×0.85/loop, +2 semitones/loop.
// Returns total scheduled ms so the visual schedule can sync to it, and stop()
// for fast-forward. All ramps bottom out at 0.0001 — never 0 (WebAudio throws).
function evoRiser(ctx, dest, loops = 6) {
  let t = ctx.currentTime, interval = 0.22, transpose = 0;
  const pattern = [0, 7, 12], startFreq = 261.6;
  let stopped = false;
  const nodes = [];
  for (let loop = 0; loop < loops; loop++) {
    for (const semi of pattern) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(startFreq * Math.pow(2, (semi + transpose) / 12), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + interval * 0.9);
      osc.connect(g).connect(dest);
      osc.start(t); osc.stop(t + interval);
      nodes.push(osc);
      t += interval;
    }
    interval = Math.max(0.06, interval * 0.85);
    transpose += 2;
  }
  return {
    totalMs: (t - ctx.currentTime) * 1000,
    stop() { if (!stopped) { stopped = true; for (const n of nodes) { try { n.stop(); } catch {} } } },
  };
}
```

- [ ] **Step 3: Implement the fanfare** (major run → sustained detuned triad, release tail to 0.0001), the level-up **chirp** (3-note up run C5-E5-G5, 110ms each), and the **cry** (60ms noise burst + 300ms triangle glide 880→660Hz — warm, not screechy).

- [ ] **Step 4: Verify** — `node --check public/farm/sfx.js`; on `/?demo=1` QA overlay's RUN ALL FX still passes; each new cue audible once via console `PMSfx.play("evoChirp")` etc.

- [ ] **Step 5: Commit** — `git commit -m "feat: evolution riser, fanfare, chirp, and cry sfx cues"`

---

### Task 2: strings.js — ceremony dialog (en/id)

**Files:**
- Modify: `public/farm/strings.js` (both locales)

**Interfaces:**
- Produces: `PM().evo.*` used by Tasks 4-5. Note `{name}` is the plant's display name, `{stage}` a localized stage name from the existing `companionStage` table (do not re-declare stage names here).

- [ ] **Step 1: Add to both locale tables** (keep key parity — the vitest enforces it):

```js
// en
evo: {
  noticing: (name) => `What? ${name} is changing…!`,
  evolved: (name, stage) => `Congratulations! ${name} grew into ${stage}!`,
  levelUp: (level) => `Bond Lv.${level}!`,
  tapToContinue: "Tap to continue",
},
// id
evo: {
  noticing: (name) => `Lho? ${name} mulai berubah…!`,
  evolved: (name, stage) => `Selamat! ${name} tumbuh menjadi ${stage}!`,
  levelUp: (level) => `Ikatan Lv.${level}!`,
  tapToContinue: "Ketuk untuk lanjut",
},
```

- [ ] **Step 2: Run the parity test** (`npx vitest run` on the strings parity file) and commit — `git commit -m "feat: evolution ceremony dialog strings (en/id)"`

---

### Task 3: style.css — silhouette, flash, shake, tint, reduced-motion

**Files:**
- Modify: `public/farm/style.css`

**Interfaces:**
- Produces classes Tasks 4-5 toggle: `.evo-sil`, `.evo-flash`, `.evo-tint`, `.evo-shake-sm`, `.evo-shake-lg`, `.evo-pulse`, `.evo-reveal-bounce`, plus the reduced-motion overrides.

- [ ] **Step 1: Add the discrete-state classes** (hard cuts — explicitly kill transitions while active):

```css
/* Solid-white silhouette: raster filter flattens the whole inline SVG incl. strokes.
   Toggled as a discrete state, never tweened (mobile GPU filter traps). */
.mascot-svg.evo-sil { filter: brightness(0) invert(1); transition: none !important; }

/* Full-screen flash: opacity-only, fires ONCE per sequence (WCAG 2.3.1). */
.evo-flash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 1200; }

/* Radial stage-tint backdrop behind the mascot (GB whole-screen-palette trick). */
.evo-tint { position: fixed; inset: 0; pointer-events: none; z-index: 998; opacity: 0;
  background: radial-gradient(circle at 50% 42%, var(--companion-accent, #FFDE6A) 0%, rgba(36,52,33,.92) 70%);
  transition: opacity .4s ease; }
.evo-tint.on { opacity: 1; }

/* Anticipation pulse: scale oscillation on the wrapper (transform-only). */
@keyframes evoPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.evo-pulse { animation: evoPulse .55s ease-in-out infinite; }

/* Reveal: springy overshoot bounce. */
@keyframes evoRevealBounce { 0% { transform: scale(1); } 30% { transform: scale(1.15); }
  55% { transform: scale(.95); } 78% { transform: scale(1.05); } 100% { transform: scale(1); } }
.evo-reveal-bounce { animation: evoRevealBounce .45s cubic-bezier(.34,1.56,.64,1) 1; }

/* Shake, amplitude by tier (level-up small, evolution large). */
@keyframes evoShakeSm { 0%,100% { transform: translate(0,0); } 25% { transform: translate(2px,-2px); }
  50% { transform: translate(-2px,1px); } 75% { transform: translate(1px,2px); } }
@keyframes evoShakeLg { 0%,100% { transform: translate(0,0); } 20% { transform: translate(8px,-6px); }
  45% { transform: translate(-7px,5px); } 70% { transform: translate(5px,6px); } 90% { transform: translate(-3px,-2px); } }
.evo-shake-sm { animation: evoShakeSm .15s ease-out 1; }
.evo-shake-lg { animation: evoShakeLg .18s ease-out 1; }

/* Photosensitivity / vestibular safety: no strobe, no flash, no shake — crossfade only. */
@media (prefers-reduced-motion: reduce) {
  .mascot-svg.evo-sil { filter: none; }
  .evo-flash, .evo-tint { display: none; }
  .evo-pulse, .evo-shake-sm, .evo-shake-lg { animation: none; }
  .mascot-svg.evo-xfade { transition: opacity .9s ease-in-out; opacity: .3; }
}
```

- [ ] **Step 2: Verify nothing regresses at rest** — load `/` and confirm the mascot renders identically with no new classes applied. Commit — `git commit -m "feat: transformation FX css foundation"`

---

### Task 4: live.js — the evolution sequencer (T5, replaces ladder-plan Task 7's simple card)

**Files:**
- Modify: `public/farm/live.js` (new `runEvolutionSequence`, rewrite `fxEvolveNow`; keep `fxEvolve` = `fxEnqueue(5, ...)` and all trigger wiring from the ladder plan)

**Interfaces:**
- Consumes: Task 1 cues, Task 2 strings, Task 3 classes; `companion-<Stage>` classes (5 today, 10 after the ladder plan); the ladder plan's trigger (`renderCompanion` rank increase → `fxEvolve(newStage)`).
- Produces: `fxEvolveNow(oldStage, newStage)` — full sequence; `window.__pmEvoFF()` internal fast-forward hook for taps.

- [ ] **Step 1: Implement the phase sequencer** (schedule table from the pokecrystal disassembly; timings in ms):

```js
// Gen2 cadence: inter-burst waits shrink 14→2 frames while burst length grows 1→7.
// One "alternation" = swap the companion-<Stage> class while .evo-sil hides all
// color — the silhouette SHAPE flips between old and new form. Hard cuts only.
const EVO_WAITS = [14, 12, 10, 8, 6, 4, 2].map((f) => Math.round(f * 16.7));
const EVO_SWAP_MS = 50; // ~3 frames per alternation

async function runEvolutionSequence(oldStage, newStage) {
  const svg = $(".mascot-svg"), wrap = $(".mascot-wrapper");
  if (!svg || !wrap) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ff = false;                                  // fast-forward flag
  const ffTap = () => { ff = true; };
  document.addEventListener("pointerdown", ffTap, { capture: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 4000)));
  const setStage = (s) => {
    for (const c of [...svg.classList]) if (c.startsWith("companion-")) svg.classList.remove(c);
    svg.classList.add(`companion-${s}`);
  };
  try {
    svg.style.willChange = "filter, transform";
    // ── ACT 1: anticipate (~1.8s) — dialog + tint + pulse, non-blocking
    speechBubble(PM().evo?.noticing?.(currentPlantName()) ?? "…!");
    const tint = ensureEvoTint(); tint.classList.add("on");
    if (reduce) {                                   // safe path: crossfade only
      await sleep(900); svg.classList.add("evo-xfade");
      await sleep(450); setStage(newStage);
      await sleep(450); svg.classList.remove("evo-xfade");
    } else {
      wrap.classList.add("evo-pulse");
      const riser = PMSfx.evoRiser?.(6);
      await sleep(1300);
      // ── ACT 2: suspense — accelerating silhouette strobe (mascot-local only)
      svg.classList.add("evo-sil");
      for (let i = 0; i < EVO_WAITS.length && !ff; i++) {
        await sleep(EVO_WAITS[i]);
        for (let k = 0; k <= i && !ff; k++) {
          setStage(k % 2 === 0 ? newStage : oldStage);
          await sleep(EVO_SWAP_MS);
        }
      }
      riser?.stop();
      setStage(newStage);
      wrap.classList.remove("evo-pulse");
      // ── silence beat: everything stops together (eye and ear)
      await sleep(ff ? 0 : 220);
      // ── ACT 3: payoff — ONE flash + hitstop + shake + reveal
      flashOnce(80);                                 // single 80ms full-screen pulse
      wrap.style.animationPlayState = "paused";      // hitstop: freeze breathing
      await sleep(50);
      wrap.style.animationPlayState = "";
      svg.classList.remove("evo-sil");
      wrap.classList.add("evo-shake-lg");
      svg.classList.add("evo-reveal-bounce");
      PMSfx.cry?.(); PMSfx.evoFanfare?.();
      spawnEvoStars(28);                             // Task 4 Step 2
    }
    speechBubble(PM().evo?.evolved?.(currentPlantName(), localizedStage(newStage)) ?? "!");
    await dismissOrTimeout(6000);                    // tap-to-continue, kiosk-safe
    tint.classList.remove("on");
  } finally {
    document.removeEventListener("pointerdown", ffTap, { capture: true });
    svg.style.willChange = "auto";
    wrap.classList.remove("evo-pulse", "evo-shake-lg");
    svg.classList.remove("evo-sil", "evo-reveal-bounce", "evo-xfade");
    // real companion_state re-asserts stage classes on the next data render
  }
}
```

(`speechBubble`, `currentPlantName`, `localizedStage`, `ensureEvoTint`, `flashOnce`, `dismissOrTimeout` — implement as small helpers beside the existing bubble/overlay utilities, reusing whatever live.js already has for bubbles and overlays; `flashOnce` appends one `.evo-flash` div, WAAPI-animates opacity 0→1→0 over the given ms, removes it `onfinish`.)

- [ ] **Step 2: Star burst** — `spawnEvoStars(n)`: n small pixel-star divs from the mascot center, two spawned per ~33ms tick, WAAPI outward translate + fade over 500-1500ms, per-particle `hue-rotate((i*40)%360deg)` for the palette-cycling shimmer, `onfinish` removes the node, and the count clamps against the existing global particle budget.

- [ ] **Step 3: Wire it** — `fxEvolveNow(oldStage, newStage)` calls `runEvolutionSequence`; the enqueue site passes the previously-rendered stage as `oldStage`. Keep tier 5 and a queue duration ≥ the non-reduced sequence total (~7000ms).

- [ ] **Step 4: Verify** — `node --check public/farm/live.js`; on `/?demo=1` press `E` (ladder-plan hotkey): full sequence plays, tap mid-strobe fast-forwards, OS reduced-motion setting gives the crossfade, real state re-asserts on next poll. Commit — `git commit -m "feat: pokemon-style evolution ceremony sequencer"`

---

### Task 5: live.js — level-up re-stage (T4, Tamagotchi cut — deliberately small)

**Files:**
- Modify: `public/farm/live.js` (`fxLevelUpNow`)

**Interfaces:**
- Consumes: Task 1 `evoChirp`, Task 3 `.evo-shake-sm`; keeps the existing card DOM, decoration reveal chaining, and all call sites unchanged.

- [ ] **Step 1: Re-stage the existing `fxLevelUpNow`** to: freeze mascot idle (`animation-play-state: paused`) for 180ms → swap in nothing (no form change — level-up is not evolution) but pop the existing level-up card with `.evo-shake-sm` on the mascot wrapper + `evoChirp` cue → card auto-dismisses exactly as today. Total ≤ 2.2s. **No silhouette, no strobe, no full-screen flash** — the contrast in weight between the two events is the design. Reduced-motion: skip freeze and shake, keep the card.

- [ ] **Step 2: Verify** — demo hotkey `2` still plays cleanly, chains into the decoration reveal, and reads clearly smaller than `E`. `node --check public/farm/live.js`. Commit — `git commit -m "feat: hitstop level-up restaging with chirp"`

---

### Task 6: demo/QA wiring + final QA

**Files:**
- Modify: `public/farm/demo.js` (QA overlay rows), `docs/RUNBOOK-filming-and-golive.md` (§2 hotkey block, three languages)

- [ ] **Step 1: QA overlay** — add typeof checks for `PMSfx.evoRiser/evoFanfare/cry` and a row showing the current `prefers-reduced-motion` state next to them (the filming checklist needs to know which variant the demo device will play).

- [ ] **Step 2: Runbook §2** — in all three language sections, extend the hotkey bullet for `E`: full evolution ceremony ~7s, tap = fast-forward, auto-dismiss 6s; note the single-flash safety design and that reduced-motion devices play a crossfade.

- [ ] **Step 3: Final QA** — `npx vitest run` (strings parity + full suite green), `npm run build`, `node --check` on all touched farm files; on a 360px viewport confirm the tint/flash overlays cover fully and the dialog bubble fits. Commit — `git commit -m "docs: evolution ceremony demo hotkeys and QA coverage"`

---

## Execution order & dependencies

Tasks 1-3 are independent (parallel-safe: sfx.js / strings.js / style.css). Task 4 needs 1+2+3. Task 5 needs 1+3. Task 6 last. The full form-swap strobe works with today's five `companion-<Stage>` classes and gets richer silhouette deltas automatically when the 10-stage ladder plan's Task 6 art lands; if that plan runs later, its Task 7 is superseded by this plan's Task 4 (keep its trigger wiring, drop its simple-card renderer).
