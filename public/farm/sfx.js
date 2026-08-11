// PlantMoji 8-bit SFX engine + speaker toggle + haptics (dopamine plan, Task 5).
//
// Plain synchronous script — NOT a module — loaded with a bare
// <script src="/farm/sfx.js"> tag by the farm page and the React layout.
// Exposes:
//
//   window.PMSfx = {
//     play(cue, opts) — fire one of the synthesized cues below (silent no-op
//                   when muted, rate-limited, or audio is still locked).
//                   opts (optional, celebration bundle item 1):
//                     noLimit  — bypass the 1.5s per-cue rate limit for THIS
//                                call only (the call neither checks nor
//                                refreshes the cue's limit window)
//                     semitone — transpose the cue's TONAL notes by
//                                2^(n/12) (noise recipes are unaffected)
//     muted()     — current mute preference (read fresh from localStorage)
//     toggle()    — flip the preference, update the #sound-toggle button,
//                   sync same-page listeners; returns the NEW muted state
//     buzz(ms)    — navigator.vibrate?.(ms); no-op when muted
//     evoRiser(loops=6) — evolution ceremony's accelerating suspense riser
//                   (transformation FX plan, Task 1). NOT routed through
//                   play(): it returns { totalMs, stop() } so the visual
//                   sequencer can sync its silhouette strobe to the audio
//                   and fast-forward both together on a tap. Same
//                   mute/blocked/unlock guardrails as play(); silent no-op
//                   returns { totalMs: 0, stop(){} }.
//     evoFanfare() — evolution ceremony's payoff sting: dotted major run
//                   resolving to a sustained detuned triad (~2.0s incl.
//                   tail). Dedicated method, not rate-limited — the
//                   sequencer fires it once per ceremony.
//     evoImpact(opts) — reveal hit: a low impact plus bright major chord.
//                   `opts.grand` adds a longer, denser cadence for reaching
//                   the final stage. Dedicated methods are not rate-limited.
//     evoFinalForm() — shorthand for evoImpact({ grand: true }).
//     cry()       — the companion's own reveal voice (~0.4s noise chirp +
//                   triangle glide). Dedicated method, not rate-limited.
//   }
//
// Cues: blip, tick, error, coin, cascade, pod, bonus, fanfare, levelup,
// chapter, pet, splash, whoosh, boing, knock, purr, lullaby, hum, breeze,
// emberCrackle, reliefCool, reliefMist, reliefLight, reliefSoil, stamp,
// evoChirp, evoRiser,
// evoFanfare, evoImpact, evoFinalForm, cry — all WebAudio-synthesized square/triangle oscillators (or
// a white-noise buffer through a filter). Zero external assets, zero
// network (spec D1). The last three evolution-ceremony cues are also
// exposed as dedicated PMSfx methods above — see the object literal doc.
//
// Sound is default ON (spec D1). The preference lives at
// localStorage["pm_sound"] ("off" = muted; "on" or missing = enabled — an
// explicit user choice is always respected) and syncs across tabs/pages via
// storage events. The AudioContext is created + resumed on the FIRST
// pointerdown (capture phase, once); if the browser keeps it suspended
// across several real gestures WITHOUT ever having run, the speaker toggle
// renders crossed-out and the engine stays silent. A context that DID run
// and was later suspended (tab backgrounded, iOS audio interruption) is a
// transient state, never a permanent block: play() fires a resume() and
// re-arms the gesture unlock, and a visibilitychange listener resumes on
// return to the tab.
//
// Guardrails (spec §4): mute short-circuits BEFORE any audio node is
// created; every cue is rate-limited to once per 1.5s (callers may bypass
// it per-call via {noLimit} for deliberately dense textures like the orb
// cascade's landings); this engine is pure presentation — it never grants,
// implies, or counts anything.

