// Jamkachu sprite driver (kiki design integration, 2026-08-11).
//
// The team designer's pixel packs in public/farm/assets/jamkachu/ ARE the
// one true Jamkachu: this module maps live game state (companion stage,
// plant mood, bond level, cosmetic skin, equipped shop pot, night sleep)
// onto the drawn sprite frames and writes #jamkachu-sprite / the
// #mood-status-chip. Pure presentation — zero network truth, zero writes,
// no gameplay logic. live.js feeds state in via window.PMSprite.set({...});
// every hook there no-ops safely when this script is absent.
//
// Mapping tables are decided in docs/superpowers/plans/
// 2026-08-11-kiki-design-integration.md and mirrored for the React layer in
// src/lib/jamkachu-sprite.ts (parity-tested like companion-ladder) — do not
// redesign them here.
//
// Classic script (not a module), no dependencies on live.js.

(function () {
  "use strict";

  var ASSET_BASE = "/farm/assets/jamkachu/4x/"; // 4x source everywhere; CSS pixelates
  var MOOD_BADGE_BASE = "/farm/assets/moods/4x/"; // designer mood badge icons

  /** Stage→phase: the pack draws 4 growth phases; 10 stages bucket into them. */
  var STAGE_PHASE = {
    Seed: 1,
    Sprout: 2,
    Seedling: 2,
    Bud: 3,
    Bloom: 3,
    Fruit: 4,
    Guardian: 4,
    Elder: 4,
    Radiant: 4,
    Legend: 4,
  };

  /** Filename fragment per phase (plant-p3-flower-….png). */
  var PHASE_SLUG = { 1: "seed", 2: "sprout", 3: "flower", 4: "fruit" };

  /** The 5 expressions the designer drew per phase. */
  // "unwell" is ours, not the designer's: their thirsty frown wearing their
  // sleepy lids (scripts/build-unwell-face.mjs). The thirsty face's big dark
  // ovals read as sullen at mascot size, and four moods had to wear it.
  // Replace these files if the designer draws a proper one.
  var SPRITE_MOODS = ["happy", "plain", "thirsty", "sleepy", "overheat", "unwell"];

  /** Mood→sprite. Four moods share the calm "plain" body and stay
   *  distinguishable via the status chip below plus the #char-mood text
   *  (the accessible signal — all 8 moods must stay distinguishable). */
  // The pack draws FOUR faces — happy, thirsty, sleepy, overheat. The fifth
  // file, "plain", is the designer's faceless decorative body (their
  // sheet-plain.png), NOT a neutral expression: it has leaf veins where the
  // face goes. Never map a mood onto it — a plant that is cold or off-pH
  // must still have a face. The moods that share the frowning "thirsty"
  // body are told apart by the status badge beside the head and by the
  // mood text, never by the body alone.
  var MOOD_SPRITE = {
    Happy: "happy",
    Overheating: "overheat",
    TooCold: "sleepy", // cold plants hunker down; the 🥶 badge names it
    DryAir: "unwell",
    HumidAir: "unwell",
    Sleepy: "sleepy",
    SoilAcidic: "unwell",
    SoilAlkaline: "unwell",
  };

  /** Emoji chip floated near the sprite head for the plain-mapped moods
   *  (aria-hidden in the markup; presentation only). */
  // Emoji fallback kept for hosts that cannot load the badge art.
  var MOOD_STATUS_CHIP = {
    TooCold: "🥶",
    Sleepy: "🌙",
    DryAir: "🌬️",
    HumidAir: "💦",
    SoilAcidic: "🧪",
    SoilAlkaline: "🧪",
  };
  // The designer's mood badges (assets/moods) draw these four conditions
  // apart properly — the two soil moods finally differ (red-down tube vs
  // purple-up tube) instead of sharing one test-tube emoji.
  var MOOD_CHIP_ART = {
    TooCold: "mood-11-too-cold",
    Sleepy: "mood-04-sleepy",
    DryAir: "mood-03-dry-air",
    HumidAir: "mood-09-too-wet",
    SoilAcidic: "mood-05-soil-acidic",
    SoilAlkaline: "mood-06-soil-alkaline",
  };

  /** Bond→tier thresholds — the `from` levels of the two bands that add an
   *  ornament (bands 4 and 6). LEVEL_BANDS below is the real table. */
  var TIER_THRESHOLDS = { bow: 9, ribbon: 24 };

  /** Clamp by phase: p1/p2 always bare, p3 caps at bow, p4 uncapped. */
  var PHASE_TIER_CAP = { 1: "", 2: "", 3: "bow", 4: "ribbon" };
  var TIER_RANK = { "": 0, bow: 1, ribbon: 2 };

  // Level bands — mirror of src/game/progression/level-bands.ts. My Garden is
  // a static page that never runs React, so it cannot import that module and
  // carries its own copy; tests/level-bands.test.ts pins the two together.
  //
  // Bond level alone decides how grown Jamkachu looks. The companion ladder
  // still runs and still shows its own STAGE n/10 line — it just no longer
  // drives the body, so there is one visible ladder instead of two that can
  // disagree in front of a class.
  var MAX_BOND_LEVEL = 30;
  var LEVEL_BANDS = [
    { band: 1, from: 1, phase: 1, tier: "" },
    { band: 2, from: 3, phase: 2, tier: "" },
    { band: 3, from: 6, phase: 3, tier: "" },
    { band: 4, from: 9, phase: 3, tier: "bow" },
    { band: 5, from: 13, phase: 4, tier: "" },
    { band: 6, from: 18, phase: 4, tier: "bow" },
    { band: 7, from: 24, phase: 4, tier: "ribbon" },
  ];

  function bandForLevel(level) {
    var safe = typeof level === "number" && isFinite(level) ? Math.floor(level) : 1;
    var clamped = Math.min(MAX_BOND_LEVEL, Math.max(1, safe));
    var found = LEVEL_BANDS[0];
    for (var i = 0; i < LEVEL_BANDS.length; i++) {
      if (clamped >= LEVEL_BANDS[i].from) found = LEVEL_BANDS[i];
    }
    return found;
  }

  // ── Designer pot ramp ───────────────────────────────────────────────────
  // Sampled from the committed PNGs (2026-08-11): the pot art is IDENTICAL
  // across all 35 sprites — rows 40–60 of the 64px grid, six exact fills.
  // The palette swap below recolors ONLY these hexes, ONLY inside the pot
  // rows, so leaves/face/outlines can never be touched by a skin.
  var POT_RAMP = {
    body: "#B08968", // pot body
    shade: "#926C4E", // pot body shade (right/bottom)
    rim: "#DEBA60", // rim base band
    rimLight: "#F5D67B", // rim light band
    rimHi: "#FCECB0", // rim top highlight
    glint: "#FAD060", // small gold glint at the rim/body seam
  };
  /** Pot pixels live below this row of the 64px grid (row 40 of 64). */
  var POT_TOP_FRACTION = 40 / 64;

  // ── Skin ramps (milestone20 cosmetics — display-only) ───────────────────
  // Same hex values the retired .skin-<key> CSS pot-token blocks carried
  // (style.css history / the companion-skins.js catalog accents): body =
  // catalog accent, rim = 30% white tint, dark = 30% black shade. "jamkachu"
  // is null on purpose: the designer's own pot IS the default look now.
  var SKIN_RAMPS = {
    jamkachu: null,
    edamame: { body: "#9CCB5D", rim: "#BADB8E", dark: "#6D8E41" },
    padi: { body: "#E8C95A", rim: "#EFD98C", dark: "#A28D3F" },
    jagung: { body: "#F5B93F", rim: "#F8CE79", dark: "#AC822C" },
    kopi: { body: "#8A5A3B", rim: "#AD8C76", dark: "#613F29" },
    kakao: { body: "#B0693C", rim: "#C89677", dark: "#7B4A2A" },
    buah_naga: { body: "#E85FA2", rim: "#EF8FBE", dark: "#A24371" },
  };

  // ── Shop pot-item ramps (milestone18 — equipped pot wins over skin) ─────
  // Derived from each retired shop-g-pot_* SVG group's literal hex fills
  // (recorded from index.html before deletion): body/rim verbatim; dark from
  // the group's shade hex where it had one, else a 30% black shade of body.
  // Pattern accents that can't survive a flat recolor are noted per item.
  var POT_ITEM_RAMPS = {
    pot_terracotta: { body: "#C86B4A", rim: "#E08B5F", dark: "#9A4E33" },
    pot_batik: { body: "#5B4632", rim: "#8A6B48" }, // squares #E8D5A9/#B8862F retired
    pot_tincan: { body: "#B9C2C9", rim: "#D7DDE2", dark: "#8E979E" }, // highlight #F2F6F8 retired
    pot_coffee_sack: { body: "#A98055", rim: "#C59B68" },
    pot_bamboo: { body: "#C9A84E", rim: "#E1C56A", dark: "#7E8637" },
    pot_jember_mosaic: { body: "#3C8C75", rim: "#56A9B8" }, // zigzag #F1D36B retired
  };

  // ── Color helpers ───────────────────────────────────────────────────────

  function hexToRgb(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixHex(hex, targetHex, amount) {
    var a = hexToRgb(hex);
    var b = hexToRgb(targetHex);
    var out = [0, 0, 0];
    for (var i = 0; i < 3; i++) out[i] = Math.round(a[i] + (b[i] - a[i]) * amount);
    return out;
  }

  /** Build the designer-hex → replacement-RGB map for one target ramp.
   *  The six designer fills collapse onto {body, rim, dark} + fixed tints,
   *  matching the light/shade ratios the designer's own pot uses. */
  function buildSwapMap(ramp) {
    var dark = ramp.dark || null;
    var map = {};
    map[POT_RAMP.body] = hexToRgb(ramp.body);
    map[POT_RAMP.shade] = dark ? hexToRgb(dark) : mixHex(ramp.body, "#000000", 0.3);
    map[POT_RAMP.rim] = hexToRgb(ramp.rim);
    map[POT_RAMP.rimLight] = mixHex(ramp.rim, "#FFFFFF", 0.35);
    map[POT_RAMP.rimHi] = mixHex(ramp.rim, "#FFFFFF", 0.65);
    map[POT_RAMP.glint] = mixHex(ramp.body, "#FFFFFF", 0.25);
    return map;
  }

  // ── State (merged via PMSprite.set(partial)) ────────────────────────────
  // stage null = companion migration absent → render the full-grown plant,
  // same default the old inline-SVG mascot showed (and the same rule the
  // React mirror's stagePhase uses). flashMood is the tap-reaction override
  // live.js flashes for ~1.2s (a SPRITE mood, not a PlantMood).
  var state = {
    mood: "Happy",
    stage: null,
    bondLevel: 1,
    skinKey: "jamkachu",
    potItemKey: null,
    sleeping: false,
    flashMood: null,
  };

  function stagePhase(stage) {
    return STAGE_PHASE[stage] || 4;
  }

  /** Night sleep (sleepShown) forces the sleepy body; unknown moods render
   *  the calm plain body rather than a wrong celebration. */
  function spriteMoodFor() {
    if (state.sleeping) return "sleepy";
    return MOOD_SPRITE[state.mood] || "plain";
  }

  /** Accessory earned by bond level, clamped to what the phase can wear. */
  function accessoryTier(bondLevel, phase) {
    var level = typeof bondLevel === "number" && isFinite(bondLevel) ? bondLevel : 0;
    var earned = level >= TIER_THRESHOLDS.ribbon ? "ribbon" : level >= TIER_THRESHOLDS.bow ? "bow" : "";
    var cap = PHASE_TIER_CAP[phase] || "";
    return TIER_RANK[earned] <= TIER_RANK[cap] ? earned : cap;
  }

  function spriteFile(phase, mood, tier) {
    return "plant-p" + phase + "-" + PHASE_SLUG[phase] + "-" + mood + (tier ? "-" + tier : "") + ".png";
  }

  // ── Palette swap (canvas) ───────────────────────────────────────────────
  // Constrained to the pot rows AND exact designer-ramp hexes. Cached per
  // (src, ramp) as blob URLs. ANY failure resolves null and the caller keeps
  // the plain un-swapped sprite — never a blank mascot.

  var swapCache = {}; // key → blob URL (string) | Promise | null (known-failed)

  function swappedUrl(src, rampKey, ramp) {
    var key = src + "|" + rampKey;
    var cached = swapCache[key];
    if (cached !== undefined) return typeof cached === "string" ? Promise.resolve(cached) : cached || Promise.resolve(null);
    var promise = new Promise(function (resolve) {
      try {
        var image = new Image();
        image.decoding = "async";
        image.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            var ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.drawImage(image, 0, 0);
            var potTop = Math.floor(canvas.height * POT_TOP_FRACTION);
            var frame = ctx.getImageData(0, potTop, canvas.width, canvas.height - potTop);
            var data = frame.data;
            var map = buildSwapMap(ramp);
            var lut = {}; // packed 24-bit int → [r,g,b]
            for (var hex in map) {
              var rgb = hexToRgb(hex);
              lut[(rgb[0] << 16) | (rgb[1] << 8) | rgb[2]] = map[hex];
            }
            for (var i = 0; i < data.length; i += 4) {
              if (data[i + 3] === 0) continue;
              var repl = lut[(data[i] << 16) | (data[i + 1] << 8) | data[i + 2]];
              if (!repl) continue; // exact ramp hexes only
              data[i] = repl[0];
              data[i + 1] = repl[1];
              data[i + 2] = repl[2];
            }
            ctx.putImageData(frame, 0, potTop);
            canvas.toBlob(function (blob) {
              if (!blob) return resolve(null);
              var url = URL.createObjectURL(blob);
              swapCache[key] = url;
              resolve(url);
            }, "image/png");
          } catch (_err) {
            resolve(null); // tainted canvas / OOM / anything: plain sprite stays
          }
        };
        image.onerror = function () {
          resolve(null);
        };
        image.src = src;
      } catch (_err) {
        resolve(null);
      }
    }).then(function (url) {
      if (typeof url !== "string") swapCache[key] = null; // don't retry-loop failures
      return url;
    });
    swapCache[key] = promise;
    return promise;
  }

  /** Bond Lv.10 keepsake: the pot itself turns gold. Replaces the old SVG
   *  band laid over the pot — the reward is now the real drawn pot. */
  var GOLDPOT_RAMP = { body: "#D9A63C", shade: "#B0801F", rim: "#F2D268", rimLight: "#FBEBB4", rimHighlight: "#FFF6D8", glint: "#FFE79A" };

  /** Bond level at which the pot turns gold on its own. Mirrored in
   *  src/lib/sprite-palette.ts. */
  var GOLD_POT_LEVEL = 10;

  /** Active pot recolor, most deliberate choice first: the equipped shop pot,
   *  then the Lv.10 gold keepsake, then the cosmetic skin; the designer's own
   *  pot shows when none applies.
   *
   *  The equipped pot used to LOSE to the keepsake, which quietly killed the
   *  whole Pots category the moment a player passed Lv.10 — you spent seeds,
   *  equipped a pot, and nothing changed. The keepsake is now what you wear
   *  when you have chosen nothing: still earned, still automatic, but it no
   *  longer overrides a purchase. Take the pot off and the gold comes back. */
  function activeRamp() {
    if (state.potItemKey && POT_ITEM_RAMPS[state.potItemKey]) {
      return { key: "pot:" + state.potItemKey, ramp: POT_ITEM_RAMPS[state.potItemKey] };
    }
    if (Number(state.bondLevel) >= GOLD_POT_LEVEL) return { key: "decor:goldpot", ramp: GOLDPOT_RAMP };
    if (state.skinKey && SKIN_RAMPS[state.skinKey]) {
      return { key: "skin:" + state.skinKey, ramp: SKIN_RAMPS[state.skinKey] };
    }
    return null;
  }

  // ── Preload: current phase's 5 moods + next phase happy ─────────────────

  var preloadedKeys = {};

  function preload(phase, bondLevel) {
    try {
      var wanted = [];
      // Every mood of the look being worn now, plus the first frame of the
      // NEXT band — a level-up must not flash a missing image, and with 15 XP
      // a level the next band can be one quest away.
      var band = bandForLevel(bondLevel);
      for (var i = 0; i < SPRITE_MOODS.length; i++) wanted.push(spriteFile(band.phase, SPRITE_MOODS[i], band.tier));
      var ahead = null;
      for (var b = 0; b < LEVEL_BANDS.length; b++) {
        if (LEVEL_BANDS[b].band === band.band + 1) ahead = LEVEL_BANDS[b];
      }
      if (ahead) wanted.push(spriteFile(ahead.phase, "happy", ahead.tier));
      for (var k = 0; k < wanted.length; k++) {
        var file = wanted[k];
        if (preloadedKeys[file]) continue;
        preloadedKeys[file] = true;
        var image = new Image();
        image.decoding = "async";
        image.src = ASSET_BASE + file;
      }
    } catch (_err) {
      /* preloading is a hint, never required */
    }
  }

  // ── Repaint ─────────────────────────────────────────────────────────────

  function repaint() {
    if (typeof document === "undefined") return;
    var img = document.getElementById("jamkachu-sprite");
    var band = bandForLevel(state.bondLevel);
    var phase = band.phase;
    var mood =
      state.flashMood && SPRITE_MOODS.indexOf(state.flashMood) >= 0 ? state.flashMood : spriteMoodFor();
    var tier = band.tier;
    var src = ASSET_BASE + spriteFile(phase, mood, tier);
    if (img) {
      // Stamp the drawn phase on the stage div so head-anchored overlay art
      // (shop hats/glasses, Lv.7 ribbon keepsake) can track the head down to
      // the small p1/p2 sprites — style.css owns the per-phase offsets.
      var stageBox = img.parentElement;
      if (stageBox && stageBox.classList) {
        for (var p = 1; p <= 4; p++) stageBox.classList.toggle("sprite-phase-" + p, p === phase);
      }
      var rampSpec = activeRamp();
      var want = rampSpec ? src + "|" + rampSpec.key : src;
      if (img.dataset.pmWant !== want) {
        img.dataset.pmWant = want;
        if (!rampSpec) {
          img.src = src;
        } else {
          var cachedUrl = swapCache[src + "|" + rampSpec.key];
          // Plain sprite paints immediately (never a blank mascot); the
          // recolored frame replaces it as soon as the canvas resolves.
          img.src = typeof cachedUrl === "string" ? cachedUrl : src;
          if (typeof cachedUrl !== "string") {
            swappedUrl(src, rampSpec.key, rampSpec.ramp).then(function (url) {
              var el = document.getElementById("jamkachu-sprite");
              if (url && el && el.dataset.pmWant === want) el.src = url;
            });
          }
        }
      }
    }
    var chipEl = document.getElementById("mood-status-chip");
    if (chipEl) {
      var chipArt = state.sleeping ? "" : MOOD_CHIP_ART[state.mood] || "";
      if (chipEl.dataset.pmChip !== chipArt) {
        chipEl.dataset.pmChip = chipArt;
        chipEl.textContent = "";
        if (chipArt) {
          var chipImg = document.createElement("img");
          chipImg.src = MOOD_BADGE_BASE + chipArt + ".png";
          chipImg.alt = "";
          // Badge art missing (offline mirror, partial deploy) falls back to
          // the emoji so the mood never loses its second signal.
          chipImg.onerror = function () {
            chipEl.textContent = MOOD_STATUS_CHIP[state.mood] || "";
          };
          chipEl.appendChild(chipImg);
        }
      }
    }
    preload(phase, state.bondLevel);
  }

  // ── Public surface ──────────────────────────────────────────────────────

  var PMSprite = {
    /** Merge a partial state patch, then repaint. Unknown keys ignored. */
    set: function (partial) {
      if (!partial || typeof partial !== "object") return PMSprite;
      var changed = false;
      for (var key in state) {
        if (Object.prototype.hasOwnProperty.call(partial, key) && partial[key] !== state[key]) {
          state[key] = partial[key];
          changed = true;
        }
      }
      if (changed) repaint();
      return PMSprite;
    },
    repaint: repaint,
    getState: function () {
      var copy = {};
      for (var key in state) copy[key] = state[key];
      return copy;
    },
    /** Read-only mapping tables (debugging + contract tests). */
    tables: {
      STAGE_PHASE: STAGE_PHASE,
      PHASE_SLUG: PHASE_SLUG,
      SPRITE_MOODS: SPRITE_MOODS,
      MOOD_SPRITE: MOOD_SPRITE,
      MOOD_STATUS_CHIP: MOOD_STATUS_CHIP,
      TIER_THRESHOLDS: TIER_THRESHOLDS,
      PHASE_TIER_CAP: PHASE_TIER_CAP,
      POT_RAMP: POT_RAMP,
      SKIN_RAMPS: SKIN_RAMPS,
      POT_ITEM_RAMPS: POT_ITEM_RAMPS,
    },
    stagePhase: stagePhase,
    accessoryTier: accessoryTier,
  };
  // Uppercase alias for the cross-layer parity suite
  // (tests/jamkachu-sprite-parity.test.ts) — same frozen object.
  PMSprite.TABLES = PMSprite.tables;

  window.PMSprite = PMSprite;

  // First paint: deferred classic scripts run after the parser finishes, so
  // the img exists; a stub environment without a DOM just no-ops.
  repaint();
})();
