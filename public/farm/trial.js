// PlantMoji · Trial Mode engine (the student onboarding game).
//
// WHY THIS EXISTS
// A class of teenagers who did not ask to be here gets about two minutes of
// attention. Normal mode cannot spend them: it needs a real plant, real
// sensors and real hours. Cheat mode cannot either — handed every power at
// once, there is nothing to learn and nothing to want. Trial mode is the
// bridge. The student starts owning nothing, cares for Jamkachu with the same
// physical actions the sandbox already models, and at Lv.6 — the level where
// the flower opens — full cheat mode unlocks. Enjoying it means playing on;
// not enjoying it means skipping ahead with every cheat unlocked. Either way
// they have held the loop once.
//
// WHAT THIS FILE OWNS
// The RULES: XP for a care action, the Happy drip, the hazard schedule, the
// in-game calendar, Seed grants, and the gate. The STATE and the sensor
// physics belong to cheat.js (window.PMCheat) and are only ever reached
// through its API, so trial mode inherits its containment for free:
// localStorage and nothing else. No Supabase, no game API, no hardware.
//
// Plain synchronous script (NOT a module), loaded after cheat.js on both the
// static farm shell and the React layout — "/" is rewritten to
// public/farm/index.html and never runs React, so both need the tag.
//
// Presentation lives in public/farm/live.js, which listens for the pmtrial:*
// events dispatched here. This file never touches the DOM.

