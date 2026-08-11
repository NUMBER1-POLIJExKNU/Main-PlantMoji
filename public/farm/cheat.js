// PlantMoji · Cheat Mode (classroom-demo sandbox).
//
// A CLIENT-ONLY sandbox for live demos: it lets a presenter freely change the
// plant's status, sensor values, quests, shop and collection so a classroom
// sees big changes instantly — WITHOUT touching real hardware or the real
// Supabase data. Every value here lives in localStorage only; nothing in this
// file ever writes to Supabase, the game API, or Node-RED. Deactivating wipes
// the sandbox and the app returns to the untouched normal mode.
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
  function setCookie(on) {
    try {
      document.cookie = on
        ? "pm_cheat=1;path=/;max-age=86400;samesite=lax"
        : "pm_cheat=;path=/;max-age=0;samesite=lax";
    } catch {}
  }

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    } catch {}
  }

  // ── Default sandbox seed ────────────────────────────────────────────────
  // Cloned from the caller's snapshot of real state where available, else
  // these presentation-friendly defaults. Never persisted to any backend.
  function defaultState(seed) {
    seed = seed || {};
    var status = seed.status || {};
    var vitals = seed.vitals || {};
    return {
      active: true,
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
      // Quest key -> forced status ("ACTIVE" | "VERIFYING" | "COMPLETED").
      quests: seed.quests || {},
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

    /** Enter the sandbox, cloning `seed` (real-state snapshot) as the start. */
    activate: function (seed) {
      write(defaultState(seed));
      setCookie(true);
      mountBanner();
      emit();
      syncTicker();
    },

    /** Leave the sandbox — wipes all cheat values; app returns to normal. */
    deactivate: function () {
      stopTicking();
      try { window.localStorage.removeItem(KEY); } catch {}
      setCookie(false);
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
      emit();
      syncTicker();
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

  function mountBanner() {
    if (typeof document === "undefined") return;
    if (document.getElementById(BANNER_ID)) return;
    if (!PMCheat.isActive()) return;
    var copy = BANNER_COPY[detectLocale()] || BANNER_COPY.en;
    var bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.setAttribute("role", "status");
    bar.innerHTML =
      '<span class="pm-cheat-tag">🎛️ ' + copy.tag + "</span>" +
      '<span class="pm-cheat-note">' + copy.note + "</span>" +
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
    style.color = "#3a2600";
    style.background = "linear-gradient(90deg,#FFD86B,#FF9C4B)";
    style.borderBottom = "3px solid #C2618A";
    style.boxShadow = "0 3px 10px rgba(0,0,0,.25)";
    style.letterSpacing = ".04em";
    var exit = bar.querySelector(".pm-cheat-exit");
    if (exit) {
      exit.style.cssText =
        "margin-left:auto;cursor:pointer;border:2px solid #3a2600;border-radius:8px;background:#fff;color:#3a2600;font:inherit;padding:3px 10px;";
      exit.addEventListener("click", function () {
        PMCheat.deactivate();
        try { window.location.reload(); } catch {}
      });
    }
    var note = bar.querySelector(".pm-cheat-note");
    if (note) note.style.cssText = "opacity:.85;font-weight:500;";
    document.body.appendChild(bar);
    document.body.setAttribute("data-cheat", "on");
  }

  function unmountBanner() {
    if (typeof document === "undefined") return;
    var bar = document.getElementById(BANNER_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    document.body.removeAttribute("data-cheat");
  }

  // Mount on load if a sandbox is already active (survives page navigation).
  function boot() {
    if (!PMCheat.isActive()) return;
    mountBanner();
    // A toggle held before navigating keeps running on the next page.
    syncTicker();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  window.PMCheat = PMCheat;
})();