(() => {
  "use strict";
  if (window.PMSfx) return; // double-load guard (farm page + React layout)

  const STORAGE_KEY = "pm_sound";
  const RATE_LIMIT_MS = 1500; // per-cue: repeats inside this window are skipped
  const MAX_UNLOCK_ATTEMPTS = 3;

  // ── Mute preference (localStorage, cross-page) ─────────────────────────
  // Read fresh on every call so a flip from another tab/page is honored
  // immediately even if its storage event was missed.

  function readMuted() {
    try {
      // Only an explicit "off" mutes (spec D1: sound defaults ON). A saved
      // "on"/"off" choice is always respected; a missing key means the user
      // never chose, so the D1 default applies.
      return localStorage.getItem(STORAGE_KEY) === "off";
    } catch {
      return false; // storage unavailable → default ON, nothing persists
    }
  }

  function writeMuted(muted) {
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
    } catch {
      /* private mode etc. — the preference just won't persist */
    }
  }

  // ── Lazy AudioContext + gesture unlock ─────────────────────────────────

  let ctx = null;
  let blocked = false; // autoplay policy refused every real gesture, pre-first-run
  let unlockAttempts = 0;
  let unlockArmed = false; // a {once:true} pointerdown unlock listener is pending
  let everUnlocked = false; // the context reached "running" at least once

  function ensureContext() {
    if (ctx || blocked) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      blocked = true;
      updateButton();
      return null;
    }
    try {
      ctx = new AC();
    } catch {
      blocked = true;
      updateButton();
    }
    return ctx;
  }

  /** The context is (or just became) running — clear every failure latch so
   *  a later transient suspension can never permanently silence the engine. */
  function markRunning() {
    everUnlocked = true;
    unlockAttempts = 0;
    blocked = false;
    updateButton();
  }

  /** Fire-and-forget resume(); on success clear the failure latches.
   *  Rejections are swallowed — the re-armed gesture unlock, the next
   *  play(), or the visibilitychange listener simply tries again. */
  function tryResume(c) {
    try {
      c.resume().then(() => {
        if (c.state === "running") markRunning();
      }, () => {});
    } catch {
      /* resume unavailable — a later attempt retries */
    }
  }

  function attemptUnlock() {
    unlockArmed = false; // the {once:true} listener just consumed itself
    const c = ensureContext();
    if (!c) return;
    unlockAttempts += 1;
    const settle = () => {
      if (c.state === "running") {
        markRunning();
      } else if (!everUnlocked && unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
        // The autoplay policy refused even inside real user gestures AND no
        // unlock has EVER succeeded → cross out the speaker and stay silent
        // (Task 5). Once any unlock has succeeded this branch is
        // unreachable: a post-unlock suspension re-arms below instead, so a
        // transient interruption never shows the crossed-out speaker.
        blocked = true;
        updateButton();
      } else {
        listenForUnlock(); // try again on the next gesture
      }
    };
    if (c.state === "running") {
      settle();
    } else {
      try {
        c.resume().then(settle, settle);
      } catch {
        settle();
      }
    }
  }

  function listenForUnlock() {
    if (unlockArmed) return; // one pending unlock listener is enough
    unlockArmed = true;
    document.addEventListener("pointerdown", attemptUnlock, {
      capture: true,
      once: true,
      passive: true,
    });
  }
  listenForUnlock();

  // Post-unlock resilience: coming back to the tab re-resumes a context the
  // browser suspended in the background (tab switch, iOS interruption), so
  // celebration audio survives the presenter checking notes mid-demo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (ctx && ctx.state !== "running" && !blocked) tryResume(ctx);
  });

  // ── Synthesis helpers ──────────────────────────────────────────────────
  // Every cue is a handful of short square/triangle notes (or filtered
  // white noise) with a fast attack + exponential-decay gain envelope —
  // the classic 8-bit shape. Volumes stay low; squares are loud.

  const N = {
    G4: 392.0,
    C5: 523.25,
    E5: 659.25,
    G5: 783.99,
    A5: 880.0,
    B5: 987.77,
    C6: 1046.5,
    E6: 1318.51,
    G6: 1567.98,
  };

  // Per-call transpose set by play({semitone}) around the recipe call and
  // always reset to 1 (celebration bundle item 1). Applied to TONAL notes
  // only — noise filter sweeps keep their character untransposed.
  let pitchTranspose = 1;

  function tone(c, opts) {
    const t0 = c.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.05;
    const osc = c.createOscillator();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(opts.freq * pitchTranspose, t0);
    // Chiptune hard pitch step at the halfway point (e.g. the coin cue).
    if (opts.stepTo) osc.frequency.setValueAtTime(opts.stepTo * pitchTranspose, t0 + dur / 2);
    // Smooth glide across the note (e.g. the pet boing).
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo * pitchTranspose, t0 + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(opts.vol ?? 0.055, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  let noiseBuf = null; // one shared short buffer, built lazily
  function noiseBuffer(c) {
    if (!noiseBuf) {
      const len = Math.floor(c.sampleRate * 0.25);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function noise(c, opts) {
    const t0 = c.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.12;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = opts.filter || "lowpass";
    filter.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.glideTo) filter.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
    if (opts.q) filter.Q.value = opts.q;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(opts.vol ?? 0.1, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(opts.dest || c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  function arpeggio(c, notes, stepSec, opts) {
    const durs = (opts && opts.durs) || null;
    notes.forEach((freq, i) => {
      tone(c, {
        freq,
        at: i * stepSec,
        dur: (durs && durs[i]) || stepSec * 0.9,
        type: (opts && opts.type) || "square",
        vol: opts && opts.vol,
      });
    });
  }

  // ── Evolution ceremony recipes (transformation FX plan, Task 1) ────────
  // riserRecipe/fanfareRecipe/cryRecipe are shared by a thin CUES entry
  // (so `play("evoRiser")` etc. work for console/QA probing, same as every
  // other cue) AND by dedicated PMSfx.evoRiser/evoFanfare/cry methods below
  // that bypass play()'s rate limiter — the ceremony sequencer fires each
  // at most once and evoRiser needs the {totalMs, stop()} handle play()
  // cannot return.

  // Accelerating root-fifth-octave arpeggio: interval x0.85 per loop, +2
  // semitones per loop (research: pokecrystal evolution_animation.asm
  // cadence, adapted to WebAudio). Returns the total scheduled ms so the
  // visual strobe can sync to it, and stop() to cut every note short on
  // fast-forward. Ramps always bottom out at 0.0001, never 0 —
  // exponentialRampToValueAtTime(0, …) throws (MDN).
  function riserRecipe(c, dest, loops) {
    let t = c.currentTime;
    let interval = 0.22;
    let transpose = 0;
    const pattern = [0, 7, 12];
    const startFreq = 261.6;
    let stopped = false;
    const nodes = [];
    for (let loop = 0; loop < loops; loop += 1) {
      for (const semi of pattern) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(startFreq * Math.pow(2, (semi + transpose) / 12), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + interval * 0.9);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + interval);
        nodes.push(osc);
        t += interval;
      }
      interval = Math.max(0.06, interval * 0.85);
      transpose += 2;
    }
    return {
      totalMs: (t - c.currentTime) * 1000,
      stop() {
        if (stopped) return;
        stopped = true;
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            /* already stopped/ended — ignore */
          }
        }
      },
    };
  }

  // Evolution payoff fanfare: dotted major run resolving into a sustained
  // detuned triad with a long release tail (research: "silence beat before
  // the reveal sting" + Gen2 evolution fanfare shape). ~2.0s including the
  // sustain — deliberately bigger than the level-up `fanfare` cue so the
  // rare event keeps its extra gravity.
  function fanfareRecipe(c, dest) {
    const t0 = c.currentTime;
    const run = [N.C5, N.E5, N.G5, N.C6];
    const durs = [0.09, 0.09, 0.09, 0.14];
    let t = t0;
    for (let i = 0; i < run.length; i += 1) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(run[i], t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durs[i]);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + durs[i] + 0.02);
      t += durs[i];
    }
    // Sustained detuned C-major triad — the "landing" beat under the run.
    const triad = [
      { freq: N.C6, detune: -5 },
      { freq: N.E6, detune: 0 },
      { freq: N.G6, detune: 6 },
    ];
    const sustainDur = 1.55;
    for (const voice of triad) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(voice.freq, t);
      osc.detune.setValueAtTime(voice.detune, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sustainDur);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + sustainDur + 0.05);
    }
  }

  // Companion reveal cry: a soft 60ms noise chirp attack followed by a warm
  // ~300ms triangle glide 880->660Hz (falling, so it reads as a contented
  // chirp, not an alarmed screech). ~0.4s total.
  function cryRecipe(c, dest) {
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1500, t0);
    filter.Q.value = 3;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(0.0001, t0);
    nGain.gain.linearRampToValueAtTime(0.06, t0 + 0.01);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    src.start(t0);
    src.stop(t0 + 0.09);

    const glideStart = t0 + 0.04;
    const glideDur = 0.3;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, glideStart);
    osc.frequency.exponentialRampToValueAtTime(660, glideStart + glideDur);
    g.gain.setValueAtTime(0.0001, glideStart);
    g.gain.linearRampToValueAtTime(0.08, glideStart + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, glideStart + glideDur);
    osc.connect(g).connect(dest);
    osc.start(glideStart);
    osc.stop(glideStart + glideDur + 0.03);
  }

  // Reveal hit for the evolution ceremony. The low sine drop gives the
  // reveal a physical "thunk", while the bright major chord makes the new
  // stage read as a reward rather than an alarm. Grand mode — reaching the
  // final stage — layers a second chord and a short rising sparkle cadence,
  // intentionally denser than the normal reveal but still fully synthesized
  // and asset-free. The recipe is unchanged from when it was called
  // "jackpot"; only the name is, because a payout is not what this is.
  // Returns a handle so an interrupted ceremony can stop its oscillators.
  function impactRecipe(c, dest, grand) {
    const t0 = c.currentTime;
    const nodes = [];
    const low = c.createOscillator();
    const lowGain = c.createGain();
    low.type = "sine";
    low.frequency.setValueAtTime(grand ? 78 : 88, t0);
    low.frequency.exponentialRampToValueAtTime(grand ? 34 : 40, t0 + 0.42);
    lowGain.gain.setValueAtTime(0.0001, t0);
    lowGain.gain.linearRampToValueAtTime(grand ? 0.3 : 0.24, t0 + 0.012);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
    low.connect(lowGain).connect(dest);
    low.start(t0);
    low.stop(t0 + 0.56);
    nodes.push(low);

    // The click is deliberately low-passed so the attack feels like a
    // cabinet hit instead of a harsh digital pop.
    noise(c, {
      at: 0,
      dur: grand ? 0.11 : 0.08,
      filter: "lowpass",
      freq: grand ? 1250 : 1000,
      glideTo: 220,
      vol: grand ? 0.2 : 0.16,
      dest,
    });

    const chord = grand
      ? [
          { freq: N.C5, at: 0.07, dur: 0.72, vol: 0.13 },
          { freq: N.E5, at: 0.07, dur: 0.72, vol: 0.12 },
          { freq: N.G5, at: 0.07, dur: 0.72, vol: 0.12 },
          { freq: N.C6, at: 0.07, dur: 0.82, vol: 0.14 },
          { freq: N.E6, at: 0.36, dur: 0.62, vol: 0.1 },
          { freq: N.G6, at: 0.36, dur: 0.62, vol: 0.1 },
        ]
      : [
          { freq: N.C5, at: 0.08, dur: 0.62, vol: 0.11 },
          { freq: N.E5, at: 0.08, dur: 0.62, vol: 0.1 },
          { freq: N.G5, at: 0.08, dur: 0.62, vol: 0.1 },
          { freq: N.C6, at: 0.08, dur: 0.74, vol: 0.12 },
        ];
    for (const voice of chord) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(voice.freq, t0 + voice.at);
      gain.gain.setValueAtTime(0.0001, t0 + voice.at);
      gain.gain.linearRampToValueAtTime(voice.vol, t0 + voice.at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + voice.at + voice.dur);
      osc.connect(gain).connect(dest);
      osc.start(t0 + voice.at);
      osc.stop(t0 + voice.at + voice.dur + 0.04);
      nodes.push(osc);
    }

    if (grand) {
      // A rising 8-bit sparkle cadence sells the payout without borrowing
      // any external game sound. It is intentionally short enough to leave
      // room for evoFanfare's longer musical tail.
      [N.C6, N.E6, N.G6, N.C6 * 2].forEach((freq, index) => {
        const at = 0.58 + index * 0.075;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, t0 + at);
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.linearRampToValueAtTime(0.07, t0 + at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.1);
        osc.connect(gain).connect(dest);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.12);
        nodes.push(osc);
      });
    }

    const totalMs = (grand ? 0.95 : 0.86) * 1000;
    let stopped = false;
    return {
      totalMs,
      stop() {
        if (stopped) return;
        stopped = true;
        for (const node of nodes) {
          try {
            node.stop();
          } catch {
            /* already stopped/ended — ignore */
          }
        }
      },
    };
  }

  // ── Cue recipes (plan Task 5; durations in seconds) ────────────────────

  const CUES = {
    // Button micro-juice / soft UI tick: 30–50ms single squares.
    blip: (c) => tone(c, { freq: N.A5, dur: 0.045, vol: 0.05 }),
    tick: (c) => tone(c, { freq: N.G6, dur: 0.03, vol: 0.035 }),
    error: (c) => {
      tone(c, { freq: N.E5, stepTo: N.C5, dur: 0.13, type: "square", vol: 0.055 });
      tone(c, { at: 0.14, freq: N.C5, dur: 0.12, type: "square", vol: 0.045 });
    },
    // Classic coin: square 988→1319Hz, two hard steps over 90ms.
    coin: (c) => tone(c, { freq: N.B5, stepTo: N.E6, dur: 0.09 }),
    // 3-note rising arpeggio — the verifying→completed hold (Task 12).
    cascade: (c) => arpeggio(c, [N.C5, N.E5, N.G5], 0.055),
    // Seed-pod pop: fast upward octave step + a tiny noise burst (Task 9).
    pod: (c) => {
      tone(c, { freq: N.G4, stepTo: N.G5, dur: 0.09, vol: 0.06 });
      noise(c, { dur: 0.05, freq: 900, vol: 0.07 });
    },
    // Bonus reveal: 4-note rising arpeggio C5 E5 G5 C6, 60ms each.
    bonus: (c) => arpeggio(c, [N.C5, N.E5, N.G5, N.C6], 0.06),
    // Level-up fanfare: 6 notes across ~500ms, final note held.
    fanfare: (c) =>
      arpeggio(c, [N.C5, N.C5, N.C5, N.E5, N.G5, N.C6], 0.085, {
        durs: [0.07, 0.07, 0.07, 0.08, 0.08, 0.22],
      }),
    levelup: (c) => arpeggio(c, [N.C5, N.E5, N.G5, N.C6], 0.08, { durs: [0.07, 0.07, 0.08, 0.2] }),
    // Chapter theme: 2-bar 8-note motif (~1.2s), triangle lead.
    chapter: (c) =>
      arpeggio(c, [N.C5, N.E5, N.G5, N.C6, N.A5, N.G5, N.E5, N.C6], 0.13, {
        type: "triangle",
        vol: 0.08,
        durs: [0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.3],
      }),
    // Pet boing: triangle gliding 300→500Hz over 80ms.
    pet: (c) => tone(c, { freq: 300, glideTo: 500, dur: 0.08, type: "triangle", vol: 0.09 }),
    // Water splash: white-noise burst through a falling lowpass, 120ms.
    splash: (c) => noise(c, { dur: 0.12, filter: "lowpass", freq: 1400, glideTo: 500, vol: 0.11 }),
    // Whoosh: noise through a rising bandpass sweep.
    whoosh: (c) =>
      noise(c, { dur: 0.25, filter: "bandpass", freq: 400, glideTo: 2400, q: 1.2, vol: 0.1 }),
    // Surprise-hop boing: bigger triangle glide 300→650Hz (tactile item 2).
    boing: (c) => tone(c, { freq: 300, glideTo: 650, dur: 0.16, type: "triangle", vol: 0.09 }),
    // Pot knock: two woodblock thumps — tight bandpassed noise taps (item 3).
    knock: (c) => {
      noise(c, { dur: 0.055, filter: "bandpass", freq: 750, q: 8, vol: 0.16 });
      noise(c, { at: 0.13, dur: 0.055, filter: "bandpass", freq: 640, q: 8, vol: 0.13 });
    },
    // Lean-in purr (on release): low triangle with a 6Hz gain wobble, ~400ms
    // (item 5). The LFO output SUMS into the envelope's gain AudioParam.
    purr: (c) => {
      const t0 = c.currentTime;
      const dur = 0.4;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, t0);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.06, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(6, t0);
      const lfoGain = c.createGain();
      lfoGain.gain.setValueAtTime(0.025, t0);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.03);
    },
    // Night lullaby: two very quiet triangle notes G4→E5, ≈half the pet
    // volume (item 6) — soft enough to keep the sleep fiction intact.
    lullaby: (c) => {
      tone(c, { freq: N.G4, dur: 0.22, type: "triangle", vol: 0.045 });
      tone(c, { freq: N.E5, at: 0.3, dur: 0.32, type: "triangle", vol: 0.04 });
    },
    // Idle hum (living world, item 4): a very soft two-note triangle motif —
    // Jamkachu humming to itself, quieter than the lullaby's second note.
    hum: (c) => {
      tone(c, { freq: N.C5, dur: 0.16, type: "triangle", vol: 0.035 });
      tone(c, { freq: N.E5, at: 0.2, dur: 0.24, type: "triangle", vol: 0.03 });
    },
    // Ambient wind gust (living world, item 6): the whoosh recipe at low
    // volume, under its own cue name so the gentle gust never consumes the
    // celebration whoosh's 1.5s rate-limit slot (nor vice versa).
    breeze: (c) =>
      noise(c, { dur: 0.5, filter: "bandpass", freq: 300, glideTo: 1600, q: 1.1, vol: 0.045 }),
    // Streak flame tier-up ignition (celebration bundle item 7): three tiny
    // filtered-noise crackle ticks, like an ember settling.
    emberCrackle: (c) => {
      noise(c, { dur: 0.035, filter: "bandpass", freq: 2100, q: 7, vol: 0.09 });
      noise(c, { at: 0.09, dur: 0.03, filter: "bandpass", freq: 1600, q: 7, vol: 0.07 });
      noise(c, { at: 0.18, dur: 0.04, filter: "bandpass", freq: 2500, q: 7, vol: 0.08 });
    },
    // Mood-flavored care-button relief textures (bundle item 9) — each
    // 100–150ms, audio-only flavor on the same zero-XP press.
    // Overheating: a cool falling hiss.
    reliefCool: (c) =>
      noise(c, { dur: 0.13, filter: "lowpass", freq: 2400, glideTo: 400, vol: 0.07 }),
    // DryAir: two soft mist puffs.
    reliefMist: (c) => {
      noise(c, { dur: 0.05, filter: "lowpass", freq: 2600, vol: 0.05 });
      noise(c, { at: 0.07, dur: 0.06, filter: "lowpass", freq: 2200, vol: 0.045 });
    },
    // Sleepy: bright rising sunlight — triangle gliding up an octave.
    reliefLight: (c) =>
      tone(c, { freq: 660, glideTo: 1320, dur: 0.14, type: "triangle", vol: 0.07 }),
    // Soil (both pH moods): a small square wobble, down then back up.
    reliefSoil: (c) => {
      tone(c, { freq: 235, stepTo: 205, dur: 0.07, vol: 0.06 });
      tone(c, { at: 0.07, freq: 205, stepTo: 235, dur: 0.07, vol: 0.055 });
    },
    // Heavier sibling of `tick` (bundle item 10): low square thunk with a
    // 30ms noise click. Registered for the React-side PMSfx callers — NOT
    // wired anywhere on the farm page.
    stamp: (c) => {
      tone(c, { freq: 240, stepTo: 190, dur: 0.12, vol: 0.09 });
      noise(c, { dur: 0.03, filter: "lowpass", freq: 1000, vol: 0.12 });
    },
    // Evolution ceremony cues (transformation FX plan, Task 1). evoChirp is
    // the level-up sting, played the normal way via play("evoChirp"): a
    // 3-note rising run, punchier/slower than `cascade` (110ms/note vs
    // 55ms) so it reads as a small triumphant beat, not a UI blip.
    evoChirp: (c) => arpeggio(c, [N.C5, N.E5, N.G5], 0.11, { durs: [0.1, 0.1, 0.15] }),
    // evoRiser/evoFanfare/cry recipes live above (shared with the dedicated
    // PMSfx.evoRiser/evoFanfare/cry methods); registered here too so
    // play("evoRiser") / play("evoFanfare") / play("cry") also work for
    // console probing and the QA overlay, same as every other cue.
    evoRiser: (c) => riserRecipe(c, c.destination, 6),
    evoFanfare: (c) => fanfareRecipe(c, c.destination),
    evoImpact: (c) => impactRecipe(c, c.destination, false),
    evoFinalForm: (c) => impactRecipe(c, c.destination, true),
    cry: (c) => cryRecipe(c, c.destination),
  };

  const lastPlayedAt = Object.create(null);

  function play(cue, opts) {
    if (readMuted()) return; // mute short-circuits before ANY node creation
    if (blocked) return; // audio policy said no — stay silent
    const recipe = CUES[cue];
    if (!recipe) return; // unknown cue → silent no-op, never a throw
    const c = ctx;
    if (!c) return; // no context yet — the gesture unlock is still pending
    if (c.state !== "running") {
      // Transient suspension (tab backgrounded, iOS interruption after a
      // successful unlock). Kick off a resume for the NEXT cue, re-arm the
      // gesture unlock as a fallback, and drop THIS cue — resume() is
      // async, so synthesizing now would only play stale audio later.
      tryResume(c);
      listenForUnlock();
      return;
    }
    const o = opts && typeof opts === "object" ? opts : null;
    // noLimit is scoped to THIS call: it neither checks nor refreshes the
    // cue's rate-limit window, so surrounding plain calls behave exactly as
    // if the noLimit call never happened.
    if (!(o && o.noLimit === true)) {
      const now = Date.now();
      if (now - (lastPlayedAt[cue] || 0) < RATE_LIMIT_MS) return; // 1.5s/cue
      lastPlayedAt[cue] = now;
    }
    const semitone = o ? Number(o.semitone) : NaN;
    pitchTranspose = Number.isFinite(semitone) ? Math.pow(2, semitone / 12) : 1;
    try {
      recipe(c);
    } catch {
      /* a synthesis failure must never break the page */
    } finally {
      pitchTranspose = 1; // never leak a transpose into the next cue
    }
  }

  /** Shared pre-flight for the evolution-ceremony methods that bypass
   *  play()'s dispatcher (evoRiser/evoFanfare/cry) — the exact same
   *  guardrails play() applies before touching the audio graph: mute
   *  short-circuits before any node exists, a blocked/not-yet-unlocked
   *  context stays silent, and a context the browser suspended (tab
   *  backgrounded) gets the same resume-and-re-arm treatment play() gives
   *  it. Returns the running AudioContext, or null when the caller must
   *  stay silent this call. */
  function readyContext() {
    if (readMuted()) return null; // mute short-circuits before ANY node creation
    if (blocked) return null; // audio policy said no — stay silent
    const c = ctx;
    if (!c) return null; // no context yet — the gesture unlock is still pending
    if (c.state !== "running") {
      tryResume(c);
      listenForUnlock();
      return null;
    }
    return c;
  }

  // Evolution ceremony methods (transformation FX plan, Task 1): the
  // live.js sequencer fires each of these at most once per ceremony, so —
  // unlike play() — none of these apply the 1.5s per-cue rate limit.
  // evoRiser's returned handle is exactly what the sequencer syncs its
  // silhouette strobe to and calls to fast-forward.

  function evoRiser(loops) {
    const n = Number.isFinite(loops) && loops > 0 ? Math.floor(loops) : 6;
    const c = readyContext();
    if (!c) return { totalMs: 0, stop() {} };
    try {
      return riserRecipe(c, c.destination, n);
    } catch {
      return { totalMs: 0, stop() {} }; // a synthesis failure must never break the page
    }
  }

  function evoFanfare() {
    const c = readyContext();
    if (!c) return;
    try {
      fanfareRecipe(c, c.destination);
    } catch {
      /* a synthesis failure must never break the page */
    }
  }

  function evoImpact(options) {
    const grand = options === true || Boolean(options && options.grand === true);
    const c = readyContext();
    if (!c) return { totalMs: 0, stop() {} };
    try {
      return impactRecipe(c, c.destination, grand);
    } catch {
      return { totalMs: 0, stop() {} }; // a synthesis failure must never break the page
    }
  }

  function evoFinalForm() {
    return evoImpact({ grand: true });
  }

  function cry() {
    const c = readyContext();
    if (!c) return;
    try {
      cryRecipe(c, c.destination);
    } catch {
      /* a synthesis failure must never break the page */
    }
  }

  function buzz(ms) {
    if (readMuted()) return; // haptics follow the mute preference
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* unsupported / blocked → no-op */
    }
  }

  // ── Speaker toggle button (#sound-toggle) ──────────────────────────────
  // Injected by this script so every page that loads sfx.js — the static
  // farm page AND the React pages — gets the same fixed top-right pixel
  // toggle without touching their markup. Styles are inline on purpose:
  // React pages never load the farm style.css.

  function updateButton() {
    const btn = document.getElementById("sound-toggle");
    if (!btn) return;
    const m = readMuted();
    btn.textContent = blocked || m ? "🔇" : "🔊";
    btn.setAttribute("aria-pressed", String(!m && !blocked));
    btn.setAttribute(
      "aria-label",
      blocked ? "Sound unavailable in this browser" : m ? "Turn sound on" : "Turn sound off",
    );
    btn.title = blocked ? "Sound blocked by the browser" : m ? "Sound: off" : "Sound: on";
    btn.style.opacity = blocked ? "0.55" : "1";
  }

  function injectButton() {
    if (!document.body || document.getElementById("sound-toggle")) return;
    const btn = document.createElement("button");
    btn.id = "sound-toggle";
    btn.type = "button";
    const s = btn.style;
    s.position = "fixed";
    s.top = "12px";
    s.right = "12px";
    s.zIndex = "9999";
    s.width = "44px"; // comfortable tap target
    s.height = "44px";
    s.padding = "0";
    s.display = "flex";
    s.alignItems = "center";
    s.justifyContent = "center";
    s.fontFamily = "'Press Start 2P', monospace"; // pixel glyph if loaded
    s.fontSize = "18px";
    s.lineHeight = "1";
    s.background = "#FFFFFF"; // surface token (spec §2.5)
    s.border = "3px solid #BCD3B4"; // border token
    s.borderRadius = "6px";
    s.boxShadow = "0 4px 0 rgba(36,52,33,.15)"; // pixel shadow
    s.color = "#243421"; // dark-text token
    s.cursor = "pointer";
    btn.addEventListener("click", () => {
      toggle();
    });
    document.body.appendChild(btn);
    updateButton();
  }

  function toggle() {
    const nowMuted = !readMuted();
    writeMuted(nowMuted);
    updateButton();
    // Real "storage" events only fire in OTHER tabs — dispatch a synthetic
    // one so same-page listeners (live.js, demo.js) stay in sync too.
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: nowMuted ? "off" : "on",
          storageArea: window.localStorage,
        }),
      );
    } catch {
      /* StorageEvent constructor unavailable → same-page sync skipped */
    }
    if (!nowMuted) play("blip"); // audible confirmation when unmuting
    return nowMuted; // the NEW muted state (true = now silent)
  }

  // Cross-tab/page sync: another tab flipping the preference updates this
  // page's toggle immediately (key === null means storage.clear()).
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    updateButton();
  });

  if (document.body) injectButton();
  else document.addEventListener("DOMContentLoaded", injectButton, { once: true });

  window.PMSfx = {
    play,
    muted: readMuted,
    toggle,
    buzz,
    evoRiser,
    evoFanfare,
    evoImpact,
    evoFinalForm,
    cry,
  };
})();
