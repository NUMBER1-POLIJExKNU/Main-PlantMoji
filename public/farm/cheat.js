// PlantMoji · Cheat Mode (classroom-demo sandbox) + Trial Mode store.
//
// A CLIENT-ONLY sandbox for live demos: it lets a presenter freely change the
// plant's status, sensor values, quests, shop and collection so a classroom
// sees big changes instantly — WITHOUT touching real hardware or the real
// Supabase data. Every value here lives in localStorage only; nothing in this
// file ever writes to Supabase, the game API, or Node-RED. Deactivating wipes
// the sandbox and the app returns to the untouched normal mode.
//
// The same store carries TWO modes, because they need identical containment
// and identical sensor physics:
//   "cheat" — the presenter sandbox described above. Full manual control.
//   "trial" — the student onboarding game (public/farm/trial.js drives it).
//             Starts empty, pays XP/Seeds for care actions, and opens cheat
//             mode at Lv.5. This file owns the STATE and the physics; every
//             game rule lives in trial.js.
//
// Plain synchronous script (NOT a module) so it can load with a bare
// <script src="/farm/cheat.js"> BEFORE live.js and on every React route via
// the shared layout. It exposes window.PMCheat and, when active, injects a
// persistent "CHEAT MODE" banner. Consumers must read defensively
// (window.PMCheat) so a missing tag never breaks a page.

