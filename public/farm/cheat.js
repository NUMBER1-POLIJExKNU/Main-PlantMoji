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
    };
  }

  function numOr(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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
    },

    /** Leave the sandbox — wipes all cheat values; app returns to normal. */
    deactivate: function () {
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
    if (PMCheat.isActive()) mountBanner();
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
