// PlantMoji 8-bit SFX engine + speaker toggle + haptics (dopamine plan, Task 5).
//
// Plain synchronous script — NOT a module — loaded with a bare
// <script src="/farm/sfx.js"> tag by the farm page and the React layout.
// Exposes:
//
//   window.PMSfx = {
//     play(cue)   — fire one of the synthesized cues below (silent no-op
//                   when muted, rate-limited, or audio is still locked)
//     muted()     — current mute preference (read fresh from localStorage)
//     toggle()    — flip the preference, update the #sound-toggle button,
//                   sync same-page listeners; returns the NEW muted state
//     buzz(ms)    — navigator.vibrate?.(ms); no-op when muted
//   }
//
// Cues: blip, coin, cascade, pod, jackpot, fanfare, chapter, pet, splash,
// whoosh, tick — all WebAudio-synthesized square/triangle oscillators (or a
// white-noise buffer through a filter). Zero external assets, zero network
// (spec D1).
//
// Sound is default ON. The preference lives at localStorage["pm_sound"]
// ("off" = muted, anything else = on) and syncs across tabs/pages via
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
// created; every cue is rate-limited to once per 1.5s; this engine is pure
// presentation — it never grants, implies, or counts anything.

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

  function tone(c, opts) {
    const t0 = c.currentTime + (opts.at || 0);
    const dur = opts.dur || 0.05;
    const osc = c.createOscillator();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(opts.freq, t0);
    // Chiptune hard pitch step at the halfway point (e.g. the coin cue).
    if (opts.stepTo) osc.frequency.setValueAtTime(opts.stepTo, t0 + dur / 2);
    // Smooth glide across the note (e.g. the pet boing).
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
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
    gain.connect(c.destination);
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

  // ── Cue recipes (plan Task 5; durations in seconds) ────────────────────

  const CUES = {
    // Button micro-juice / soft UI tick: 30–50ms single squares.
    blip: (c) => tone(c, { freq: N.A5, dur: 0.045, vol: 0.05 }),
    tick: (c) => tone(c, { freq: N.G6, dur: 0.03, vol: 0.035 }),
    // Classic coin: square 988→1319Hz, two hard steps over 90ms.
    coin: (c) => tone(c, { freq: N.B5, stepTo: N.E6, dur: 0.09 }),
    // 3-note rising arpeggio — the verifying→completed hold (Task 12).
    cascade: (c) => arpeggio(c, [N.C5, N.E5, N.G5], 0.055),
    // Seed-pod pop: fast upward octave step + a tiny noise burst (Task 9).
    pod: (c) => {
      tone(c, { freq: N.G4, stepTo: N.G5, dur: 0.09, vol: 0.06 });
      noise(c, { dur: 0.05, freq: 900, vol: 0.07 });
    },
    // Lucky jackpot: 4-note rising arpeggio C5 E5 G5 C6, 60ms each.
    jackpot: (c) => arpeggio(c, [N.C5, N.E5, N.G5, N.C6], 0.06),
    // Level-up fanfare: 6 notes across ~500ms, final note held.
    fanfare: (c) =>
      arpeggio(c, [N.C5, N.C5, N.C5, N.E5, N.G5, N.C6], 0.085, {
        durs: [0.07, 0.07, 0.07, 0.08, 0.08, 0.22],
      }),
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
  };

  const lastPlayedAt = Object.create(null);

  function play(cue) {
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
    const now = Date.now();
    if (now - (lastPlayedAt[cue] || 0) < RATE_LIMIT_MS) return; // 1.5s/cue
    lastPlayedAt[cue] = now;
    try {
      recipe(c);
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

  window.PMSfx = { play, muted: readMuted, toggle, buzz };
})();
