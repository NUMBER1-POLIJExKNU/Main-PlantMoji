// PlantMoji unified one-time "seen" store (window.PMSeen).
//
// ONE localStorage blob — pm_seen_v3, JSON {"v":3,"seen":{"<id>":1}} — owns
// every "has the kid met this moment yet?" flag on both hosts (this vanilla
// farm layer and the React shell's src/lib/seen.ts, which implements the
// exact same contract). 1 = seen; absent = not seen. Ids are namespaced
// strings: "hatch", "tour", "guide.farm", "guide.home", "tiles.tried",
// future "dare.*"/"coach.*" cards.
//
// Migration (first read only): the four legacy single-key flags map into
// the blob — pm_hatched → "hatch", pm_tour_seen_v1 → "tour",
// plantmoji_guide_seen_v1 → "guide.farm", plantmoji_guide_seen_v2 →
// "guide.home". The legacy keys are left in place afterwards (harmless)
// but are NEVER read again by live.js. reset() therefore empties the blob
// rather than removing it — a removed key would look like a first read and
// resurrect the legacy flags.
//
// Storage honesty: every localStorage access sits in try/catch.
//   - Writes failing (old-Safari private mode, quota): graceful no-persist —
//     the in-memory map still answers seen() for this session, nothing is
//     saved, nothing throws.
//   - Reads failing (storage blocked entirely): fail CLOSED — seen() reports
//     everything as seen, so a one-time moment (hatch, tour) can never
//     replay forever. Same silence the old per-flag try/catch guards kept.
//
// Classic script, loaded from index.html BEFORE the live.js module (same
// pattern as strings.js). No network, no XP, no game writes — flags only.

(function () {
  "use strict";

  var KEY = "pm_seen_v3";
  var LEGACY = {
    pm_hatched: "hatch",
    pm_tour_seen_v1: "tour",
    plantmoji_guide_seen_v1: "guide.farm",
    plantmoji_guide_seen_v2: "guide.home",
  };

  var state = null; // { "<id>": 1 } once loaded — in-memory source of truth
  var broken = false; // storage READS failed → fail closed (see header)

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: 3, seen: state }));
    } catch {
      // Private mode / quota: keep the in-memory state, persist nothing.
    }
  }

  /** Lazy one-time load; runs the legacy migration on the very first read. */
  function load() {
    if (state !== null || broken) return;
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch {
      broken = true;
      return;
    }
    if (raw != null) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.seen && typeof parsed.seen === "object") {
          state = {};
          for (var id in parsed.seen) {
            if (parsed.seen[id]) state[id] = 1;
          }
          return;
        }
      } catch {
        // Corrupted blob — fall through and rebuild from the legacy flags.
      }
    }
    // First read (or an unreadable blob): migrate the legacy flags once.
    state = {};
    for (var legacyKey in LEGACY) {
      var value = null;
      try {
        value = window.localStorage.getItem(legacyKey);
      } catch {
        // A single unreadable legacy key just stays unmigrated.
      }
      if (value) state[LEGACY[legacyKey]] = 1;
    }
    persist();
  }

  window.PMSeen = {
    /** True when the id was already seen (or the store is unreadable — fail closed). */
    seen: function (id) {
      load();
      if (broken) return true;
      return state[String(id)] === 1;
    },
    /** Mark one id seen (idempotent) and persist when storage allows. */
    markSeen: function (id) {
      load();
      if (broken) return;
      var key = String(id);
      if (state[key] === 1) return;
      state[key] = 1;
      persist();
    },
    /** Forget ONE id — replay = clear one flag. */
    clear: function (id) {
      load();
      if (broken) return;
      var key = String(id);
      if (state[key] !== 1) return;
      delete state[key];
      persist();
    },
    /** Forget everything. Writes an EMPTY blob (never removes the key) so
     *  the legacy migration can't resurrect old flags on the next read. */
    reset: function () {
      load();
      if (broken) return;
      state = {};
      persist();
    },
  };
})();
