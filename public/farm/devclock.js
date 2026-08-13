// PlantMoji · Developer clock override (window.PMClock).
//
// Shifts the WIB wall clock the APP reads, so the night-only behaviour
// (18:00-06:00 WIB: Jamkachu sleeps, the guardian camera suspends sampling,
// live.js drops camera_events, the sky turns dark) can be exercised from a
// timezone where it is the wrong time of day. Built for exactly one problem:
// testing the camera fan-out from Korea, where WIB 06:00-18:00 is KST
// 08:00-20:00 and an evening test hits the sleep gate on BOTH devices.
//
// WHAT IT DOES NOT DO — and must never do:
//   * It does NOT patch Date.now(), Date, or performance.now(). Every
//     cooldown, throttle, rate limit, animation and timer in this app is
//     built on real elapsed time; shifting that globally would silently
//     break the 10s motion gap, the 10min scan gate and the fx queue. Only
//     code that asks "what time of day is it in Jember?" reads this file.
//   * It never touches Supabase, the game API, Node-RED or the hardware.
//     The whole store is one integer in localStorage.
//   * It stores an OFFSET, not a frozen timestamp. Time keeps flowing at
//     1x; a clock stopped dead would be a different (and more confusing)
//     kind of lie than a clock that is simply somewhere else.
//
// Scope: ONE DEVICE. localStorage is per-origin per-device, so overriding on
// the tablet does nothing to the desktop. Testing a two-device fan-out means
// setting it on both — the panel in developer mode says so.
//
// Plain synchronous script (NOT a module), like cheat.js, so a bare
// <script src="/farm/devclock.js"> works on the static shell AND on every
// React route via the shared layout. Every consumer must read defensively
// (window.PMClock?.now() ?? new Date()) so a missing tag is just "no
// override", never a broken page.