(function () {
  "use strict";

  // ── Constants ───────────────────────────────────────────────────────────
  // Mirror of src/game/dev/trial-constants.ts. A browser script cannot import
  // the TS module, so tests/trial-mode.test.ts pins the two together — the
  // same arrangement SENSOR_LIMITS already has with cheat.js.

  var GATE_LEVEL = 6;
  var XP_PER_LEVEL = 15;
  var MAX_LEVEL = 30;
  var GATE_XP = (GATE_LEVEL - 1) * XP_PER_LEVEL;

  var XP = {
    validAction: 5,
    invalidAction: 1,
    eventResolved: 10,
    dripPerTick: 1,
  };

  var SEEDS = {
    eventResolved: 10,
    dayAdvanced: 5,
    levelUp: 5,
  };

  var TIMING = {
    dripIntervalMs: 3000,
    actionCooldownMs: 1500,
    firstEventDelayMs: 15000,
    eventGapMinMs: 10000,
    eventGapMaxMs: 20000,
    hintAfterMs: 20000,
    noticeHoldMs: 3500,
  };

  var ACTIONS_PER_DAY = 3;
  var SOIL_SKIP_DAYS = 3;

  var TICK_MS = 500;
  // A tick this far apart means a throttled or sleeping tab. Credit it as one
  // ordinary step rather than paying out minutes of drip at once — same
  // reasoning as cheat.js's MAX_STEP_MS on the sensor drift.
  var MAX_STEP_MS = 1000;

  var LOCALE_KEY = "plantmoji_locale";

  // ── Events dispatched for live.js ───────────────────────────────────────
  var EV = {
    hazard: "pmtrial:hazard",
    resolved: "pmtrial:resolved",
    hint: "pmtrial:hint",
    day: "pmtrial:day",
    gate: "pmtrial:gate",
    reward: "pmtrial:reward",
  };

  function say(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch {}
  }

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

  // ── Hazard pool ─────────────────────────────────────────────────────────
  // Each hazard shoves the readings until the mood engine is forced to a
  // specific face, then waits for the student to bring it back. Targets are
  // expressed against the LIVE crop's bands, never hardcoded numbers, so a
  // strawberry and a cayenne overheat at their own temperatures.
  //
  // `weight` biases the draw. Soil hazards are rare: their fix is the one that
  // skips days (see onPress), which is a bigger interruption than the others
  // and lands better as an occasional surprise than as every third hazard.

  var HAZARDS = [
    {
      key: "heat", emoji: "🔥", weight: 3, mood: "Overheating", hint: ["shade", "fan"],
      vitals: function (b) { return { temperature: b.temp.overheatEnter + 5, light: 90 }; },
      id: "Matahari terlalu terik!", en: "The sun is far too hot!",
    },
    {
      key: "cloud", emoji: "🌫️", weight: 3, mood: "Sleepy", hint: ["lamp", "sun"],
      vitals: function () { return { light: 10 }; },
      id: "Awan menutupi matahari…", en: "Clouds have covered the sun…",
    },
    {
      key: "dry", emoji: "💨", weight: 3, mood: "DryAir", hint: ["mist", "bag"],
      vitals: function (b) { return { humidity: b.humidity.dryEnter - 10 }; },
      id: "Anginnya kering sekali!", en: "This wind is so dry!",
    },
    {
      key: "damp", emoji: "🌧️", weight: 2, mood: "HumidAir", hint: ["vent", "fan"],
      vitals: function (b) { return { humidity: b.humidity.humidEnter + 15 }; },
      id: "Udaranya terlalu lembap!", en: "The air is far too damp!",
    },
    {
      key: "chill", emoji: "🥶", weight: 2, mood: "TooCold", hint: ["warm", "hands"],
      vitals: function (b) { return { temperature: b.temp.coldEnter - 3 }; },
      id: "Udara malam ini dingin!", en: "Tonight's air is freezing!",
    },
    {
      key: "acidic", emoji: "🧪", weight: 1, mood: "SoilAcidic", hint: ["ash", "freshsoil"],
      vitals: function (b) { return { soilPh: b.ph.recMin - 0.8 }; },
      id: "Tanahnya jadi masam…", en: "The soil has turned sour…",
    },
    {
      key: "alkaline", emoji: "🧪", weight: 1, mood: "SoilAlkaline", hint: ["leafmould", "rinse"],
      vitals: function (b) { return { soilPh: b.ph.recMax + 0.8 }; },
      id: "Tanahnya terasa aneh…", en: "Something is off with the soil…",
    },
  ];

  var COPY = {
    id: {
      day: function (n) { return "Sekarang Hari ke-" + n + "! 🌅"; },
      daySkip: function (n, skipped) { return skipped + " hari berlalu… Sekarang Hari ke-" + n + "! 🌅"; },
      resolved: "Selamat! Aku merasa sehat lagi 💚",
      hintLead: "Coba tekan",
      gate: "Lv." + GATE_LEVEL + " tercapai — Mode Curang terbuka! 🎉",
      reasonAction: "Rawat tanaman",
      reasonDrip: "Jamkachu senang",
      reasonHazard: "Krisis teratasi",
      reasonDay: "Hari baru",
    },
    en: {
      day: function (n) { return "Today is Day " + n + "! 🌅"; },
      daySkip: function (n, skipped) { return skipped + " days passed… Today is Day " + n + "! 🌅"; },
      resolved: "Thank you! I feel healthy again 💚",
      hintLead: "Try pressing",
      gate: "Lv." + GATE_LEVEL + " reached — Cheat Mode is open! 🎉",
      reasonAction: "Plant cared for",
      reasonDrip: "Jamkachu is happy",
      reasonHazard: "Crisis solved",
      reasonDay: "A new day",
    },
  };

  function hazardByKey(key) {
    for (var i = 0; i < HAZARDS.length; i++) {
      if (HAZARDS[i].key === key) return HAZARDS[i];
    }
    return null;
  }

  /** Draw the next hazard, excluding the last two so nothing repeats back to
   *  back, and honouring the per-hazard weight. */
  function chooseHazard(recent) {
    var pool = [];
    HAZARDS.forEach(function (h) {
      if ((recent || []).indexOf(h.key) >= 0) return;
      for (var i = 0; i < (h.weight || 1); i++) pool.push(h);
    });
    if (pool.length === 0) pool = HAZARDS.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function nextGap() {
    return TIMING.eventGapMinMs + Math.random() * (TIMING.eventGapMaxMs - TIMING.eventGapMinMs);
  }

  // ── Mood + "did that press help?" ───────────────────────────────────────

  /** Mirror of cheatMoodFor in live.js: same priority order, same thresholds,
   *  reading the bands cheat.js holds. Pinned by tests/trial-mode.test.ts so
   *  the hazard that forces a face and the face that gets drawn cannot drift. */
  function moodFor(v, b) {
    if (v.temperature >= b.temp.overheatEnter) return "Overheating";
    if (v.temperature <= b.temp.coldEnter) return "TooCold";
    if (v.humidity < b.humidity.dryEnter) return "DryAir";
    if (v.humidity > b.humidity.humidEnter) return "HumidAir";
    if (v.light < b.light.min) return "Sleepy";
    if (v.soilPh < b.ph.recMin) return "SoilAcidic";
    if (v.soilPh > b.ph.recMax) return "SoilAlkaline";
    return "Happy";
  }

  function outside(value, lo, hi) {
    if (!Number.isFinite(value)) return 0;
    if (value < lo) return lo - value;
    if (value > hi) return value - hi;
    return 0;
  }

  /**
   * How far the readings sit outside their healthy bands, as one number.
   *
   * Each axis is divided by roughly the width of its own scale so a degree of
   * heat, a percent of humidity and a tenth of pH contribute comparably —
   * otherwise pH, which moves in tenths, would never register against light,
   * which moves in tens.
   */
  function distance(v, b) {
    return (
      outside(v.temperature, b.temp.recMin, b.temp.recMax) / 10 +
      outside(v.humidity, b.humidity.recMin, b.humidity.recMax) / 20 +
      outside(v.soilPh, b.ph.recMin, b.ph.recMax) / 1 +
      (Number(v.light) < b.light.min ? (b.light.min - Number(v.light)) / 20 : 0)
    );
  }

  /**
   * Did this press move the plant toward health?
   *
   * A delta acts immediately, so its own result answers the question. A toggle
   * changes nothing yet — it aims the drift at a target — so the question is
   * asked of where the readings are now HEADED. That is why press reports
   * carry the composed targets: at press time "move it to the shade" and "put
   * it in the sun" have identical readings and opposite intent.
   */
  function helped(detail, b) {
    var before = distance(detail.before, b);
    if (detail.kind === "delta") return distance(detail.after, b) < before - 1e-6;
    var aimed = {
      temperature: detail.targets.temperature != null ? detail.targets.temperature : detail.before.temperature,
      humidity: detail.targets.humidity != null ? detail.targets.humidity : detail.before.humidity,
      light: detail.targets.light != null ? detail.targets.light : detail.before.light,
      soilPh: detail.targets.soilPh != null ? detail.targets.soilPh : detail.before.soilPh,
    };
    return distance(aimed, b) < before - 1e-6;
  }

  // ── Trial state ─────────────────────────────────────────────────────────

  /**
   * Timing bookkeeping, held in memory rather than in the store.
   *
   * The tick runs twice a second, and persisting from it would emit a change
   * event just as often — repainting the whole home and stepping on whatever
   * the speech bubble is holding, to save two counters nothing else reads.
   * So the store keeps only what must survive navigation (the hazard, the
   * schedule, the day counter) and these two live here. The cost is that
   * changing route drops at most one drip interval of banked Happy time.
   */
  var runtime = { lastTickAt: 0, dripAccumMs: 0 };

  function defaultTrial(now) {
    return {
      startedAt: now,
      // Care actions banked toward the next in-game day.
      actionCount: 0,
      // The hazard currently unsolved, if any.
      hazardKey: null,
      hazardAt: 0,
      hintShown: false,
      // When the next hazard may fire. Set from the moment the previous one
      // was RESOLVED, never from when it fired — a student who takes a while
      // to solve one must not be met with the next one immediately.
      nextHazardAt: now + TIMING.firstEventDelayMs,
      recent: [],
      gateReached: false,
      pressAt: {},
    };
  }

  function levelForXp(totalXp) {
    var safe = Math.max(0, Math.floor(Number(totalXp) || 0));
    return Math.min(MAX_LEVEL, Math.floor(safe / XP_PER_LEVEL) + 1);
  }

  function isTrial() {
    return !!(window.PMCheat && window.PMCheat.isActive() && window.PMCheat.getMode() === "trial");
  }

  /**
   * Apply one batch of earnings and persist trial state in a single write.
   *
   * Batched on purpose: level-up Seeds depend on the XP in the same batch, and
   * writing XP and Seeds separately would emit two change events and make the
   * bond card animate twice for one act.
   */
  function commit(state, trial, xpGain, seedGain, reason) {
    var beforeXp = Math.max(0, Math.floor(Number(state.status.totalXp) || 0));
    var beforeLevel = levelForXp(beforeXp);
    var afterXp = Math.max(0, beforeXp + Math.max(0, Math.round(xpGain || 0)));
    var afterLevel = levelForXp(afterXp);
    var seeds = Math.max(0, Math.floor(Number(state.status.seeds) || 0)) + Math.max(0, Math.round(seedGain || 0));
    // Every level crossed pays, so a single big award cannot swallow a reward.
    if (afterLevel > beforeLevel) seeds += SEEDS.levelUp * (afterLevel - beforeLevel);

    // The level is DERIVED here, never edited. In cheat mode a presenter may
    // hold level and XP apart on purpose; in trial mode that would be a bug —
    // the bar and the badge must tell one story.
    window.PMCheat.set({
      status: { totalXp: afterXp, level: afterLevel, seeds: seeds },
      trial: trial,
    });

    if (xpGain > 0 && reason) say(EV.reward, { xp: Math.round(xpGain), reason: reason, totalXp: afterXp });

    if (!trial.gateReached && afterXp >= GATE_XP) {
      trial.gateReached = true;
      window.PMCheat.set({ trial: trial });
      say(EV.gate, { level: GATE_LEVEL, text: (COPY[detectLocale()] || COPY.en).gate });
    }
    return { level: afterLevel, totalXp: afterXp };
  }

  /** Advance the in-game calendar and announce it. Days are otherwise a
   *  silent number in the corner, which no one notices — the announcement IS
   *  the feature (implementation.md §4.3). */
  function advanceDays(state, trial, days, seedGain) {
    var t = COPY[detectLocale()] || COPY.en;
    var next = Math.max(0, Math.floor(Number(state.status.days) || 0)) + days;
    state.status.days = next;
    window.PMCheat.set({ status: { days: next } });
    say(EV.day, {
      days: next,
      skipped: days > 1 ? days : 0,
      text: days > 1 ? t.daySkip(next, days) : t.day(next),
      holdMs: TIMING.noticeHoldMs,
      reason: t.reasonDay,
      seeds: seedGain,
    });
  }

  // ── Care action → XP, calendar ──────────────────────────────────────────

  function onPress(e) {
    if (!isTrial()) return;
    var detail = e && e.detail;
    if (!detail || !detail.before || !detail.after) return;
    var state = window.PMCheat.getState();
    if (!state) return;
    var trial = state.trial || defaultTrial(Date.now());
    var now = Date.now();

    // One spam guard for the whole press: a press inside the cooldown pays no
    // XP AND does not turn the calendar. Letting it still advance the day
    // would make the soil action, which skips three at a time, a tap-to-win.
    var last = Number(trial.pressAt[detail.id] || 0);
    if (now - last < TIMING.actionCooldownMs) {
      trial.pressAt[detail.id] = now;
      window.PMCheat.set({ trial: trial });
      return;
    }
    trial.pressAt[detail.id] = now;

    var bands = window.PMCheat.getBands();
    var xp = helped(detail, bands) ? XP.validAction : XP.invalidAction;
    var t = COPY[detectLocale()] || COPY.en;

    // Soil work skips whole days instead of counting as one action: sprinkling
    // ash or mixing fresh soil takes days to register in a real pot, which the
    // button's own "⏳ days later" badge already promises.
    var dayGain = 0;
    if (detail.slow) {
      dayGain = SOIL_SKIP_DAYS;
    } else {
      trial.actionCount += 1;
      if (trial.actionCount >= ACTIONS_PER_DAY) {
        trial.actionCount = 0;
        dayGain = 1;
      }
    }

    var seedGain = dayGain * SEEDS.dayAdvanced;
    commit(state, trial, xp, seedGain, t.reasonAction);
    if (dayGain > 0) advanceDays(state, trial, dayGain, seedGain);
  }

  // ── Tick: drip, hazard firing, hazard resolution ────────────────────────

  var ticker = null;

  function tick() {
    if (!isTrial()) { stopTicking(); return; }
    var state = window.PMCheat.getState();
    if (!state) { stopTicking(); return; }
    var trial = state.trial || defaultTrial(Date.now());
    var bands = window.PMCheat.getBands();
    var now = Date.now();
    var dt = Math.min(MAX_STEP_MS, Math.max(0, now - (runtime.lastTickAt || now)));
    runtime.lastTickAt = now;

    var mood = moodFor(state.vitals, bands);
    var t = COPY[detectLocale()] || COPY.en;

    if (trial.hazardKey) {
      if (mood === "Happy") {
        // Solved. The gap to the next hazard starts counting HERE.
        var solved = hazardByKey(trial.hazardKey);
        trial.hazardKey = null;
        trial.hintShown = false;
        trial.nextHazardAt = now + nextGap();
        runtime.dripAccumMs = 0;
        commit(state, trial, XP.eventResolved, SEEDS.eventResolved, t.reasonHazard);
        say(EV.resolved, {
          key: solved ? solved.key : null,
          text: t.resolved,
          holdMs: TIMING.noticeHoldMs,
          xp: XP.eventResolved,
          seeds: SEEDS.eventResolved,
        });
        return;
      }
      if (!trial.hintShown && now - Number(trial.hazardAt || now) >= TIMING.hintAfterMs) {
        trial.hintShown = true;
        var stuck = hazardByKey(trial.hazardKey);
        window.PMCheat.set({ trial: trial });
        say(EV.hint, {
          key: trial.hazardKey,
          actions: stuck ? stuck.hint : [],
          lead: t.hintLead,
          holdMs: TIMING.noticeHoldMs,
        });
        return;
      }
      // Nothing happened this tick. Deliberately NOT persisted: a write here
      // would emit a change event twice a second, repainting the whole home
      // (and stepping on the speech bubble a notice is holding) to save a
      // counter no one is reading.
      return;
    }

    // No hazard running: pay the Happy drip, and consider firing the next one.
    if (mood === "Happy") {
      runtime.dripAccumMs += dt;
      var payouts = 0;
      while (runtime.dripAccumMs >= TIMING.dripIntervalMs) {
        runtime.dripAccumMs -= TIMING.dripIntervalMs;
        payouts += 1;
      }
      // Only a payout is worth a write (see the hazard branch above for why).
      if (payouts > 0) commit(state, trial, payouts * XP.dripPerTick, 0, t.reasonDrip);

      // Hazards only ever interrupt a healthy plant, so problems never stack —
      // and a student who put the pot in the sun themselves is left to work
      // that out without a second crisis landing on top.
      if (Number(trial.nextHazardAt || 0) > 0 && now >= Number(trial.nextHazardAt)) {
        fireHazard(state, trial, now);
      }
      return;
    }

    // Unhappy but no hazard: the student did this themselves. No drip, no new
    // hazard, no scolding — just wait for them to put it right.
    runtime.dripAccumMs = 0;
  }

  function fireHazard(state, trial, now) {
    var hazard = chooseHazard(trial.recent);
    var bands = window.PMCheat.getBands();
    var forced = hazard.vitals(bands);
    var vitals = {};
    Object.keys(forced).forEach(function (axis) {
      vitals[axis] = window.PMCheat.fitVital(axis, forced[axis]);
    });

    trial.hazardKey = hazard.key;
    trial.hazardAt = now;
    trial.hintShown = false;
    trial.nextHazardAt = 0;
    runtime.dripAccumMs = 0;
    trial.recent = (trial.recent || []).concat([hazard.key]).slice(-2);

    // Releasing every held toggle is what makes a hazard a real problem. Left
    // holding, the shade the student used on the LAST heatwave would quietly
    // undo this one on the drift tick and the crisis would solve itself.
    window.PMCheat.set({
      vitals: vitals,
      actions: { place: null, cover: null, vent: null, lamp: null },
      trial: trial,
    });

    var locale = detectLocale();
    say(EV.hazard, {
      key: hazard.key,
      emoji: hazard.emoji,
      mood: hazard.mood,
      text: hazard.emoji + " " + (locale === "en" ? hazard.en : hazard.id),
      holdMs: TIMING.noticeHoldMs,
    });
  }

  function startTicking() {
    if (ticker !== null || typeof window === "undefined") return;
    // Start the clock HERE, not at 1970, so the first step is one interval
    // rather than the whole epoch (cheat.js's tick has the same guard).
    runtime.lastTickAt = Date.now();
    ticker = window.setInterval(tick, TICK_MS);
  }

  function stopTicking() {
    if (ticker === null) return;
    window.clearInterval(ticker);
    ticker = null;
  }

  /** Seed the trial state on first run and keep the clock in step with the
   *  mode. Called at boot and on every sandbox change, so entering or leaving
   *  trial mode from any page starts and stops the game correctly. */
  function sync() {
    if (!isTrial()) { stopTicking(); return; }
    var state = window.PMCheat.getState();
    if (!state) { stopTicking(); return; }
    if (!state.trial) {
      // Fresh run, or a page loaded mid-run before this script existed. The
      // clock restarts here rather than resuming a stale one: a tab reopened
      // ten minutes later must not pay ten minutes of drip.
      window.PMCheat.set({ trial: defaultTrial(Date.now()) });
    }
    startTicking();
  }

  // ── Public surface ──────────────────────────────────────────────────────
  // Small on purpose: live.js only needs to read the gate for its banner and
  // panel copy, and the settings page needs to start a run.
  window.PMTrial = {
    GATE_LEVEL: GATE_LEVEL,
    GATE_XP: GATE_XP,
    EVENTS: EV,
    isActive: isTrial,
    /** XP still owed before cheat mode unlocks; 0 once it has. */
    xpToGate: function () {
      if (!window.PMCheat || !window.PMCheat.isActive()) return GATE_XP;
      return Math.max(0, GATE_XP - (Number(window.PMCheat.get("status.totalXp", 0)) || 0));
    },
    /** Begin a run: empty progress, no items, nothing discovered. */
    start: function () {
      if (!window.PMCheat) return;
      window.PMCheat.activate({ status: { level: 1, totalXp: 0, days: 0, seeds: 0 } }, "trial");
      window.PMCheat.set({ trial: defaultTrial(Date.now()) });
      startTicking();
    },
    /** Hand the wheel to the presenter, keeping everything earned. */
    switchToCheat: function () {
      if (!window.PMCheat) return;
      stopTicking();
      window.PMCheat.switchToCheat();
    },
    /** Exposed for tests and for live.js's mood-driven copy. */
    moodFor: moodFor,
    HAZARDS: HAZARDS,
  };

  if (typeof window !== "undefined") {
    if (window.PMCheat && typeof window.PMCheat.onChange === "function") {
      window.PMCheat.onChange(sync);
    }
    window.addEventListener("pmcheat:press", onPress);
    if (typeof document !== "undefined" && document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", sync);
    } else {
      sync();
    }
  }
})();