(function () {
  "use strict";

  var KEY = "plantmoji_cheat_v1";
  var LOCALE_KEY = "plantmoji_locale";
  var CHANGE_EVENT = "pmcheat:change";
  var PRESS_EVENT = "pmcheat:press";

  // ── Locale (mirrors live.js initialLocale / strings.js) ─────────────────
  function detectLocale() {
    try {
      var cookie = document.cookie
        .split(";")
        .map(function (v) { return v.trim(); })
        .find(function (v) { return v.indexOf(LOCALE_KEY + "=") === 0; });
      var fromCookie = cookie ? cookie.split("=")[1] : null;
      var stored = null;
      try { stored = window.localStorage.getItem(LOCALE_KEY); } catch {}
      return fromCookie === "en" || (!fromCookie && stored === "en") ? "en" : "id";
    } catch {
      return "id";
    }
  }

  var BANNER_COPY = {
    id: { tag: "MODE CURANG", note: "Mode demo — data & sensor asli tidak berubah", exit: "Keluar" },
    en: { tag: "CHEAT MODE", note: "Demo sandbox — real data & sensors untouched", exit: "Exit" },
  };

  // Mirrors src/game/dev/trial-constants.ts (TRIAL_GATE_LEVEL / TRIAL_GATE_XP).
  // Pinned by tests/trial-mode.test.ts; the banner and trial.js read these.
  //
  // Declared BEFORE the copy table below, which bakes the level into a string
  // at definition time: `var` hoists the declaration but not the assignment,
  // so with these underneath, the banner read "Lv.undefined reached".
  var TRIAL_GATE_LEVEL = 5;
  var TRIAL_XP_PER_LEVEL = 15;
  var TRIAL_GATE_XP = (TRIAL_GATE_LEVEL - 1) * TRIAL_XP_PER_LEVEL;

  // Trial mode says something different on purpose: a student is being told
  // this is a practice garden that keeps no record, and is shown how far the
  // cheat-mode gate still is. The progress line is repainted on every change.
  var TRIAL_BANNER_COPY = {
    id: {
      tag: "MODE COBA",
      note: "Kebun latihan — tidak masuk catatan asli",
      exit: "Keluar",
      toGate: function (xp) { return "Lv." + TRIAL_GATE_LEVEL + " tinggal " + xp + " XP"; },
      unlocked: "Lv." + TRIAL_GATE_LEVEL + " tercapai — Mode Curang terbuka!",
    },
    en: {
      tag: "TRIAL MODE",
      note: "Practice garden — nothing is saved to the real record",
      exit: "Exit",
      toGate: function (xp) { return "Lv." + TRIAL_GATE_LEVEL + " in " + xp + " XP"; },
      unlocked: "Lv." + TRIAL_GATE_LEVEL + " reached — Cheat Mode is open!",
    },
  };

  // ── Persistence ─────────────────────────────────────────────────────────
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.active ? parsed : null;
    } catch {
      return null;
    }
  }

  function write(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }

  // Server-rendered React pages (collection/shop/quests) can only reveal
  // locked content they were asked to send, so mirror the active flag into a
  // cookie those pages read. Still client-set and demo-only — the cookie
  // gates a fuller *view*, never a database write.
  //
  // The two cookies pull in OPPOSITE directions and are never both set:
  //   pm_cheat — show MORE than this plant owns (reveal locked content).
  //   pm_trial — show LESS: hide what the real plant owns, because a trial
  //              starts from nothing and a student must not inherit the demo
  //              account's badges and shop items.
  function setCookie(mode) {
    var write = function (name, on) {
      try {
        document.cookie = on
          ? name + "=1;path=/;max-age=86400;samesite=lax"
          : name + "=;path=/;max-age=0;samesite=lax";
      } catch {}
    };
    write("pm_cheat", mode === "cheat");
    write("pm_trial", mode === "trial");
  }

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    } catch {}
  }

  /** Report a care-action press (see press() for what the detail carries).
   *  Separate from CHANGE_EVENT because a press is a discrete act a game can
   *  score, while changes fire four times a second from the drift tick. */
  function emitPress(detail) {
    try {
      window.dispatchEvent(new CustomEvent(PRESS_EVENT, { detail: detail }));
    } catch {}
  }

  // ── Default sandbox seed ────────────────────────────────────────────────
  // Cloned from the caller's snapshot of real state where available, else
  // these presentation-friendly defaults. Never persisted to any backend.
  function defaultState(seed, mode) {
    seed = seed || {};
    var status = seed.status || {};
    var vitals = seed.vitals || {};
    return {
      active: true,
      // "cheat" (presenter sandbox) or "trial" (student onboarding game).
      // Anything unrecognised reads as cheat, which is the pre-trial behaviour.
      mode: mode === "trial" ? "trial" : "cheat",
      // Trial game state (counters, hazard schedule). Owned entirely by
      // trial.js; null in cheat mode. Kept inside this blob so one
      // localStorage key still holds the whole sandbox and survives navigation.
      trial: null,
      startedAt: Date.now(),
      status: {
        level: numOr(status.level, 1),
        totalXp: numOr(status.totalXp, 0),
        days: numOr(status.days, 0),
        seeds: numOr(status.seeds, 0),
      },
      vitals: {
        temperature: numOr(vitals.temperature, 24),
        humidity: numOr(vitals.humidity, 55),
        light: numOr(vitals.light, 60),
        soilPh: numOr(vitals.soilPh, 6.2),
      },
      // Quest key -> forced stage (1..4), 0/absent = let the sensors speak.
      quests: seed.quests || {},
      // Which quest the HERO MISSION card shows. Null = whichever one Supabase
      // actually made active. The board sets this so a presenter can demo any
      // quest, not only the one the real plant happens to be running.
      heroQuest: seed.heroQuest || null,
      // Shop: unlock/own everything for the demo.
      shop: { ownAll: seed.shop && seed.shop.ownAll ? true : false },
      // Collection: reveal every mood / badge / chapter.
      collection: { revealAll: seed.collection && seed.collection.revealAll ? true : false },
      // Care actions currently held (see ACTIONS below).
      actions: defaultActions(seed.actions),
    };
  }

  function numOr(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // ── Care actions ────────────────────────────────────────────────────────
  // Typing 34 into a box teaches nothing. Pressing "put it in the sun" and
  // watching the thermometer climb teaches the whole lesson, which is what
  // this sandbox exists for. So the sensors are driven by the physical things
  // a child can actually do to a pot.
  //
  // Two kinds, because the real world has two kinds:
  //   toggle — a state the plant is left IN. Holds until the opposing action
  //            is pressed, and the readings keep moving the whole time.
  //   delta  — one act, one fixed change. Pressing again does it again.
  //
  // Toggles live in exclusive slots: you cannot have a pot in the sun AND in
  // the shade, or cup it in your hands while a box is over it. Picking one in
  // a slot releases the other, which is what "the opposing action" means.
  //
  // The simulation lives here, in the store, rather than in either panel —
  // that way the readings keep flowing while the presenter walks from
  // Monitoring to My Garden, and the mascot reacts in real time.

  // Mirror of SENSOR_LIMITS in src/types/raw-sensors.ts (what the real ingest
  // endpoint accepts). Pinned by tests/cheat-sandbox-wiring.test.ts.
  var VITAL_LIMITS = {
    temperature: { min: -40, max: 100 },
    humidity: { min: 0, max: 100 },
    light: { min: 0, max: 100 },
    soilPh: { min: 0, max: 14 },
  };

  // Thresholds the targets are expressed against, so "put it in the sun"
  // overheats a strawberry and a cayenne at their own different temperatures.
  // Defaults are the strawberry profile; setBands swaps in the live crop.
  var bands = {
    temp: { recMin: 20, recMax: 24, overheatEnter: 28, coldEnter: 14 },
    humidity: { recMin: 40, recMax: 60, dryEnter: 40, humidEnter: 60 },
    ph: { recMin: 5.5, recMax: 6.5 },
    light: { min: 30 },
  };

  var mid = function (a, b) { return (a + b) / 2; };

  /** Where each toggle is trying to drag the readings. Absolute values, not
   *  steps — the tick eases toward them, so nothing runs away. */
  function toggleTargets(id) {
    var t = bands.temp, h = bands.humidity;
    switch (id) {
      case "sun": return { temperature: t.overheatEnter + 6, light: 95 };
      case "shade": return { temperature: mid(t.recMin, t.recMax), light: 25 };
      case "cold": return { temperature: t.coldEnter - 4, humidity: h.dryEnter - 3 };
      case "warm": return { temperature: mid(t.recMin, t.recMax) };
      case "hands": return { temperature: t.overheatEnter + 2, light: 5, humidity: h.humidEnter };
      case "box": return { light: 2 };
      case "bag": return { humidity: h.humidEnter + 15, temperature: t.overheatEnter };
      case "vent": return { humidity: h.dryEnter - 5 };
      case "lamp": return { light: 70 };
      default: return {};
    }
  }

  var ACTIONS = [
    // toggles — the plant is left in this state
    { id: "sun", kind: "toggle", slot: "place", emoji: "☀️", id_label: "Jemur di bawah matahari", en_label: "Put it in the sun" },
    { id: "shade", kind: "toggle", slot: "place", emoji: "🌳", id_label: "Pindahkan ke tempat teduh", en_label: "Move it to the shade" },
    { id: "cold", kind: "toggle", slot: "place", emoji: "❄️", id_label: "Kenakan angin dingin", en_label: "Sit it in cold air" },
    { id: "warm", kind: "toggle", slot: "place", emoji: "🧥", id_label: "Pindahkan ke tempat hangat", en_label: "Move it somewhere warm" },
    { id: "hands", kind: "toggle", slot: "cover", emoji: "🤲", id_label: "Tangkupkan dengan tangan", en_label: "Cup it in your hands" },
    { id: "box", kind: "toggle", slot: "cover", emoji: "📦", id_label: "Tutup dengan kardus", en_label: "Put a box over it" },
    { id: "bag", kind: "toggle", slot: "cover", emoji: "🫙", id_label: "Selubungi dengan plastik", en_label: "Cover it with a clear bag" },
    { id: "vent", kind: "toggle", slot: "vent", emoji: "🪟", id_label: "Buka jendela", en_label: "Open a window" },
    { id: "lamp", kind: "toggle", slot: "lamp", emoji: "💡", id_label: "Nyalakan lampu", en_label: "Switch a lamp on" },
    // deltas — one act, one change
    { id: "mist", kind: "delta", emoji: "💦", id_label: "Semprot daunnya", en_label: "Mist the leaves" },
    { id: "fan", kind: "delta", emoji: "🌬️", id_label: "Kipasi", en_label: "Fan it" },
    { id: "ash", kind: "delta", slow: true, emoji: "🪵", id_label: "Taburkan abu kayu", en_label: "Sprinkle wood ash" },
    { id: "leafmould", kind: "delta", slow: true, emoji: "🍂", id_label: "Campur humus daun", en_label: "Mix in leaf mould" },
    { id: "rinse", kind: "delta", slow: true, emoji: "💧", id_label: "Bilas dengan air biasa", en_label: "Rinse with plain water" },
    { id: "freshsoil", kind: "delta", slow: true, emoji: "🪴", id_label: "Campur tanah baru", en_label: "Mix in fresh potting soil" },
  ];

  /** One press of a delta action. `toward` pulls pH into the healthy band
   *  instead of shoving it a fixed way, which is what a rinse or fresh soil
   *  actually does. */
  function applyDelta(id, vitals) {
    var p = bands.ph;
    var toward = function (value, lo, hi, step) {
      if (value < lo) return Math.min(lo, value + step);
      if (value > hi) return Math.max(hi, value - step);
      return value;
    };
    switch (id) {
      case "mist": return { humidity: vitals.humidity + 8, temperature: vitals.temperature - 0.5 };
      case "fan": return { humidity: vitals.humidity - 6, temperature: vitals.temperature - 1 };
      case "ash": return { soilPh: vitals.soilPh + 0.4 };
      case "leafmould": return { soilPh: vitals.soilPh - 0.4 };
      case "rinse": return { soilPh: toward(vitals.soilPh, p.recMin, p.recMax, 0.5) };
      case "freshsoil": return { soilPh: toward(vitals.soilPh, p.recMin, p.recMax, 0.5) };
      default: return {};
    }
  }

  function fit(key, value) {
    var limit = VITAL_LIMITS[key];
    var clamped = limit ? Math.min(limit.max, Math.max(limit.min, value)) : value;
    // Temperature and pH read in tenths; humidity and light are whole percent.
    return key === "humidity" || key === "light" ? Math.round(clamped) : Math.round(clamped * 10) / 10;
  }

  function defaultActions(seed) {
    seed = seed || {};
    return {
      place: seed.place || null,
      cover: seed.cover || null,
      vent: seed.vent || null,
      lamp: seed.lamp || null,
    };
  }

  /** Compose every held toggle into one set of targets. Later entries win, so
   *  a cover beats where the pot is standing and beats the lamp — which is
   *  true: a box over the plant is darker than any room. */
  function activeTargets(actions) {
    var targets = {};
    ["place", "vent", "lamp", "cover"].forEach(function (slot) {
      var id = actions && actions[slot];
      if (!id) return;
      var next = toggleTargets(id);
      Object.keys(next).forEach(function (axis) { targets[axis] = next[axis]; });
    });
    return targets;
  }

  // Newton's law of cooling, near enough: each tick closes a fixed fraction of
  // the remaining gap. Reaching a mood takes a few seconds of holding rather
  // than one press, which is the point — and nothing can run away, because the
  // target is where it stops.
  var TICK_MS = 250;
  var TAU_MS = 6000;
  // A tick that has drifted this far is a tab that was throttled or asleep;
  // treat it as one ordinary step instead of teleporting to the target.
  var MAX_STEP_MS = 1000;
  var ticker = null;
  var lastTickAt = 0;

  function tick() {
    var state = read();
    if (!state) { stopTicking(); return; }
    var targets = activeTargets(state.actions);
    var axes = Object.keys(targets);
    var now = Date.now();
    var dt = Math.min(MAX_STEP_MS, Math.max(0, now - lastTickAt));
    lastTickAt = now;
    if (axes.length === 0) return; // every toggle released: freeze in place
    // Measured against the real clock, not the number of ticks: setInterval is
    // throttled by browsers often enough that counting ticks made the pace
    // wander (a held toggle ran ~3x slow on the deployed page). Elapsed time
    // keeps the curve identical no matter how the timer actually fires.
    var ease = 1 - Math.exp(-dt / TAU_MS);
    var changed = false;
    axes.forEach(function (axis) {
      var from = numOr(state.vitals[axis], 0);
      var next = fit(axis, from + (targets[axis] - from) * ease);
      if (next !== from) { state.vitals[axis] = next; changed = true; }
    });
    if (!changed) return; // settled on the target — stop churning localStorage
    write(state);
    emit();
  }

  function startTicking() {
    if (ticker !== null || typeof window === "undefined") return;
    lastTickAt = Date.now(); // so the first step is one interval, not since 1970
    ticker = window.setInterval(tick, TICK_MS);
  }

  function stopTicking() {
    if (ticker === null) return;
    window.clearInterval(ticker);
    ticker = null;
  }

  /** Run the clock only while something is actually being held. */
  function syncTicker() {
    var state = read();
    if (state && Object.keys(activeTargets(state.actions)).length > 0) startTicking();
    else stopTicking();
  }

  // ── Public API ──────────────────────────────────────────────────────────
  var PMCheat = {
    KEY: KEY,
    CHANGE_EVENT: CHANGE_EVENT,

    isActive: function () {
      return read() !== null;
    },

    /**
     * Enter the sandbox in `mode` ("cheat" by default).
     *
     * Cheat mode clones `seed` (a snapshot of real progress) so a demo starts
     * from where the plant actually is. Trial mode passes no seed at all: the
     * student must begin at Lv.1 owning nothing, which is what makes the first
     * level-up mean something.
     */
    activate: function (seed, mode) {
      var next = defaultState(seed, mode);
      write(next);
      setCookie(next.mode);
      mountBanner();
      emit();
      syncTicker();
    },

    /** Leave the sandbox — wipes all sandbox values (both modes); app returns
     *  to normal. */
    deactivate: function () {
      stopTicking();
      try { window.localStorage.removeItem(KEY); } catch {}
      setCookie(null);
      unmountBanner();
      emit();
    },

    /** Full sandbox state, or null when inactive. */
    getState: function () {
      return read();
    },

    /** Read one dotted path (e.g. "status.level", "vitals.temperature"). */
    get: function (path, fallback) {
      var state = read();
      if (!state) return fallback;
      var parts = String(path).split(".");
      var node = state;
      for (var i = 0; i < parts.length; i++) {
        if (node == null || typeof node !== "object") return fallback;
        node = node[parts[i]];
      }
      return node === undefined ? fallback : node;
    },

    /** Merge a patch object into the sandbox (shallow per top-level key),
     *  persist, and notify listeners. No-op when inactive. */
    set: function (patch) {
      var state = read();
      if (!state) return;
      Object.keys(patch || {}).forEach(function (topKey) {
        var value = patch[topKey];
        if (value && typeof value === "object" && !Array.isArray(value) && state[topKey] && typeof state[topKey] === "object") {
          Object.keys(value).forEach(function (k) { state[topKey][k] = value[k]; });
        } else {
          state[topKey] = value;
        }
      });
      write(state);
      emit();
    },

    /** The care actions both panels render. One list so My Garden and
     *  Monitoring can never drift apart. */
    ACTIONS: ACTIONS,

    /** Point the toggle targets at the live crop's thresholds, so "put it in
     *  the sun" overheats each crop at its own temperature. Called by whoever
     *  knows the profile; without it the strawberry defaults apply. */
    setBands: function (next) {
      if (!next) return;
      if (next.temp) Object.keys(next.temp).forEach(function (k) { bands.temp[k] = numOr(next.temp[k], bands.temp[k]); });
      if (next.humidity) Object.keys(next.humidity).forEach(function (k) { bands.humidity[k] = numOr(next.humidity[k], bands.humidity[k]); });
      if (next.ph) Object.keys(next.ph).forEach(function (k) { bands.ph[k] = numOr(next.ph[k], bands.ph[k]); });
      if (next.light) Object.keys(next.light).forEach(function (k) { bands.light[k] = numOr(next.light[k], bands.light[k]); });
    },

    /** Which toggle is held in each slot: { place, cover, vent, lamp }. */
    getActions: function () {
      var state = read();
      return state ? defaultActions(state.actions) : defaultActions(null);
    },

    /**
     * Press a care action. A toggle claims its slot (or releases it when it
     * was already held); a delta applies its change once. Client-only, like
     * every other sandbox write — localStorage and nothing else.
     */
    press: function (id) {
      var state = read();
      if (!state) return;
      var action = ACTIONS.find(function (a) { return a.id === id; });
      if (!action) return;
      // Snapshot before the press so a listener can judge whether the press
      // actually helped the plant — trial.js scores exactly that (§4.2).
      var before = { temperature: state.vitals.temperature, humidity: state.vitals.humidity, light: state.vitals.light, soilPh: state.vitals.soilPh };
      if (action.kind === "toggle") {
        state.actions = defaultActions(state.actions);
        // Pressing the held action again releases it; the readings then stay
        // exactly where they are rather than drifting back on their own.
        state.actions[action.slot] = state.actions[action.slot] === id ? null : id;
      } else {
        var patch = applyDelta(id, state.vitals);
        Object.keys(patch).forEach(function (axis) { state.vitals[axis] = fit(axis, patch[axis]); });
      }
      write(state);
      // A toggle changes nothing yet — it aims the tick at a target — so the
      // press report carries BOTH what the readings are now and where they are
      // now headed. Without the targets a listener could not tell "move it to
      // the shade" (helpful) from "put it in the sun" (not) at press time.
      emitPress({
        id: id,
        kind: action.kind,
        slow: !!action.slow,
        before: before,
        after: { temperature: state.vitals.temperature, humidity: state.vitals.humidity, light: state.vitals.light, soilPh: state.vitals.soilPh },
        targets: activeTargets(state.actions),
      });
      emit();
      syncTicker();
    },

    /** Release every held toggle and stop the drift. Trial mode fires a hazard
     *  by force, and a toggle left holding from the previous rescue would let
     *  the simulation undo that hazard with no new action from the student. */
    releaseToggles: function () {
      var state = read();
      if (!state) return;
      state.actions = defaultActions(null);
      write(state);
      emit();
      syncTicker();
    },

    /** Which mode the sandbox is in: "cheat" | "trial". Null when inactive. */
    getMode: function () {
      var state = read();
      return state ? (state.mode === "trial" ? "trial" : "cheat") : null;
    },

    /**
     * Promote a trial run to full cheat mode, keeping everything the student
     * earned (level, XP, Seeds, days, sensor readings).
     *
     * Deliberately NOT gated on the level. A classroom demo goes wrong in a
     * hundred ways — the projector dies, the period runs short, a student gets
     * stuck — and the presenter must always be able to take the wheel. The
     * level gate is a celebration, not a lock (implementation.md §3).
     */
    switchToCheat: function () {
      var state = read();
      if (!state) return;
      state.mode = "cheat";
      state.trial = null;
      write(state);
      setCookie("cheat");
      unmountBanner();
      mountBanner();
      emit();
    },

    /** The crop thresholds the physics is expressed against. Trial mode reads
     *  these to derive moods and to score whether a press helped, so both files
     *  answer to the same profile without duplicating setBands' plumbing. */
    getBands: function () {
      return {
        temp: { recMin: bands.temp.recMin, recMax: bands.temp.recMax, overheatEnter: bands.temp.overheatEnter, coldEnter: bands.temp.coldEnter },
        humidity: { recMin: bands.humidity.recMin, recMax: bands.humidity.recMax, dryEnter: bands.humidity.dryEnter, humidEnter: bands.humidity.humidEnter },
        ph: { recMin: bands.ph.recMin, recMax: bands.ph.recMax },
        light: { min: bands.light.min },
      };
    },

    /** Clamp a value to what real hardware could report, using the same
     *  rounding the tick uses. Trial hazards write sensors directly. */
    fitVital: function (key, value) {
      return fit(key, value);
    },

    /** Subscribe to sandbox changes (this tab + other tabs via storage). */
    onChange: function (cb) {
      if (typeof cb !== "function") return function () {};
      window.addEventListener(CHANGE_EVENT, cb);
      window.addEventListener("storage", function (e) {
        if (!e || e.key === KEY) cb();
      });
      return function () { window.removeEventListener(CHANGE_EVENT, cb); };
    },
  };

  // ── Persistent banner (injected on every page while active) ─────────────
  var BANNER_ID = "pm-cheat-banner";

  /** Repaint the trial banner's progress line from the current XP. Called on
   *  every sandbox change, so the gate distance is always on screen — a
   *  two-minute goal only motivates while it is visible. */
  function updateBannerProgress() {
    var bar = document.getElementById(BANNER_ID);
    if (!bar) return;
    var out = bar.querySelector(".pm-cheat-progress");
    if (!out) return;
    var copy = TRIAL_BANNER_COPY[detectLocale()] || TRIAL_BANNER_COPY.en;
    var xp = numOr(PMCheat.get("status.totalXp", 0), 0);
    var remaining = Math.max(0, TRIAL_GATE_XP - xp);
    out.textContent = remaining > 0 ? copy.toGate(remaining) : copy.unlocked;
    out.classList.toggle("is-unlocked", remaining === 0);
    var fill = bar.querySelector(".pm-cheat-progress-fill");
    if (fill) fill.style.width = Math.round(Math.min(1, xp / TRIAL_GATE_XP) * 100) + "%";
  }

  function mountBanner() {
    if (typeof document === "undefined") return;
    if (document.getElementById(BANNER_ID)) return;
    if (!PMCheat.isActive()) return;
    var trial = PMCheat.getMode() === "trial";
    var copy = trial
      ? TRIAL_BANNER_COPY[detectLocale()] || TRIAL_BANNER_COPY.en
      : BANNER_COPY[detectLocale()] || BANNER_COPY.en;
    var bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.setAttribute("role", "status");
    bar.setAttribute("data-mode", trial ? "trial" : "cheat");
    bar.innerHTML =
      '<span class="pm-cheat-tag">' + (trial ? "🎮 " : "🎛️ ") + copy.tag + "</span>" +
      '<span class="pm-cheat-note">' + copy.note + "</span>" +
      (trial
        ? '<span class="pm-cheat-progress-track"><span class="pm-cheat-progress-fill"></span></span>' +
          '<span class="pm-cheat-progress"></span>'
        : "") +
      '<button type="button" class="pm-cheat-exit">' + copy.exit + " ✕</button>";
    var style = bar.style;
    style.position = "fixed";
    style.top = "0";
    style.left = "0";
    style.right = "0";
    style.zIndex = "99999";
    style.display = "flex";
    style.alignItems = "center";
    style.gap = "12px";
    style.padding = "6px 14px";
    style.font = "600 12px/1.2 var(--font-heading, ui-monospace, monospace)";
    // Trial mode wears the garden's green so a student never mistakes the
    // practice run for the presenter's amber cheat bar.
    style.color = trial ? "#123a1c" : "#3a2600";
    style.background = trial
      ? "linear-gradient(90deg,#A8E063,#56AB2F)"
      : "linear-gradient(90deg,#FFD86B,#FF9C4B)";
    style.borderBottom = trial ? "3px solid #2F7A1E" : "3px solid #C2618A";
    style.boxShadow = "0 3px 10px rgba(0,0,0,.25)";
    style.letterSpacing = ".04em";
    var exit = bar.querySelector(".pm-cheat-exit");
    if (exit) {
      exit.style.cssText =
        "margin-left:auto;cursor:pointer;border:2px solid currentColor;border-radius:8px;background:#fff;color:inherit;font:inherit;padding:3px 10px;";
      exit.addEventListener("click", function () {
        PMCheat.deactivate();
        try { window.location.reload(); } catch {}
      });
    }
    var note = bar.querySelector(".pm-cheat-note");
    if (note) note.style.cssText = "opacity:.85;font-weight:500;";
    var track = bar.querySelector(".pm-cheat-progress-track");
    if (track) {
      track.style.cssText =
        "flex:0 1 140px;height:10px;border:2px solid #123a1c;border-radius:6px;background:rgba(255,255,255,.55);overflow:hidden;";
      var fill = bar.querySelector(".pm-cheat-progress-fill");
      if (fill) fill.style.cssText = "display:block;height:100%;width:0%;background:#123a1c;transition:width .3s ease;";
    }
    var progress = bar.querySelector(".pm-cheat-progress");
    if (progress) progress.style.cssText = "font-weight:700;white-space:nowrap;";
    document.body.appendChild(bar);
    // NO marker attribute on <body>. This script runs beforeInteractive on
    // every React route, so writing one landed before React hydrated and React
    // reported a mismatch on every navigation while a sandbox was on ("some
    // attributes of the server rendered HTML didn't match… This won't be
    // patched up") — the failure mode that has already cost this project a
    // dead page once. Deferring it with a timeout still lost the race. Nothing
    // in the app ever read the attribute, so the fix is simply not to set it;
    // the banner element above is the visible marker, and it is appended
    // outside React's root where hydration does not look.
    if (trial) updateBannerProgress();
  }

  function unmountBanner() {
    if (typeof document === "undefined") return;
    var bar = document.getElementById(BANNER_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  // Mount on load if a sandbox is already active (survives page navigation).
  function boot() {
    if (!PMCheat.isActive()) return;
    mountBanner();
    // A toggle held before navigating keeps running on the next page.
    syncTicker();
  }

  // The trial banner's progress line follows the XP the game engine writes.
  // Registered unconditionally (it no-ops without a trial banner in the DOM)
  // so a mid-session switch into trial mode is picked up without re-wiring.
  window.addEventListener(CHANGE_EVENT, updateBannerProgress);
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  window.PMCheat = PMCheat;
})();