(function () {
  "use strict";

  var KEY = "plantmoji_devclock_v1";
  var CHANGE_EVENT = "pmclock:change";
  var BADGE_ID = "pm-devclock-badge";
  // A shift this large is almost certainly a typo or a corrupted store, and
  // a clock a year out would quietly poison every "today" the UI prints.
  var MAX_OFFSET_MS = 36 * 60 * 60 * 1000; // ±36h covers any hour-of-day pick

  var offsetMs = 0;

  function readStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return 0;
      var value = Number(JSON.parse(raw).offsetMs);
      if (!isFinite(value)) return 0;
      // Clamp rather than reject: a half-broken store should degrade to a
      // sane clock, not leave the tester with a silently ignored setting.
      return Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(value)));
    } catch {
      return 0;
    }
  }

  function writeStore(value) {
    try {
      if (value === 0) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, JSON.stringify({ offsetMs: value }));
    } catch {
      // Private mode / quota: the override still applies to THIS page for as
      // long as it is open. Nothing else in the app depends on it persisting.
    }
  }

  offsetMs = readStore();

  /** WIB (Asia/Jakarta) wall-clock parts for a Date. Mirrors live.js's
   *  wibNow(), including the fixed UTC+7 fallback for an Intl build with no
   *  IANA data — Jember has no DST, so the fallback is exact. */
  function wibParts(date) {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(date);
      var get = function (type) {
        var found = parts.find(function (part) { return part.type === type; });
        return found ? found.value : "";
      };
      var day = get("year") + "-" + get("month") + "-" + get("day");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      return { date: day, hour: Number(get("hour")) % 24, minute: Number(get("minute")) || 0 };
    } catch {
      var shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      var month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
      var dayOfMonth = String(shifted.getUTCDate()).padStart(2, "0");
      return {
        date: shifted.getUTCFullYear() + "-" + month + "-" + dayOfMonth,
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
      };
    }
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function label(parts) {
    return parts ? pad2(parts.hour) + ":" + pad2(parts.minute) : "--:--";
  }

  function notify() {
    mountBadge();
    paintBadge();
    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    } catch {
      // Ancient engine without CustomEvent: subscribers just miss the push.
      // Everything that reads the clock also re-reads it on its own timer.
    }
  }

  function apply(next) {
    var clamped = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(next || 0)));
    if (clamped === offsetMs) return;
    offsetMs = clamped;
    writeStore(clamped);
    notify();
  }

  var PMClock = {
    /** Milliseconds added to real time. 0 = no override (the normal state). */
    offsetMs: function () { return offsetMs; },
    isActive: function () { return offsetMs !== 0; },
    /** The Date every WIB-derived readout in the app should be built from. */
    now: function () { return new Date(Date.now() + offsetMs); },
    /** Effective WIB parts — what the app believes the Jember clock says. */
    wib: function () { return wibParts(PMClock.now()); },
    /** True WIB parts, for showing the tester both numbers side by side. */
    realWib: function () { return wibParts(new Date()); },
    label: function () { return label(PMClock.wib()); },
    realLabel: function () { return label(PMClock.realWib()); },
    setOffsetMs: function (value) { apply(value); },

    /**
     * Shift the clock so WIB reads `hour:minute` RIGHT NOW, then let it run.
     *
     * The shift is normalised to the smallest move that lands on that time
     * (never more than 12h either way), so asking for 10:00 at 23:00 WIB
     * moves forward 11h rather than back 13h. The WIB calendar DATE can
     * therefore change by one day — harmless, because every date-derived
     * readout downstream is presentation ("Today"/"Yesterday", the streak
     * nudge) and nothing writes a date to Supabase from the client.
     */
    setWibTime: function (hour, minute) {
      var h = Number(hour);
      var m = Number(minute || 0);
      if (!isFinite(h) || !isFinite(m)) return;
      h = Math.max(0, Math.min(23, Math.floor(h)));
      m = Math.max(0, Math.min(59, Math.floor(m)));
      var real = wibParts(new Date());
      if (!real) return;
      var delta = h * 60 + m - (real.hour * 60 + real.minute);
      // Wrap into (-720, 720] — the least-surprising direction to travel.
      delta = ((delta % 1440) + 1440) % 1440;
      if (delta > 720) delta -= 1440;
      apply(delta * 60 * 1000);
    },

    clear: function () { apply(0); },

    onChange: function (cb) {
      window.addEventListener(CHANGE_EVENT, cb);
      // Another tab on this device wrote the key — adopt it and repaint, so
      // setting the override in Settings updates an already-open /camera.
      var onStorage = function (e) {
        if (e && e.key !== KEY && e.key !== null) return;
        var next = readStore();
        if (next === offsetMs) return;
        offsetMs = next;
        mountBadge();
        paintBadge();
        cb();
      };
      window.addEventListener("storage", onStorage);
      return function () {
        window.removeEventListener(CHANGE_EVENT, cb);
        window.removeEventListener("storage", onStorage);
      };
    },
  };

  // ── Badge ───────────────────────────────────────────────────────────────
  // A time override that leaves no mark on the screen is a trap: you forget
  // it is on, then read every later "why is Jamkachu asleep?" as a bug — or
  // worse, present with it. Bottom-left so it never sits under the cheat
  // banner (fixed to the top).

  function badgeCopy() {
    var locale = "id";
    try {
      var cookie = document.cookie
        .split(";")
        .map(function (v) { return v.trim(); })
        .find(function (v) { return v.indexOf("plantmoji_locale=") === 0; });
      var fromCookie = cookie ? cookie.split("=")[1] : null;
      var stored = window.localStorage.getItem("plantmoji_locale");
      locale = fromCookie === "en" || (!fromCookie && stored === "en") ? "en" : "id";
    } catch {
      locale = "id";
    }
    return locale === "en"
      ? { tag: "TIME SHIFTED", real: "real", clear: "Reset" }
      : { tag: "WAKTU DIGESER", real: "asli", clear: "Atur ulang" };
  }

  function paintBadge() {
    // Same guard mountBadge carries. Reached from notify() and from the 20s
    // interval, so without it any non-browser host (a test harness, a stray
    // SSR import) throws on the first change instead of quietly no-opping.
    if (typeof document === "undefined") return;
    var badge = document.getElementById(BADGE_ID);
    if (!badge) return;
    if (!PMClock.isActive()) {
      badge.remove();
      return;
    }
    var copy = badgeCopy();
    var text = badge.querySelector(".pm-devclock-text");
    if (text) {
      text.textContent = "⏱ " + copy.tag + " · WIB " + PMClock.label() +
        " (" + copy.real + " " + PMClock.realLabel() + ")";
    }
    var clear = badge.querySelector(".pm-devclock-clear");
    if (clear) clear.textContent = copy.clear + " ✕";
  }

  function mountBadge() {
    if (typeof document === "undefined" || !document.body) return;
    if (!PMClock.isActive()) {
      var existing = document.getElementById(BADGE_ID);
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById(BADGE_ID)) return;
    var badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.setAttribute("role", "status");
    badge.innerHTML =
      '<span class="pm-devclock-text"></span>' +
      '<button type="button" class="pm-devclock-clear"></button>';
    badge.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:99998;display:flex;align-items:center;gap:8px;" +
      "padding:5px 10px;border:3px solid #1E3A8A;border-radius:10px;background:#DBEAFE;color:#1E3A8A;" +
      "font:700 11px/1.2 var(--font-heading, ui-monospace, monospace);letter-spacing:.04em;" +
      "box-shadow:0 3px 10px rgba(0,0,0,.25);";
    var clear = badge.querySelector(".pm-devclock-clear");
    if (clear) {
      clear.style.cssText =
        "cursor:pointer;border:2px solid currentColor;border-radius:7px;background:#fff;color:inherit;font:inherit;padding:2px 7px;";
      clear.addEventListener("click", function () {
        PMClock.clear();
        try { window.location.reload(); } catch {}
      });
    }
    // Appended to <body> and nothing else. cheat.js learned the hard way that
    // writing a marker ATTRIBUTE on <body> from a beforeInteractive script
    // makes React report a hydration mismatch on every navigation; an extra
    // child element does not.
    document.body.appendChild(badge);
    paintBadge();
  }

  // The effective WIB minute rolls over on its own — keep the badge honest
  // without making any consumer responsible for repainting it.
  window.setInterval(paintBadge, 20_000);

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountBadge);
    } else {
      mountBadge();
    }
  }

  window.PMClock = PMClock;
})();
