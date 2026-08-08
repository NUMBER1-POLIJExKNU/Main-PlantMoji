// PlantMoji live data binding for the team's pixel-farm page.
//
// The page markup/styles (index.html, style.css) are the designer's files,
// used AS-IS — this script only fills the existing elements with real data
// from Supabase (read-only publishable key + RLS) and keeps them fresh via
// Realtime with a polling fallback. No game logic lives here: the browser
// never decides XP or truth (handoff rules) — it only displays.

const PLANT_ID = "plant-01";
const LOCALE_KEY = "plantmoji_locale";

// STATIC farm-page strings, Bahasa Indonesia default with an EN toggle
// (restored dac0528 mechanism). DYNAMIC celebration copy lives in the
// central table `public/farm/strings.js` (window.PM_STRINGS, English this
// pass — Day-3 translation handles it), read defensively via PM() below.
// "JAMKACHU" and "PLANT MOJI" are proper nouns and are never translated.
const COPY = {
  id: {
    "nav.home": "Beranda",
    "nav.quests": "Misi",
    "nav.diary": "Buku Harian",
    "nav.status": "Status Tanaman",
    "nav.collection": "Koleksi",
    "nav.settings": "Pengaturan",
    "weather.outdoor": "Luar ruang Jember",
    "weather.indoor": "Ruang tanaman",
    "weather.loading": "Memuat prakiraan...",
    "weather.unavailable": "Prakiraan belum tersedia",
    "weather.forecast": "Prakiraan",
    "weather.stale": "data terakhir",
    "sensor.unavailable": "Sensor dalam ruang belum terhubung",
    "action.water": "SIRAM",
    "action.fertilize": "PUPUK",
    "quest.none": "Belum ada misi aktif",
    "quest.verifying": "memverifikasi…",
    "mood.Happy": "Senang",
    "mood.Overheating": "Kepanasan",
    "mood.DryAir": "Udara Kering",
    "mood.Sleepy": "Mengantuk",
    "mood.SoilAcidic": "Tanah Asam",
    "mood.SoilAlkaline": "Tanah Basa",
    bright: "Terang",
    dark: "Gelap",
    days: "Hari",
    bond: "Ikatan",
    levelUp: "NAIK LEVEL!",
    carePays: "perawatanmu membuahkan hasil",
    questComplete: "Misi selesai!",
  },
  en: {
    "nav.home": "Home",
    "nav.quests": "Quests",
    "nav.diary": "Growth Diary",
    "nav.status": "Plant Status",
    "nav.collection": "Collection",
    "nav.settings": "Settings",
    "weather.outdoor": "Jember outdoor",
    "weather.indoor": "Plant room",
    "weather.loading": "Loading forecast...",
    "weather.unavailable": "Forecast unavailable",
    "weather.forecast": "Forecast",
    "weather.stale": "last available data",
    "sensor.unavailable": "Indoor sensor not connected",
    "action.water": "WATER",
    "action.fertilize": "FERTILIZE",
    "quest.none": "No active quest",
    "quest.verifying": "verifying…",
    "mood.Happy": "Happy",
    "mood.Overheating": "Overheating",
    "mood.DryAir": "Dry Air",
    "mood.Sleepy": "Sleepy",
    "mood.SoilAcidic": "Acidic",
    "mood.SoilAlkaline": "Alkaline",
    bright: "Bright",
    dark: "Dark",
    days: "Days",
    bond: "Bond",
    levelUp: "LEVEL UP!",
    carePays: "your care is paying off",
    questComplete: "Quest complete!",
  },
};

function initialLocale() {
  const cookie = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${LOCALE_KEY}=`));
  const fromCookie = cookie?.split("=")[1];
  let stored = null;
  try { stored = window.localStorage.getItem(LOCALE_KEY); } catch {}
  return fromCookie === "en" || (!fromCookie && stored === "en") ? "en" : "id";
}

let appLocale = initialLocale();
// Missing keys fall back to English, then to the raw key.
const t = (key) => COPY[appLocale][key] ?? COPY.en[key] ?? key;

/** Central string table (Task 4, authored in strings.js) — always guarded so
 *  a missing/failed script tag can never break the page. */
const PM = () => window.PM_STRINGS || {};

const MOODS = {
  Happy: { bubble: "\"I'm feeling so healthy!<br>Thanks for the care.\"" },
  Overheating: { bubble: "\"It's too hot...<br>please cool me down!\"" },
  DryAir: { bubble: "\"The air feels so dry...<br>a little humidity please?\"" },
  Sleepy: { bubble: "\"So dark... I'm getting sleepy.<br>More light please!\"" },
  SoilAcidic: { bubble: "\"My soil feels sour...<br>can you check the pH?\"" },
  SoilAlkaline: { bubble: "\"My soil feels off...<br>can you check the pH?\"" },
};

// HP is a friendly summary of the plant's CURRENT mood — the only honest
// health signal we have (no invented numbers). Happy = full HP; needs-care
// moods reduce it. Display-only, like everything else in this file.
const HP_BY_MOOD = {
  Happy: 100,
  DryAir: 70,
  Sleepy: 70,
  Overheating: 55,
  SoilAcidic: 55,
  SoilAlkaline: 55,
};

// Display metadata for quest keys (mirrors src/game/quests/quest-definitions.ts).
// targetMin only on 'maintain' quests — drives the "23/30 min" progress in the
// home quest slot (renderQuestSlot); recovery quests show a verifying state.
const QUEST_META = {
  KEEP_ME_HAPPY: { title: "Keep Me Happy", emoji: "🌱", targetMin: 30 },
  STAY_COMFY: { title: "Stay Comfy", emoji: "🛋️", targetMin: 120 },
  COOL_ME_DOWN: { title: "Cool Me Down", emoji: "❄️" },
  GIVE_ME_MORE_LIGHT: { title: "Give Me More Light", emoji: "☀️" },
  HUMIDIFY_MY_AIR: { title: "Humidify My Air", emoji: "💦" },
  BALANCE_SOIL_ACIDIC: { title: "Balance My Soil", emoji: "🧪" },
  BALANCE_SOIL_ALKALINE: { title: "Balance My Soil", emoji: "🧪" },
};

// Mood word + emoji shown under the character name (#char-mood). Words come
// from PM_STRINGS.moods when available; these are the verbatim fallbacks.
const MOOD_WORDS = { Happy: "Happy", Overheating: "Overheating", DryAir: "Dry Air", Sleepy: "Sleepy", SoilAcidic: "Acidic", SoilAlkaline: "Alkaline" };
const MOOD_EMOJI = { Happy: "😊", Overheating: "🥵", DryAir: "😵", Sleepy: "😴", SoilAcidic: "🤢", SoilAlkaline: "😖" };
// Mood state → face-swap class on .mascot-svg ("face-happy" has no CSS rule
// on purpose: with no variant class matched, the default happy group shows).
const MOOD_FACE = { Happy: "face-happy", Overheating: "face-hot", DryAir: "face-dry", Sleepy: "face-sleepy", SoilAcidic: "face-acidic", SoilAlkaline: "face-alkaline" };

/** Swap Jamkachu's face group + identity line (#char-mood) to the given mood.
 *  Same body, same pot — only the expression changes (spec §2.2). */
function setMascotMood(state) {
  const svg = $(".mascot-svg");
  if (svg) {
    for (const cls of Object.values(MOOD_FACE)) svg.classList.remove(cls);
    svg.classList.add(MOOD_FACE[state] ?? "face-happy");
  }
  const moodEl = $("#char-mood");
  if (moodEl) {
    // Mood word goes through the active locale dictionary first; unknown
    // states fall back to the English word (PM_STRINGS, then local table).
    const word = COPY[appLocale][`mood.${state}`] ?? PM().moods?.[state] ?? MOOD_WORDS[state] ?? String(state ?? "");
    const emoji = PM().moodEmoji?.[state] ?? MOOD_EMOJI[state] ?? "😊";
    moodEl.textContent = `${word} ${emoji}`;
  }
}
// DevTools/demo handle (display-only; grants nothing).
window.setMascotMood = setMascotMood;

/** Petting cleanup hook (defined ahead of the petting task so mood renders
 *  can always call it): cancels a pending speech-bubble restore. */
let petRestoreTimer = null;
let petSavedBubble = null;
function cancelPetBubble() {
  if (petRestoreTimer !== null) {
    clearTimeout(petRestoreTimer);
    petRestoreTimer = null;
  }
  petSavedBubble = null;
}

// Cross-render state for speech-bubble request de-duplication.
let lastMoodFetched = null; // mood already sent to /api/mood-message

const $ = (selector) => document.querySelector(selector);

function setText(selector, text) {
  const el = $(selector);
  if (el && text != null) el.textContent = text;
}

/** Repaint every static [data-i18n] string + the switch's pressed state
 *  (restored dac0528 mechanism — runs on load; switching reloads the page
 *  so server pages pick the cookie up too). */
function applyLocale() {
  document.documentElement.lang = appLocale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.locale === appLocale));
  });
}

document.querySelectorAll("[data-locale]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.locale === "en" ? "en" : "id";
    document.cookie = `${LOCALE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    try { window.localStorage.setItem(LOCALE_KEY, next); } catch {}
    window.location.reload();
  });
});
applyLocale();

// ── DEV ADDITION: reward-feedback FX (dopamine-friendly, ethically) ─────
//
// Celebration policy: every effect below fires ONLY on a real state
// transition reported by the backend (sensor-verified quests, award_xp in
// SQL — handoff §17). Nothing here invents rewards or urgency, and the
// first paint after page load NEVER celebrates (prev* state starts null),
// so students get feedback for care — not for merely opening the page.
// Sound: optional 8-bit cues via window.PMSfx (sfx.js — unlocks on first
// gesture, mute persisted in localStorage) — always called with ?. so a
// missing engine is a silent no-op. When Supabase is not configured, main()
// returns before any data render, so every DATA-driven effect stays dormant;
// the user-initiated care interactions (water/fertilize rituals, petting,
// button micro-juice) still respond because they are pure presentation:
// zero writes, zero XP, no hidden counters (spec §4).
//
// Performance: particles are capped (MAX_PARTICLES), always removed from
// the DOM on a timer, and animate transform/opacity only (fixed-position
// elements in a pointer-events:none layer → no layout thrash).
// prefers-reduced-motion: reduce → particle/scale animations are skipped,
// plain text toasts/banners remain (opacity-only fades).

// Previous-state trackers — null means "not rendered yet" (first-render
// suppression: record silently, celebrate only from the second render on).
let prevXp = null;
let prevLevel = null;
let prevStreak = null;
let prevMoodFx = null;
const questStatuses = new Map(); // quest id → last seen status
let questsPrimed = false; // first quest snapshot recorded without celebrating

const MAX_PARTICLES = 120;
let liveParticles = 0;

const FX_CSS = `
.fx-layer { position: fixed; inset: 0; pointer-events: none; z-index: 999; overflow: hidden; }
.fx-confetti, .fx-sparkle, .fx-droplet, .fx-heart { position: fixed; image-rendering: pixelated; will-change: transform, opacity; }
.fx-droplet { background: var(--color-water, #4DA1ED); }
.fx-heart { background: var(--color-cheek, #FF9E9E); clip-path: polygon(50% 100%, 0 40%, 0 15%, 25% 0, 50% 20%, 75% 0, 100% 15%, 100% 40%); }
.fx-why-card { position: fixed; max-width: 320px; font-family: var(--font-body, sans-serif); font-size: 13px; line-height: 1.5; color: var(--color-text, #243421); background: var(--color-surface, #fff); border: 3px solid var(--color-border, #BCD3B4); border-radius: 12px; box-shadow: 0 4px 0 rgba(36,52,33,.15); padding: 10px 14px; text-align: center; will-change: transform, opacity; }
.fx-chip { position: fixed; font-family: var(--font-heading, monospace); font-size: 12px; color: #fff; background: var(--color-grass, #69C455); border: 2px solid var(--color-outline, #2B3A27); box-shadow: 0 3px 0 var(--color-outline, #2B3A27); border-radius: 10px; padding: 5px 10px; white-space: nowrap; will-change: transform, opacity; }
.fx-chip-streak { background: #FF9C4B; }
.fx-banner-stack { position: fixed; top: 96px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; z-index: 1000; }
.fx-banner { font-family: var(--font-heading, monospace); background: var(--color-white, #fff); color: var(--color-outline, #2B3A27); border: 3px solid var(--color-outline, #2B3A27); border-radius: 14px; box-shadow: 0 5px 0 var(--color-outline, #2B3A27); padding: 14px 22px; text-align: center; will-change: transform, opacity; }
.fx-banner-title { font-size: 13px; color: var(--color-forest, #397A2B); margin-bottom: 8px; }
.fx-banner-detail { font-size: 11px; }
.fx-xp { color: var(--color-forest, #397A2B); }
.fx-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1001; }
.fx-hold-dim { position: fixed; inset: 0; background: rgba(36, 52, 33, 0.1); opacity: 0; }
.fx-orb { position: fixed; width: 10px; height: 10px; background: var(--color-grass, #69C455); image-rendering: pixelated; will-change: transform, opacity; }
.fx-orb-gold { background: var(--color-yellow, #FFDE6A); box-shadow: 0 0 6px rgba(255, 222, 106, 0.85); }
.fx-lucky-stamp { font-family: var(--font-heading, monospace); font-size: 26px; color: #7A5B12; background: linear-gradient(180deg, #FFE98A, #FFC93C); border: 4px solid #A97B12; border-radius: 12px; box-shadow: 0 6px 0 #A97B12; padding: 18px 30px; text-shadow: 2px 2px 0 #FFF7DF; white-space: nowrap; will-change: transform, opacity; }
.fx-levelup-card { font-family: var(--font-heading, monospace); background: var(--color-white, #fff); border: 4px solid var(--color-outline, #2B3A27); border-radius: 18px; box-shadow: 0 8px 0 var(--color-outline, #2B3A27); padding: 32px 48px; text-align: center; will-change: transform, opacity; }
.fx-levelup-title { font-size: 26px; color: var(--color-forest, #397A2B); text-shadow: 3px 3px 0 var(--color-yellow, #FFDE6A); }
.fx-levelup-sub { font-size: 12px; margin-top: 14px; color: var(--color-outline, #2B3A27); }
`;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ── Celebration queue (Task 6) ──────────────────────────────────────────
// Serializes stacked celebrations (quest + lucky + level-up) so FX never
// overlap or block information. Items play strictly in enqueue order, except
// that a higher tier arriving while items are still WAITING jumps ahead of
// lower-tier items that have not started. Per-item duration is capped per
// tier; when the pending backlog would exceed 6s, T1/T2 XP chips collapse
// into one merged chip (amounts added — nothing is ever lost, only merged).

const FX_TIER_CAP = { 1: 300, 2: 1200, 3: 2600, 4: 3500, 5: 8000 };
const FX_BACKLOG_CAP_MS = 6000;
const fxQueue = [];
let fxPlaying = false;

function fxEnqueue(tier, runFn, durationMs, meta) {
  const cap = FX_TIER_CAP[tier] ?? 2600;
  // Explicit durations above the tier cap are only honored for interactive
  // items that resolve early via done() (e.g. the reward pod's 8s window).
  const duration = Number.isFinite(durationMs) ? durationMs : cap;
  const item = { tier, runFn, duration, meta: meta ?? null };
  const backlogMs = fxQueue.reduce((sum, queued) => sum + queued.duration, 0);
  if (backlogMs + duration > FX_BACKLOG_CAP_MS && tier <= 2 && item.meta?.kind === "xp") {
    const mergeable = fxQueue.find((queued) => queued.meta?.kind === "xp");
    if (mergeable) {
      mergeable.meta.amount += item.meta.amount;
      return;
    }
  }
  let index = fxQueue.length;
  while (index > 0 && fxQueue[index - 1].tier < tier) index--;
  fxQueue.splice(index, 0, item);
  fxPump();
}

function fxPump() {
  if (fxPlaying) return;
  const item = fxQueue.shift();
  if (!item) return;
  fxPlaying = true;
  let advanced = false;
  const done = () => {
    if (advanced) return;
    advanced = true;
    clearTimeout(capTimer);
    fxPlaying = false;
    fxPump();
  };
  // Force-advance at the duration cap so a stuck/ignored item never blocks
  // the queue; runFn may call done() earlier (e.g. pod claimed by tap).
  const capTimer = setTimeout(done, item.duration);
  try {
    item.runFn(done, item.meta);
  } catch {
    done();
  }
}

// ── End celebration queue ───────────────────────────────────────────────

let fxLayer = null;
let fxBannerStack = null;

/** Lazily inject the FX style block + overlay layer (only once, and only
 *  ever reached from real-data renders — dormant on the static demo). */
function ensureFxLayer() {
  if (!document.body) return null;
  if (fxLayer && fxLayer.isConnected) return fxLayer;
  if (!document.getElementById("fx-style")) {
    const style = document.createElement("style");
    style.id = "fx-style";
    style.textContent = FX_CSS;
    document.head.appendChild(style);
  }
  fxLayer = document.createElement("div");
  fxLayer.className = "fx-layer";
  fxBannerStack = document.createElement("div");
  fxBannerStack.className = "fx-banner-stack";
  fxBannerStack.setAttribute("role", "status");
  fxBannerStack.setAttribute("aria-live", "polite");
  fxLayer.appendChild(fxBannerStack);
  document.body.appendChild(fxLayer);
  return fxLayer;
}

// Design palette read from the teammate's CSS variables (style.css :root),
// with the same hex values as fallbacks so a missing var never breaks FX.
let fxPalette = null;

function getPalette() {
  if (fxPalette) return fxPalette;
  let read = (name, fallback) => fallback;
  try {
    const cs = getComputedStyle(document.documentElement);
    read = (name, fallback) => (cs.getPropertyValue(name) || "").trim() || fallback;
  } catch {
    // keep fallbacks
  }
  const grass = read("--color-grass", "#69C455");
  const grassLight = read("--color-grass-light", "#89D974");
  const yellow = read("--color-yellow", "#FFDE6A");
  const cheek = read("--color-cheek", "#FF9E9E");
  const water = read("--color-water", "#4DA1ED");
  fxPalette = {
    confetti: [grass, grassLight, yellow, cheek, water],
    sparkle: [yellow, "#FFFFFF", grassLight],
  };
  return fxPalette;
}

function animateSafe(el, keyframes, options) {
  if (typeof el.animate !== "function") return null;
  try {
    return el.animate(keyframes, options);
  } catch {
    return null;
  }
}

/** Single source of removal for every FX element (safe to call on an
 *  already-removed node). Particles also release their budget slot. */
function removeLater(el, ms, isParticle = false) {
  setTimeout(() => {
    el.remove();
    if (isParticle) liveParticles = Math.max(0, liveParticles - 1);
  }, ms);
}

/** Pixel-square confetti burst at viewport point (x, y). Square particles +
 *  stepped easing keep the retro pixel-art feel. Skipped under
 *  prefers-reduced-motion. Optional `palette` overrides the default colors
 *  (the lucky stamp bursts gold, Task 14). */
function spawnConfetti(x, y, count, palette) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const colors = Array.isArray(palette) && palette.length > 0 ? palette : getPalette().confetti;
  const n = Math.max(0, Math.min(count, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "fx-confetti";
    p.setAttribute("aria-hidden", "true");
    const size = 6 + Math.floor(Math.random() * 5);
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = colors[i % colors.length];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    layer.appendChild(p);
    liveParticles++;
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist * 0.6 - (40 + Math.random() * 60);
    const fall = 120 + Math.random() * 160;
    const rot = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 270);
    const duration = 700 + Math.random() * 500;
    animateSafe(
      p,
      [
        { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${dy}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy + fall}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration, easing: `steps(${6 + Math.floor(Math.random() * 5)}, end)`, fill: "forwards" },
    );
    removeLater(p, duration + 100, true);
  }
}

/** Tiny twinkling squares scattered over a rect (mood-recovery sparkle). */
function spawnSparkles(rect, count) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const colors = getPalette().sparkle;
  const n = Math.max(0, Math.min(count, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "fx-sparkle";
    s.setAttribute("aria-hidden", "true");
    const size = 4 + Math.floor(Math.random() * 4);
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.background = colors[i % colors.length];
    s.style.left = `${rect.left + Math.random() * rect.width}px`;
    s.style.top = `${rect.top + Math.random() * rect.height * 0.8}px`;
    layer.appendChild(s);
    liveParticles++;
    const duration = 600 + Math.random() * 400;
    const delay = Math.random() * 300;
    animateSafe(
      s,
      [
        { transform: "scale(0)", opacity: 0 },
        { transform: "scale(1)", opacity: 1, offset: 0.5 },
        { transform: "scale(0) translateY(-10px)", opacity: 0 },
      ],
      { duration, delay, easing: "steps(4, end)", fill: "both" },
    );
    removeLater(s, duration + delay + 100, true);
  }
}

/** Floating text chip (e.g. "+20 XP", "+1 day") rising from an anchor rect.
 *  Under reduced motion it still appears (plain text toast) but only fades. */
function floatChip(text, rect, variant) {
  const layer = ensureFxLayer();
  if (!layer) return;
  const chip = document.createElement("div");
  chip.className = variant ? `fx-chip ${variant}` : "fx-chip";
  chip.setAttribute("aria-hidden", "true"); // duplicates on-screen numbers
  chip.textContent = text;
  chip.style.left = `${rect.left + rect.width / 2}px`;
  chip.style.top = `${rect.top}px`;
  chip.style.transform = "translate(-50%, -100%)";
  layer.appendChild(chip);
  const reduce = prefersReducedMotion();
  animateSafe(
    chip,
    reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, offset: 0.75 },
          { opacity: 0 },
        ]
      : [
          { transform: "translate(-50%, -100%) translateY(6px)", opacity: 0 },
          { transform: "translate(-50%, -100%) translateY(-6px)", opacity: 1, offset: 0.25 },
          { transform: "translate(-50%, -100%) translateY(-30px)", opacity: 0 },
        ],
    { duration: 1200, easing: reduce ? "linear" : "steps(10, end)", fill: "forwards" },
  );
  removeLater(chip, 1300);
}

/** Blue pixel droplets raining over a rect (water ritual; reused by causal
 *  echo). Same budget + reduced-motion rules as every other particle. */
function spawnDroplets(rect, count) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const n = Math.max(0, Math.min(count, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div");
    d.className = "fx-droplet";
    d.setAttribute("aria-hidden", "true");
    const size = 5 + Math.floor(Math.random() * 4);
    d.style.width = `${size}px`;
    d.style.height = `${size + 2}px`;
    d.style.left = `${rect.left + Math.random() * rect.width}px`;
    d.style.top = `${rect.top - 10 - Math.random() * 30}px`;
    layer.appendChild(d);
    liveParticles++;
    const fall = rect.height * (0.5 + Math.random() * 0.5) + 30;
    const duration = 500 + Math.random() * 300;
    const delay = Math.random() * 200;
    animateSafe(
      d,
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${fall * 0.8}px)`, opacity: 1, offset: 0.8 },
        { transform: `translateY(${fall}px)`, opacity: 0 },
      ],
      { duration, delay, easing: "steps(6, end)", fill: "both" },
    );
    removeLater(d, duration + delay + 100, true);
  }
}

/** Single pixel heart rising from the mascot (petting). */
function spawnHeart(rect) {
  if (prefersReducedMotion() || !rect) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  if (liveParticles >= MAX_PARTICLES) return;
  const heart = document.createElement("div");
  heart.className = "fx-heart";
  heart.setAttribute("aria-hidden", "true");
  const size = 12 + Math.floor(Math.random() * 6);
  heart.style.width = `${size}px`;
  heart.style.height = `${size}px`;
  heart.style.left = `${rect.left + rect.width * (0.3 + Math.random() * 0.4)}px`;
  heart.style.top = `${rect.top + rect.height * 0.25}px`;
  layer.appendChild(heart);
  liveParticles++;
  animateSafe(
    heart,
    [
      { transform: "translateY(0) scale(0.6)", opacity: 0 },
      { transform: "translateY(-14px) scale(1)", opacity: 1, offset: 0.3 },
      { transform: "translateY(-44px) scale(1)", opacity: 0 },
    ],
    { duration: 700, easing: "steps(7, end)", fill: "forwards" },
  );
  removeLater(heart, 800, true);
}

/** Floating "why" card — a readable sentence (ritual honesty copy), longer
 *  lived than a chip. Reduced motion: fade only. */
function floatWhyCard(text, rect) {
  const layer = ensureFxLayer();
  if (!layer) return;
  const card = document.createElement("div");
  card.className = "fx-why-card";
  card.setAttribute("role", "status");
  card.textContent = text;
  card.style.left = `${rect.left + rect.width / 2}px`;
  card.style.top = `${Math.max(70, rect.top - 10)}px`;
  card.style.transform = "translate(-50%, -100%)";
  layer.appendChild(card);
  const reduce = prefersReducedMotion();
  animateSafe(
    card,
    reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.1 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0 },
        ]
      : [
          { transform: "translate(-50%, -100%) translateY(8px)", opacity: 0 },
          { transform: "translate(-50%, -100%) translateY(-4px)", opacity: 1, offset: 0.12 },
          { transform: "translate(-50%, -100%) translateY(-4px)", opacity: 1, offset: 0.85 },
          { transform: "translate(-50%, -100%) translateY(-18px)", opacity: 0 },
        ],
    { duration: 3400, easing: reduce ? "linear" : "steps(16, end)", fill: "forwards" },
  );
  removeLater(card, 3500);
}

/** Immediate XP chip presentation (queue item body). `silent` skips the
 *  coin cue (the orb cascade's landings already played it). A fresh reason
 *  from bond_events (Task 14) labels the chip: "+30 XP · Quest complete". */
function fxXpChipNow(amount, opts = {}) {
  const wrap = $(".xp-bar-wrap");
  if (!wrap) return;
  if (!opts.silent) window.PMSfx?.play("coin");
  const base = PM().fx?.xpGain?.(amount) ?? `+${amount} XP`;
  const label = takeReasonLabel(amount);
  floatChip(label ? `${base} · ${label}` : base, wrap.getBoundingClientRect());
}

/** T2: XP gain chip — routed through the celebration queue; carries its
 *  amount as meta so backlogged chips can merge into one. */
function fxXpGain(delta) {
  fxEnqueue(2, (done, meta) => fxXpChipNow(meta.amount), 1200, { kind: "xp", amount: delta });
}

function fxStreakUpNow(days) {
  const streakEl = $(".badge.streak");
  if (!streakEl) return;
  window.PMSfx?.play("blip");
  const text = PM().fx?.streakUp?.(days) ?? `+${days} ${days === 1 ? "day" : "days"}`;
  floatChip(text, streakEl.getBoundingClientRect(), "fx-chip-streak");
  if (!prefersReducedMotion()) {
    animateSafe(
      streakEl,
      [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
      { duration: 450, easing: "steps(5, end)" },
    );
  }
}

/** T2: streak-up chip via the celebration queue. */
function fxStreakUp(days) {
  fxEnqueue(2, () => fxStreakUpNow(days), 1200);
}

/** Level-up celebration: pixel card overlay + confetti burst. Non-blocking
 *  (pointer-events: none) and self-removing. */
function fxLevelUpNow(level) {
  const layer = ensureFxLayer();
  if (!layer) return;
  window.PMSfx?.play("fanfare");
  window.PMSfx?.buzz(30);
  const overlay = document.createElement("div");
  overlay.className = "fx-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  const card = document.createElement("div");
  card.className = "fx-levelup-card";
  card.innerHTML =
    `<div class="fx-levelup-title">${PM().fx?.levelUpTitle ?? t("levelUp")}</div>` +
    `<div class="fx-levelup-sub">${PM().fx?.levelUpSub?.(Number(level) || 0) ?? `${t("bond")} Lv.${Number(level) || 0} — ${t("carePays")}`}</div>`;
  overlay.appendChild(card);
  layer.appendChild(overlay);
  const reduce = prefersReducedMotion();
  animateSafe(
    card,
    reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.8 },
          { opacity: 0 },
        ]
      : [
          { transform: "scale(0.6)", opacity: 0 },
          { transform: "scale(1.05)", opacity: 1, offset: 0.18 },
          { transform: "scale(1)", opacity: 1, offset: 0.3 },
          { transform: "scale(1)", opacity: 1, offset: 0.82 },
          { transform: "scale(0.9)", opacity: 0 },
        ],
    { duration: 2400, easing: reduce ? "linear" : "steps(24, end)", fill: "forwards" },
  );
  removeLater(overlay, 2500);
  spawnConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 44);
}

/** T4: level-up overlay via the celebration queue. */
function fxLevelUp(level) {
  fxEnqueue(4, () => fxLevelUpNow(level), 2500);
}

function prettifyKey(key) {
  const words = String(key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return words.replace(/\b[a-z]/g, (c) => c.toUpperCase()) || "Quest";
}

/** Quest-complete banner (top-center, non-blocking) + small confetti pop. */
function showQuestBannerNow(quest) {
  const layer = ensureFxLayer();
  if (!layer || !fxBannerStack) return;
  const meta = QUEST_META[quest.quest_key] ?? { title: prettifyKey(quest.quest_key), emoji: "🌟" };
  const xp = Number(quest.xp_reward) || 0;
  const banner = document.createElement("div");
  banner.className = "fx-banner";
  banner.innerHTML =
    `<div class="fx-banner-title">${PM().fx?.questComplete ?? `🏆 ${t("questComplete")}`}</div>` +
    `<div class="fx-banner-detail">${meta.emoji} ${meta.title} · <span class="fx-xp">+${xp} XP</span></div>`;
  while (fxBannerStack.children.length >= 3) fxBannerStack.firstChild.remove();
  fxBannerStack.appendChild(banner);
  const reduce = prefersReducedMotion();
  animateSafe(
    banner,
    reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.1 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0 },
        ]
      : [
          { transform: "translateY(-16px) scale(0.9)", opacity: 0 },
          { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.12 },
          { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.85 },
          { transform: "translateY(-8px) scale(0.95)", opacity: 0 },
        ],
    { duration: 2800, easing: reduce ? "linear" : "steps(20, end)", fill: "forwards" },
  );
  removeLater(banner, 2900);
  const rect = banner.getBoundingClientRect();
  spawnConfetti(rect.left + rect.width / 2, rect.bottom, 18);
}

// ── XP Orb Cascade + presentation ledger (Task 13) ──────────────────────
// The pod pop (and the lucky reveal, Task 14) present an XP award as pixel
// orbs arcing into the XP bar; each landing advances the bar's share and
// ticks the counter. Presentation-only — the XP is already in the ledger
// before any orb flies.
//
// Double-chip fix: any amount a pod/orb presentation will show is recorded
// via notePresented() the moment that presentation is enqueued; renderBond's
// XP diff consumes this ledger before floating a generic "+N XP" chip, so
// one award is never chipped twice — while genuinely un-presented awards
// (badges, diary bonuses, seasonal-boost remainders) still get their chip.

const ORB_FLIGHT_MS = 400;
const ORB_CASCADE_TOTAL_MS = 2500; // hard budget: last landing inside this
const ORB_CAP = 8;
const ORB_CAP_GOLD = 16;
const PRESENTED_TTL_MS = 30_000;
const XP_CHIP_GRACE_MS = 900;

let pendingPresentedXp = []; // [{ amount, at }] — awaiting renderBond's diff

function notePresented(amount) {
  if (Number.isFinite(amount) && amount > 0) {
    pendingPresentedXp.push({ amount, at: Date.now() });
  }
}

/** Subtract presented amounts from a bond XP delta; returns the remainder
 *  that still deserves a generic chip. Stale entries (a presentation whose
 *  bond update never arrived) expire after 30s so they can never eat a
 *  future, unrelated award. */
function consumePresented(delta) {
  const now = Date.now();
  pendingPresentedXp = pendingPresentedXp.filter((entry) => now - entry.at <= PRESENTED_TTL_MS);
  let remainder = delta;
  while (remainder > 0 && pendingPresentedXp.length > 0) {
    const head = pendingPresentedXp[0];
    const used = Math.min(head.amount, remainder);
    head.amount -= used;
    remainder -= used;
    if (head.amount <= 0) pendingPresentedXp.shift();
  }
  return remainder;
}

/** ceil(amount/10) 10px pixel orbs (cap 8; 16 when `gold`) fly staggered
 *  400ms transform-only arcs from `origin` (pod/banner rect) to the XP bar.
 *  Each landing advances the bar's share, ticks the counter, and plays the
 *  coin cue (sfx.js's own 1.5s per-cue rate limit thins the repeats). The
 *  last landing floats the "+N XP" receipt chip. Returns the cascade's
 *  total duration in ms (0 when it fell back to the plain chip). Reduced
 *  motion: the existing single chip + snap count path, unchanged. */
function orbCascade(amount, opts = {}) {
  const xp = Math.max(0, Math.round(Number(amount) || 0));
  if (xp <= 0) return 0;
  const wrap = $(".xp-bar-wrap");
  const layer = ensureFxLayer();
  const budget = MAX_PARTICLES - liveParticles;
  if (prefersReducedMotion() || !wrap || !layer || budget < 1) {
    fxXpChipNow(xp);
    return 0;
  }
  const numEl = ensureCoinNumber();
  const n = Math.min(Math.ceil(xp / 10), opts.gold ? ORB_CAP_GOLD : ORB_CAP, budget);
  const stagger = Math.min(250, Math.max(60, Math.floor((ORB_CASCADE_TOTAL_MS - ORB_FLIGHT_MS - 100) / n)));
  const origin = opts.origin ?? mascotRect();
  const target = wrap.getBoundingClientRect();
  const targetX = target.left + target.width / 2;
  const targetY = target.top + target.height / 2;
  // Counter re-roll: by claim time renderBond has usually applied the
  // authoritative total already, so replay the awarded segment ENDING at
  // the number on screen — the cascade never counts beyond truth.
  const shownRaw = Number.parseInt(numEl?.textContent ?? "", 10);
  const end = Number.isFinite(shownRaw) ? shownRaw : Math.max(prevXp ?? 0, xp);
  const start = Math.max(0, end - xp);
  cancelXpCount(); // the landings own the counter for the next ~2.5s
  if (numEl) numEl.textContent = String(start);
  setXpBar(start % 100, false);
  let lastShown = start;
  for (let i = 0; i < n; i++) {
    const orb = document.createElement("div");
    orb.className = opts.gold ? "fx-orb fx-orb-gold" : "fx-orb";
    orb.setAttribute("aria-hidden", "true");
    const sx = origin.left + (origin.width ?? 0) * (0.3 + Math.random() * 0.4);
    const sy = origin.top + (origin.height ?? 0) * (0.2 + Math.random() * 0.4);
    orb.style.left = `${sx}px`;
    orb.style.top = `${sy}px`;
    layer.appendChild(orb);
    liveParticles++;
    const dx = targetX - sx;
    const dy = targetY - sy;
    const lift = 40 + Math.random() * 50;
    animateSafe(
      orb,
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1.2)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: ORB_FLIGHT_MS, delay: i * stagger, easing: "steps(8, end)", fill: "both" },
    );
    setTimeout(() => {
      orb.remove();
      liveParticles = Math.max(0, liveParticles - 1);
      const value = Math.round(start + (xp * (i + 1)) / n);
      if (numEl) numEl.textContent = String(value);
      // The bar advances its share; crossing a 100-XP boundary reuses the
      // wrap-around snap juice already built into setXpBar.
      setXpBar(value % 100, Math.floor(lastShown / 100) < Math.floor(value / 100));
      lastShown = value;
      window.PMSfx?.play("coin");
    }, i * stagger + ORB_FLIGHT_MS);
  }
  const totalMs = (n - 1) * stagger + ORB_FLIGHT_MS + 150;
  // Landing receipt: the "+N XP" chip floats once the last orb has landed
  // (Task 14 attaches the reason label when a bond_event named one).
  setTimeout(() => fxXpChipNow(xp, { silent: true }), totalMs - 100);
  return totalMs;
}

// ── Tap-to-Claim Reward Pod (Task 9) ────────────────────────────────────
// Quest completes → a pixel seed pod drops beside Jamkachu and wiggles;
// tapping it pops the celebration. Presentation-only: the XP is already in
// the ledger before the pod ever appears. The pod is the ONLY element in
// the FX layer with pointer-events enabled. Auto-bursts after 8s and on
// page-hide so nothing ever stalls; the celebration queue guarantees one
// pod at a time (extra completions wait as queued T3 items).

const POD_AUTO_BURST_MS = 8000;

function podDrop(quest, done) {
  const layer = ensureFxLayer();
  if (!layer) {
    showQuestBannerNow(quest);
    done();
    return;
  }
  window.PMSfx?.play("whoosh");
  const reduce = prefersReducedMotion();
  const rect = mascotRect();
  const pod = document.createElement("button");
  pod.type = "button";
  pod.className = "fx-pod";
  pod.setAttribute("aria-label", "Claim quest reward");
  pod.style.left = `${Math.min(rect.right - 12, window.innerWidth - 72)}px`;
  pod.style.top = `${Math.min(rect.bottom - 90, window.innerHeight - 90)}px`;
  layer.appendChild(pod);
  if (!reduce) {
    // steps(6) fall from above, then the CSS wiggle loop takes over.
    animateSafe(
      pod,
      [
        { transform: "translateY(-340px)", opacity: 0 },
        { transform: "translateY(-300px)", opacity: 1, offset: 0.1 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 600, easing: "steps(6, end)", fill: "backwards" },
    );
  }

  let burst = false;
  let autoTimer = null;
  const onHide = () => {
    if (document.visibilityState === "hidden") pop();
  };
  const pop = () => {
    if (burst) return;
    burst = true;
    if (autoTimer !== null) clearTimeout(autoTimer);
    document.removeEventListener("visibilitychange", onHide);
    const podRect = pod.getBoundingClientRect();
    pod.remove();
    window.PMSfx?.play("pod");
    window.PMSfx?.buzz(15);
    spawnConfetti(podRect.left + podRect.width / 2, podRect.top + podRect.height / 2, 20);
    showQuestBannerNow(quest);
    // XP presentation (Task 13): orbs arc from the popped pod into the XP
    // bar; the queue item holds until the last orb lands (the item's own
    // duration cap still force-advances a stuck cascade).
    const xp = Number(quest.xp_reward) || 0;
    const cascadeMs = xp > 0 ? orbCascade(xp, { origin: podRect }) : 0;
    if (cascadeMs > 0) setTimeout(done, cascadeMs);
    else done();
  };
  pod.addEventListener("pointerdown", pop);
  autoTimer = setTimeout(pop, POD_AUTO_BURST_MS);
  document.addEventListener("visibilitychange", onHide);
}

/** T3: quest celebration — drops a claimable reward pod via the queue. The
 *  explicit duration covers the full 8s claim window; tapping resolves the
 *  queue item early through done(). */
function celebrateQuest(quest) {
  // The pod will present this award (Task 13): record it up front so
  // renderBond's XP diff — whose bond update usually arrives before the pod
  // is tapped — doesn't float a duplicate chip for the same XP.
  notePresented(Number(quest.xp_reward) || 0);
  fxEnqueue(3, (done) => podDrop(quest, done), POD_AUTO_BURST_MS + 700);
}

// ── Verifying shimmer sound + completion hold (Task 12) ─────────────────
// Soft anticipation ticks while the sensor confirms real care: at most five
// ticks, two seconds apart, and ONLY when a quest transitions INTO
// VERIFYING (diff-gated — never on the first snapshot or a poll repeat).
// The interval self-cancels as soon as no quest is VERIFYING anymore.

const VERIFY_TICK_INTERVAL_MS = 2000;
const VERIFY_TICK_MAX = 5;
const VERIFY_HOLD_MS = 600;
let verifyTickTimer = null;
let verifyTicksLeft = 0;

function startVerifyTicks() {
  verifyTicksLeft = VERIFY_TICK_MAX;
  // First tick fires immediately (lastQuestRows may not include the new
  // VERIFYING row yet); the interval re-checks reality every 2s.
  window.PMSfx?.play("tick");
  verifyTicksLeft -= 1;
  if (verifyTickTimer !== null) return;
  verifyTickTimer = setInterval(() => {
    if (verifyTicksLeft <= 0 || !anyQuestVerifying()) {
      clearInterval(verifyTickTimer);
      verifyTickTimer = null;
      return;
    }
    verifyTicksLeft -= 1;
    window.PMSfx?.play("tick");
  }, VERIFY_TICK_INTERVAL_MS);
}

/** 600ms anticipation hold between "sensor confirmed" and the reward pod:
 *  the screen dims 10% while a rising 3-note arpeggio plays. Enqueued as T3
 *  right before the pod (same tier ⇒ FIFO keeps it first). */
function enqueueVerifyHold() {
  fxEnqueue(3, (done) => {
    window.PMSfx?.play("cascade");
    const layer = ensureFxLayer();
    if (layer) {
      const dim = document.createElement("div");
      dim.className = "fx-hold-dim";
      dim.setAttribute("aria-hidden", "true");
      layer.appendChild(dim);
      animateSafe(
        dim,
        [
          { opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, offset: 0.8 },
          { opacity: 0 },
        ],
        { duration: VERIFY_HOLD_MS, easing: "linear", fill: "forwards" },
      );
      removeLater(dim, VERIFY_HOLD_MS + 50);
    }
    setTimeout(done, VERIFY_HOLD_MS);
  }, VERIFY_HOLD_MS);
}

// ── Reason chips + lucky jackpot reveal (Task 14) ───────────────────────
// bond_events INSERTs (after the milestone8 migration adds the table to the
// realtime publication) tell us WHY XP arrived: data = {amount, reason}.
// The reason maps by prefix to a friendly label appended to the XP chip
// ("+30 XP · Quest complete"). Everything degrades to the plain unlabeled
// chip when the channel errors or stays silent — never blocks.

const REASON_TTL_MS = 10_000; // pending reasons expire after 10s
const LUCKY_STAMP_MS = 1600;
const LUCKY_DEFER_MS = 600;
const GOLD_CONFETTI = ["#FFDE6A", "#FFC93C", "#FFF3C4", "#FFFFFF"];

// Prefix → PM_STRINGS.reasons key. Bare quest_key reasons (quest awards)
// and anything unrecognized fall through to "quest".
const REASON_PREFIXES = [
  ["lucky-bonus:", "lucky"],
  ["badge:", "badge"],
  ["chapter:", "chapter"],
  ["streak-milestone:", "streak"],
  ["mood:", "mood"],
  ["daily:", "daily"],
  ["growth", "growth"],
];
const REASON_FALLBACK = {
  quest: "Quest complete",
  lucky: "Lucky ×2!",
  badge: "New badge",
  chapter: "Story unlocked",
  streak: "Streak bonus",
  mood: "New mood found",
  daily: "Daily challenge",
  growth: "Diary entry",
};

function reasonLabelFor(reason) {
  const value = String(reason ?? "");
  const match = REASON_PREFIXES.find(([prefix]) => value.startsWith(prefix));
  const key = match ? match[1] : "quest";
  return PM().reasons?.[key] ?? REASON_FALLBACK[key];
}

let pendingReasons = []; // [{ amount, label, at }] — newest last

function noteReason(amount, reason) {
  pendingReasons.push({ amount, label: reasonLabelFor(reason), at: Date.now() });
  if (pendingReasons.length > 8) pendingReasons.shift();
}

/** Pick (and consume) the pending reason label for a chip of `amount`:
 *  exact-amount match first (so a base award and its equal lucky bonus each
 *  keep their own label), else the oldest fresh entry. Null when nothing
 *  fresh is pending — the chip just stays unlabeled. */
function takeReasonLabel(amount) {
  const now = Date.now();
  pendingReasons = pendingReasons.filter((entry) => now - entry.at <= REASON_TTL_MS);
  if (pendingReasons.length === 0) return null;
  const index = pendingReasons.findIndex((entry) => entry.amount === amount);
  const entry = index >= 0 ? pendingReasons.splice(index, 1)[0] : pendingReasons.shift();
  return entry.label;
}

/** T3 gold "LUCKY! ×2" stamp: scale-slam + gold confetti + jackpot arpeggio
 *  + a firm buzz. Pure reveal of a server-granted bonus (spec D2) — the XP
 *  itself was already awarded and is presented by the gold orb cascade. */
function fxLuckyStampNow(done) {
  const layer = ensureFxLayer();
  if (!layer) {
    done();
    return;
  }
  window.PMSfx?.play("jackpot");
  window.PMSfx?.buzz(25);
  const overlay = document.createElement("div");
  overlay.className = "fx-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  const stamp = document.createElement("div");
  stamp.className = "fx-lucky-stamp";
  stamp.textContent = PM().fx?.luckyStamp ?? "LUCKY! ×2";
  overlay.appendChild(stamp);
  layer.appendChild(overlay);
  const reduce = prefersReducedMotion();
  animateSafe(
    stamp,
    reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0 },
        ]
      : [
          { transform: "scale(2.8) rotate(-6deg)", opacity: 0 },
          { transform: "scale(1) rotate(-6deg)", opacity: 1, offset: 0.2 },
          { transform: "scale(1.12) rotate(-6deg)", opacity: 1, offset: 0.28 },
          { transform: "scale(1) rotate(-6deg)", opacity: 1, offset: 0.36 },
          { transform: "scale(1) rotate(-6deg)", opacity: 1, offset: 0.85 },
          { transform: "scale(0.9) rotate(-6deg)", opacity: 0 },
        ],
    { duration: LUCKY_STAMP_MS, easing: reduce ? "linear" : "steps(16, end)", fill: "forwards" },
  );
  removeLater(overlay, LUCKY_STAMP_MS + 100);
  spawnConfetti(window.innerWidth / 2, window.innerHeight * 0.35, 24, GOLD_CONFETTI);
  setTimeout(done, LUCKY_STAMP_MS);
}

/** Realtime bond_events INSERT → remember the award's reason; a lucky
 *  bonus additionally queues its gold reveal AFTER the base celebration. */
function onBondEventInsert(row) {
  if (!row || row.type !== "XP_AWARDED") return;
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const amount = Number(data.amount) || 0;
  const reason = String(data.reason ?? "");
  noteReason(amount, reason);
  if (reason.startsWith("lucky-bonus:")) {
    // The bonus gets its own gold presentation → note it so renderBond's
    // diff never chips the same XP again (Task 13 ledger).
    notePresented(amount);
    // AFTER the base presentation: the COMPLETED quest UPDATE lands in the
    // same realtime beat as this INSERT — defer so the pod (T3) enqueues
    // first; same-tier FIFO then keeps stamp + gold orbs behind it.
    setTimeout(() => {
      fxEnqueue(3, (done) => fxLuckyStampNow(done), LUCKY_STAMP_MS + 100);
      if (amount > 0) {
        fxEnqueue(2, () => orbCascade(amount, { gold: true }), ORB_CASCADE_TOTAL_MS + 200);
      }
    }, LUCKY_DEFER_MS);
  }
}

/** Record a quest row's status; celebrate only a real transition INTO
 *  COMPLETED. The first snapshot after load primes silently. A row first
 *  seen already COMPLETED only celebrates if it finished in the last five
 *  minutes (i.e. between polls) — old history never re-triggers. */
function trackQuest(row, primed = questsPrimed) {
  if (!row || typeof row !== "object" || !row.id) return;
  const prev = questStatuses.get(row.id);
  questStatuses.set(row.id, row.status);
  if (!primed) return;
  // Verifying shimmer sound (Task 12): only on a real ENTER transition.
  if (row.status === "VERIFYING" && prev !== "VERIFYING") startVerifyTicks();
  if (row.status !== "COMPLETED" || prev === "COMPLETED") return;
  if (prev === undefined) {
    const finishedAt = Date.parse(row.completed_at ?? "");
    if (!Number.isFinite(finishedAt) || Date.now() - finishedAt > 5 * 60_000) return;
  }
  // VERIFYING → COMPLETED gets the 600ms anticipation hold before the pod;
  // rows first seen already COMPLETED (prev undefined) skip it.
  if (prev === "VERIFYING") enqueueVerifyHold();
  celebrateQuest(row);
}

function trackQuests(rows) {
  const primed = questsPrimed;
  for (const row of rows) trackQuest(row, primed);
  questsPrimed = true;
  lastQuestRows = rows.slice();
  renderQuestSlot(lastQuestRows);
}

/** Mood recovered to Happy: sparkles around the mascot, a bubble bounce
 *  (the bubble text itself is refreshed by renderPlant's mood-change path),
 *  and a pulse on the HP bar that just climbed back to 100%. */
function fxMoodRecovered() {
  window.PMSfx?.play("pet");
  const wrapper = $(".mascot-wrapper");
  if (wrapper) spawnSparkles(wrapper.getBoundingClientRect(), 10);
  if (prefersReducedMotion()) return;
  const bubble = $(".speech-bubble");
  if (bubble) {
    animateSafe(
      bubble,
      [
        { transform: "scale(1)" },
        { transform: "scale(1.08)" },
        { transform: "scale(0.98)" },
        { transform: "scale(1)" },
      ],
      { duration: 500, easing: "steps(6, end)" },
    );
  }
  const hpEl = $("#hp-inline");
  if (hpEl) {
    animateSafe(
      hpEl,
      [{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }],
      { duration: 450, easing: "steps(5, end)" },
    );
  }
}

// XP number count-up (rAF) — snaps instantly under reduced motion or on
// non-gain updates (e.g. demo reset).
let xpCountFrame = null;

function cancelXpCount() {
  if (xpCountFrame !== null) {
    cancelAnimationFrame(xpCountFrame);
    xpCountFrame = null;
  }
}

function animateXpCount(el, from, to) {
  cancelXpCount();
  const start = performance.now();
  const duration = 800;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = String(Math.round(from + (to - from) * eased));
    xpCountFrame = t < 1 ? requestAnimationFrame(tick) : null;
  };
  xpCountFrame = requestAnimationFrame(tick);
}

/** Keep the coin badge's structure stable so only the number re-renders
 *  during count-up (same visual output as the old wholesale innerHTML). */
function ensureCoinNumber() {
  const coin = $(".badge.coin");
  if (!coin) return null;
  let num = coin.querySelector("[data-xp-num]");
  if (!num) {
    coin.innerHTML = `<i class="icon">⭐</i> <span data-xp-num></span> XP`;
    num = coin.querySelector("[data-xp-num]");
  }
  return num;
}

// XP bar: style.css already transitions width (1s ease-in-out). On level-up
// we fill to 100%, snap back to 0 without transition, then fill to the new
// remainder — the classic "bar wraps" juice. Re-renders during the snap only
// update the pending target (latest value wins).
let barSnapTimer = null;
let barPendingPercent = null;

function setXpBar(percent, wrapped) {
  const bar = $(".xp-bar");
  if (bar == null) return;
  if (barSnapTimer !== null) {
    barPendingPercent = percent;
    return;
  }
  if (wrapped && !prefersReducedMotion()) {
    barPendingPercent = percent;
    bar.style.width = "100%";
    barSnapTimer = setTimeout(() => {
      barSnapTimer = null;
      const target = barPendingPercent ?? percent;
      barPendingPercent = null;
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth; // flush so the snap-back doesn't animate
      bar.style.transition = ""; // stylesheet transition resumes
      bar.style.width = `${target}%`;
    }, 1050);
  } else {
    bar.style.width = `${percent}%`;
  }
}

// ── End reward-feedback FX helpers ──────────────────────────────────────

// ── Care rituals + petting + button micro-juice (Task 8) ────────────────
// Pure presentation, in-fiction only: ZERO Supabase writes, ZERO XP, no
// persisted counters of any kind (spec §4.1). The why-cards honestly point
// students at real, sensor-verified care.

const WHY_CARD_COOLDOWN_MS = 30_000; // shared across both ritual buttons
let lastWhyCardAt = 0;

const RITUAL_FALLBACK = {
  water: "That splash is just for fun — go water the real plant! Real care = real XP. The sensors will notice.",
  fertilize: "Sparkles are free — real nutrients feed the real soil! Real care = real XP. The sensors will notice.",
};

function mascotRect() {
  const wrapper = $(".mascot-wrapper");
  if (wrapper) return wrapper.getBoundingClientRect();
  return { left: window.innerWidth / 2 - 100, top: window.innerHeight / 2 - 100, width: 200, height: 200, right: window.innerWidth / 2 + 100, bottom: window.innerHeight / 2 + 100 };
}

function mascotBounce() {
  if (prefersReducedMotion()) return;
  const wrapper = $(".mascot-wrapper");
  if (!wrapper) return;
  animateSafe(
    wrapper,
    [
      { transform: "translateY(0)" },
      { transform: "translateY(-10px)" },
      { transform: "translateY(0)" },
    ],
    { duration: 300, easing: "steps(4, end)" },
  );
}

function runRitual(kind) {
  const rect = mascotRect();
  if (kind === "water") {
    window.PMSfx?.play("splash");
    spawnDroplets(rect, 14);
  } else {
    window.PMSfx?.play("tick");
    spawnSparkles(rect, 12); // green/gold sparkles from the shared palette
  }
  mascotBounce();
  const now = Date.now();
  if (now - lastWhyCardAt >= WHY_CARD_COOLDOWN_MS) {
    lastWhyCardAt = now;
    const text = PM().ritual?.[kind] ?? RITUAL_FALLBACK[kind];
    floatWhyCard(text, rect);
  }
}

// Petting — in-memory fiction only. Every 5th pet inside a rolling 30s
// window triggers a satiation yawn + 10s rest (never persisted anywhere).
const PET_FALLBACK_LINES = [
  "Hehe, that tickles!",
  "Jamkachu likes hanging out with you!",
  "Your hands are so warm!",
  "More pets, please!",
  "Growing up strong, thanks to you!",
];
const PET_COOLDOWN_MS = 600;
const PET_WINDOW_MS = 30_000;
const PET_SATIATION_MS = 10_000;
const PET_BUBBLE_RESTORE_MS = 4000;
let petCooldownUntil = 0;
let petSatiatedUntil = 0;
let petTapTimes = [];
let petLineIndex = 0;

function petMascot() {
  const now = Date.now();
  if (now < petCooldownUntil || now < petSatiatedUntil) return;
  petCooldownUntil = now + PET_COOLDOWN_MS;
  petTapTimes = petTapTimes.filter((time) => now - time < PET_WINDOW_MS);
  petTapTimes.push(now);

  window.PMSfx?.play("pet");
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    animateSafe(
      wrapper,
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.06, 0.94)" },
        { transform: "scale(1, 1)" },
      ],
      { duration: 150, easing: "steps(3, end)" },
    );
  }
  spawnHeart(wrapper ? wrapper.getBoundingClientRect() : null);

  let line;
  if (petTapTimes.length >= 5) {
    line = PM().pettingYawn ?? "So cozy… Jamkachu needs a tiny nap now. Zzz…";
    petSatiatedUntil = now + PET_SATIATION_MS;
    petTapTimes = [];
  } else {
    const lines = Array.isArray(PM().petting) && PM().petting.length > 0 ? PM().petting : PET_FALLBACK_LINES;
    line = lines[petLineIndex % lines.length];
    petLineIndex++;
  }

  const bubble = $(".speech-bubble");
  if (bubble) {
    if (petSavedBubble === null) petSavedBubble = bubble.innerHTML;
    bubble.textContent = `"${line}"`;
    if (petRestoreTimer !== null) clearTimeout(petRestoreTimer);
    petRestoreTimer = setTimeout(() => {
      petRestoreTimer = null;
      const el = $(".speech-bubble");
      if (el && petSavedBubble !== null) el.innerHTML = petSavedBubble;
      petSavedBubble = null;
    }, PET_BUBBLE_RESTORE_MS);
  }
}

/** One-time listener wiring; safe on the static demo (no data needed). */
function setupCareInteractions() {
  // Universal button micro-juice: sub-100ms press feedback + blip on every
  // pixel button and nav link (one delegated capture listener, no awaits).
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(".pixel-btn, .nav-item") : null;
      if (!target) return;
      target.classList.add("pressed");
      setTimeout(() => target.classList.remove("pressed"), 160);
      // Ritual buttons play their own richer cue instead of the blip.
      if (!target.classList.contains("water-btn") && !target.classList.contains("feed-btn")) {
        window.PMSfx?.play("blip");
      }
    },
    { passive: true },
  );

  $(".water-btn")?.addEventListener("pointerdown", () => runRitual("water"));
  $(".feed-btn")?.addEventListener("pointerdown", () => runRitual("fertilize"));
  $(".mascot-wrapper")?.addEventListener("pointerdown", petMascot);

  // Streak flame press (Task 15): tap → "N days in a row! Care today makes
  // N+1." + blip + a little flame pulse. Celebrates only what is already
  // real (prevStreak stays null until real data renders); grants nothing.
  $(".badge.streak")?.addEventListener("pointerdown", () => {
    const days = prevStreak;
    if (typeof days !== "number" || days <= 0) return;
    const nowTs = Date.now();
    if (nowTs < flamePressCooldownUntil) return;
    flamePressCooldownUntil = nowTs + FLAME_PRESS_COOLDOWN_MS;
    window.PMSfx?.play("blip");
    const text = PM().streakKeeper?.flame?.(days) ?? STREAK_KEEPER_FALLBACK.flame(days);
    floatWhyCard(text, streakAnchorRect());
    const el = $(".badge.streak");
    if (el && !prefersReducedMotion()) {
      animateSafe(
        el,
        [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
        { duration: 300, easing: "steps(4, end)" },
      );
    }
  });
}

setupCareInteractions();

// ── End care rituals + petting + micro-juice ────────────────────────────

/** HP is character state (mood-derived, HP_BY_MOOD) — rendered inline next
 *  to the XP bar (#hp-inline), not in the environment strip (spec §2.1). */
function renderHp(moodState) {
  const el = $("#hp-inline");
  if (!el) return;
  const pct = HP_BY_MOOD[moodState] ?? 100;
  el.textContent = `HP ${pct}%`;
  el.classList.remove("hp-good", "hp-warn", "hp-low");
  el.classList.add(pct >= 80 ? "hp-good" : pct >= 60 ? "hp-warn" : "hp-low");
}

/** Home quest slot (#current-quest): first ACTIVE quest, else first
 *  VERIFYING. Maintain quests show live elapsed/target minutes; VERIFYING
 *  renders the amber shimmer state (Task 12): 🔍 + "Sensor is checking…" +
 *  three blinking dots. Display-only. */
function renderQuestSlot(rows) {
  const nameEl = $("#cq-name");
  const progressEl = $("#cq-progress");
  if (!nameEl || !progressEl) return;
  const slotEl = $("#current-quest");
  const list = Array.isArray(rows) ? rows : [];
  const quest = list.find((row) => row?.status === "ACTIVE") ?? list.find((row) => row?.status === "VERIFYING");
  slotEl?.classList.toggle("verifying", quest?.status === "VERIFYING");
  if (!quest) {
    nameEl.textContent = t("quest.none");
    progressEl.textContent = "";
    return;
  }
  const meta = QUEST_META[quest.quest_key];
  nameEl.textContent = meta ? `${meta.emoji} ${meta.title}` : prettifyKey(quest.quest_key);
  if (quest.status === "VERIFYING") {
    // Static structure via innerHTML, dynamic copy via textContent (safe).
    progressEl.innerHTML =
      '🔍 <span class="cq-verifying-text"></span><span class="cq-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
    const textEl = progressEl.querySelector(".cq-verifying-text");
    if (textEl) textEl.textContent = PM().verifying?.checking ?? "Sensor is checking…";
  } else if (meta?.targetMin && quest.started_at) {
    const elapsedMin = Math.max(0, Math.floor((Date.now() - Date.parse(quest.started_at)) / 60_000));
    progressEl.textContent = `${Math.min(elapsedMin, meta.targetMin)}/${meta.targetMin} min`;
  } else {
    progressEl.textContent = "";
  }
}

// Latest quest snapshot so realtime single-row updates can re-render the
// quest slot without waiting for the next 15s poll.
let lastQuestRows = [];

function upsertQuestRow(row) {
  if (!row || !row.id) return;
  const index = lastQuestRows.findIndex((existing) => existing.id === row.id);
  if (index >= 0) lastQuestRows[index] = { ...lastQuestRows[index], ...row };
  else lastQuestRows.unshift(row);
  renderQuestSlot(lastQuestRows);
}

function renderPlant(plant) {
  if (!plant) return;
  const mood = MOODS[plant.current_state] ?? MOODS.Happy;
  // DEV ADDITION (speech bubble — personality/AI voice): paint the local
  // template instantly, then ask /api/mood-message for the personalized line
  // (AI-flavored when a key is set, deterministic template otherwise). Both
  // run only when the mood actually CHANGED, so the 15 s poll never
  // re-fetches or stomps a displayed message. Fetch failure ⇒ template stays.
  if (plant.current_state !== lastMoodFetched) {
    const state = plant.current_state;
    lastMoodFetched = state;
    setMascotMood(state);
    const bubble = $(".speech-bubble");
    if (bubble) bubble.innerHTML = mood.bubble;
    cancelPetBubble(); // a real mood message must never be stomped by a stale pet-line restore
    fetch(`/api/mood-message?plantId=${encodeURIComponent(PLANT_ID)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data.message !== "string") return;
        if (lastMoodFetched !== state) return; // mood moved on mid-flight
        const el = $(".speech-bubble");
        if (el) el.textContent = `"${data.message}"`;
      })
      .catch(() => {});
  }
  // DEV ADDITION (reward FX): sparkle + bubble bounce + HP pulse when the
  // plant RECOVERS to Happy (real sensor-verified transition; the first
  // render is recorded silently via prevMoodFx === null).
  if (prevMoodFx !== null && prevMoodFx !== "Happy" && plant.current_state === "Happy") {
    fxMoodRecovered();
  }
  prevMoodFx = plant.current_state;
  renderHp(plant.current_state);
  const nameEl = $(".username");
  if (nameEl && nameEl.dataset.level != null) {
    nameEl.textContent = `${plant.name} · ${t("bond")} Lv.${nameEl.dataset.level}`;
  } else if (nameEl) {
    nameEl.textContent = plant.name;
  }
}

function renderBond(bond, plantName) {
  if (!bond) return;
  const totalXp = Number(bond.total_xp) || 0;
  const level = Number(bond.bond_level) || 1;
  const streakDays = Number(bond.current_streak) || 0;
  // DEV ADDITION (reward FX): diff against the previous render. All prev*
  // start null, so the FIRST render only records state — no celebration for
  // merely loading the page. Deltas <= 0 (poll repeats, demo resets) never
  // celebrate either.
  const firstRender = prevXp === null;
  const xpDelta = firstRender ? 0 : totalXp - prevXp;
  const leveledUp = !firstRender && level > prevLevel;
  const streakDelta = firstRender ? 0 : streakDays - prevStreak;

  const nameEl = $(".username");
  if (nameEl) {
    nameEl.dataset.level = String(bond.bond_level);
    if (plantName) nameEl.textContent = `${plantName} · ${t("bond")} Lv.${bond.bond_level}`;
  }
  setXpBar(totalXp % 100, leveledUp);
  const numEl = ensureCoinNumber();
  if (numEl) {
    if (xpDelta > 0 && !prefersReducedMotion()) {
      const shown = Number.parseInt(numEl.textContent, 10);
      animateXpCount(numEl, Number.isFinite(shown) ? shown : prevXp, totalXp);
    } else {
      cancelXpCount();
      numEl.textContent = String(totalXp);
    }
  }
  const streak = $(".badge.streak");
  if (streak) {
    // Flame tier grows at 7/14/30 days (Task 15) — text-level, no sprites.
    streak.innerHTML = `<i class="icon">${flameFor(streakDays)}</i> ${streakDays} ${t("days")}`;
    streak.style.display = streakDays > 0 ? "" : "none";
  }

  if (xpDelta > 0) {
    // Chip only what no pod/orb presentation owns (Task 13 double-chip
    // fix). Deferred one beat: the quest-completion event that registers
    // its presentation (and the bond_event naming a reason, Task 14)
    // arrives moments after this bond update on the same realtime stream.
    setTimeout(() => {
      const remainder = consumePresented(xpDelta);
      if (remainder > 0) fxXpGain(remainder);
    }, XP_CHIP_GRACE_MS);
  }
  if (leveledUp) fxLevelUp(level);
  if (streakDelta > 0) fxStreakUp(streakDelta);
  // Streak keeper (Task 15): kind restart line on a real reset diff, and
  // the once-per-WIB-day daytime nudge (self-gated by its localStorage
  // day-flag, so poll repeats can never re-fire it).
  if (!firstRender && prevStreak > 1 && streakDays <= 1) fxStreakBroken();
  maybeStreakNudge(bond, streakDays);

  prevXp = totalXp;
  prevLevel = level;
  prevStreak = streakDays;
}

// ── Streak keeper + flame press (Task 15) ───────────────────────────────
// Warm, honest streak presence (spec §4.3): one gentle daytime nudge per
// WIB day while today is still uncared-for, a kind restart line when a
// streak resets, and a tappable flame that celebrates what is already real.
// No countdowns, no guilt copy, zero XP from taps.

const STREAK_NUDGE_KEY = "pm_streak_nudge";
const STREAK_NUDGE_HOUR_START = 7; // 07:00 WIB inclusive
const STREAK_NUDGE_HOUR_END = 20; // 20:00 WIB exclusive
const FLAME_PRESS_COOLDOWN_MS = 2000;
const STREAK_KEEPER_FALLBACK = {
  active: (d) => `🔥 ${d} days going — Jamkachu would love a visit today.`,
  broken: "Every streak starts at day one. Welcome back!",
  flame: (d) => `${d} days in a row! Care today makes ${d + 1}.`,
};
let flamePressCooldownUntil = 0;

/** Current WIB (Asia/Jakarta) calendar date + hour — the same calendar the
 *  server's streak engine counts in. Null when Intl/timezone data is
 *  unavailable (the keeper then simply stays silent). */
function wibNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { date, hour: Number(get("hour")) % 24 }; // some engines say "24" at midnight
  } catch {
    return null;
  }
}

/** Anchor for streak copy: the flame badge, else the bond panel. */
function streakAnchorRect() {
  const el = $(".badge.streak") ?? $(".user-gamification");
  return el ? el.getBoundingClientRect() : mascotRect();
}

/** Once per WIB day (localStorage day-flag), 07:00–20:00 only, streak
 *  alive, and today still uncared-for — bond_state.last_qualified_date is
 *  the server streak engine's own WIB care marker, so this never invents a
 *  signal. Storage failure ⇒ stay silent (better than risking a nag). */
function maybeStreakNudge(bond, streakDays) {
  if (!(streakDays > 0)) return;
  const now = wibNow();
  if (!now) return;
  if (now.hour < STREAK_NUDGE_HOUR_START || now.hour >= STREAK_NUDGE_HOUR_END) return;
  if (bond.last_qualified_date === now.date) return; // already cared for today
  let seen = null;
  try {
    seen = window.localStorage.getItem(STREAK_NUDGE_KEY);
  } catch {
    return;
  }
  if (seen === now.date) return;
  try {
    window.localStorage.setItem(STREAK_NUDGE_KEY, now.date);
  } catch {
    return; // can't guarantee once-per-day → skip
  }
  const text = PM().streakKeeper?.active?.(streakDays) ?? STREAK_KEEPER_FALLBACK.active(streakDays);
  fxEnqueue(2, () => floatWhyCard(text, streakAnchorRect()), 1200);
}

/** Kind restart line when a streak resets (prev > 1 → 0/1). Warm copy
 *  only — never a countdown, never guilt. */
function fxStreakBroken() {
  const text = PM().streakKeeper?.broken ?? STREAK_KEEPER_FALLBACK.broken;
  fxEnqueue(2, () => floatWhyCard(text, streakAnchorRect()), 1200);
}

/** Flame grows with the streak: 🔥 → 🔥🔥 (7+) → 🔥🔥🔥 (14+) → 💛🔥 (30+). */
function flameFor(days) {
  return days >= 30 ? "💛🔥" : days >= 14 ? "🔥🔥🔥" : days >= 7 ? "🔥🔥" : "🔥";
}

// ── Causal Echo (Task 11) ───────────────────────────────────────────────
// Real sensor diffs → a chip anchored to the environment strip, binding the
// student's physical care to on-screen feedback. Diff-driven like every
// other effect: prevSensors starts null, so the first reading only records
// (no echo for merely opening the page). Throttled to one echo per sensor
// per five minutes; while any quest is VERIFYING the chip honestly says the
// sensor noticed and is checking instead of celebrating early.

const ECHO_THROTTLE_MS = 5 * 60_000;
const ECHO_HUMIDITY_STEP = 8; // +8 percentage points between readings
const ECHO_TEMP_MIN = 18;
const ECHO_TEMP_MAX = 28;
const ECHO_FALLBACK = {
  humidityUp: (d) => `Air +${d}% — Jamkachu breathes easy!`,
  tempComfy: "Nice and cool again",
  lightOn: "Sunshine!",
  verifying: "Sensor saw your care — verifying…",
};
let prevSensors = null; // { temperature, humidity, light } — null until first reading
const echoLastAt = { hum: 0, temp: 0, light: 0 };

function anyQuestVerifying() {
  return lastQuestRows.some((row) => row?.status === "VERIFYING");
}

/** T2 echo chip over an env-strip span (throttled per sensor). */
function echoChip(sensor, selector, text) {
  const now = Date.now();
  if (now - echoLastAt[sensor] < ECHO_THROTTLE_MS) return;
  echoLastAt[sensor] = now;
  // Resolve the copy at DATA time: if the sensor change is feeding a quest
  // that is still being verified, say so instead of celebrating early.
  const line = anyQuestVerifying() ? (PM().echo?.verifying ?? ECHO_FALLBACK.verifying) : text;
  fxEnqueue(2, () => {
    const anchor = $(selector) ?? $("#env-strip");
    if (anchor) floatChip(line, anchor.getBoundingClientRect());
  }, 1200);
}

/** Diff the latest reading against the previous one and fire echo chips.
 *  Per-field null-safety: a field missing from one reading neither echoes
 *  nor forgets the last known value. */
function causalEcho(next) {
  if (prevSensors === null) {
    prevSensors = { ...next };
    return;
  }
  if (next.humidity != null && prevSensors.humidity != null) {
    const delta = next.humidity - prevSensors.humidity;
    if (delta >= ECHO_HUMIDITY_STEP) {
      const d = Math.round(delta);
      echoChip("hum", "#env-hum", PM().echo?.humidityUp?.(d) ?? ECHO_FALLBACK.humidityUp(d));
    }
  }
  if (
    next.temperature != null &&
    prevSensors.temperature != null &&
    next.temperature >= ECHO_TEMP_MIN &&
    next.temperature <= ECHO_TEMP_MAX &&
    (prevSensors.temperature < ECHO_TEMP_MIN || prevSensors.temperature > ECHO_TEMP_MAX)
  ) {
    echoChip("temp", "#env-temp", PM().echo?.tempComfy ?? ECHO_FALLBACK.tempComfy);
  }
  if (next.light === 1 && prevSensors.light === 0) {
    echoChip("light", "#env-light", PM().echo?.lightOn ?? ECHO_FALLBACK.lightOn);
  }
  if (next.temperature != null) prevSensors.temperature = next.temperature;
  if (next.humidity != null) prevSensors.humidity = next.humidity;
  if (next.light != null) prevSensors.light = next.light;
}

/** Environment strip (#env-strip): compact one-line reading — the old 5-row
 *  vitals panel is gone; detail lives in Plant Status (/monitoring). */
function renderSensors(reading) {
  const temperature = Number(reading?.temperature);
  if (reading?.temperature != null && Number.isFinite(temperature)) {
    setText("#env-temp", `${temperature.toFixed(1)}°C`);
  }

  const humidity = Number(reading?.humidity);
  if (reading?.humidity != null && Number.isFinite(humidity)) {
    setText("#env-hum", `${Math.round(humidity)}%`);
  }

  const soilPh = Number(reading?.soil_ph);
  if (reading?.soil_ph != null && Number.isFinite(soilPh)) {
    setText("#env-ph", `pH ${soilPh.toFixed(1)}`);
  }

  const light = Number(reading?.light);
  if (reading?.light != null && (light === 0 || light === 1)) {
    setText("#env-light", light === 1 ? t("bright") : t("dark"));
  }

  const indoorParts = [];
  if (reading?.temperature != null && Number.isFinite(temperature)) indoorParts.push(`${temperature.toFixed(1)}°C`);
  if (reading?.humidity != null && Number.isFinite(humidity)) indoorParts.push(`${Math.round(humidity)}% RH`);
  if (indoorParts.length > 0) setText(".indoor-reading", `${t("weather.indoor")}: ${indoorParts.join(" · ")}`);

  // Causal echo (Task 11): diff-driven chips for real sensor improvements.
  causalEcho({
    temperature: reading?.temperature != null && Number.isFinite(temperature) ? temperature : null,
    humidity: reading?.humidity != null && Number.isFinite(humidity) ? humidity : null,
    light: reading?.light != null && (light === 0 || light === 1) ? light : null,
  });
}

function weatherIcon(description) {
  const normalized = String(description ?? "").toLowerCase();
  if (normalized.includes("petir") || normalized.includes("thunder")) return "⛈️";
  if (normalized.includes("hujan") || normalized.includes("rain")) return "🌧️";
  if (normalized.includes("kabut") || normalized.includes("mist") || normalized.includes("fog")) return "🌫️";
  if (normalized.includes("berawan") || normalized.includes("cloud")) return "☁️";
  if (normalized.includes("cerah") || normalized.includes("sunny") || normalized.includes("clear")) return "☀️";
  return "🌤️";
}

function renderWeather(context) {
  const widget = $(".weather-widget");
  if (!context?.ok) {
    setText(".weather-text .desc", t("weather.unavailable"));
    setText(".weather-text .forecast-time", "");
    widget?.classList.add("weather-stale");
    return;
  }
  const description = appLocale === "id"
    ? (context.forecast.descriptionId ?? context.forecast.descriptionEn)
    : (context.forecast.descriptionEn ?? context.forecast.descriptionId);
  setText(".weather-text .temp", `${Math.round(Number(context.forecast.temperatureC))}°C`);
  const outdoorHumidity = Number(context.forecast.humidityPct);
  setText(
    ".weather-text .desc",
    Number.isFinite(outdoorHumidity) ? `${description} · ${Math.round(outdoorHumidity)}% RH` : description,
  );
  const icon = $(".weather-icon");
  if (icon) icon.textContent = weatherIcon(description);
  const forecastDate = new Date(context.forecast.forecastAt);
  const time = Number.isNaN(forecastDate.getTime())
    ? ""
    : new Intl.DateTimeFormat(appLocale === "id" ? "id-ID" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(forecastDate);
  const staleSuffix = context.stale ? ` · ${t("weather.stale")}` : "";
  setText(".weather-text .forecast-time", time ? `${t("weather.forecast")} ${time} WIB${staleSuffix}` : staleSuffix);
  widget?.classList.toggle("weather-stale", Boolean(context.stale));
}

async function refreshWeather() {
  try {
    const response = await fetch("/api/local-context");
    renderWeather(await response.json());
  } catch {
    renderWeather(null);
  }
}

async function main() {
  refreshWeather();
  setInterval(refreshWeather, 30 * 60_000);
  let config;
  try {
    config = await (await fetch("/api/public-config")).json();
  } catch {
    return;
  }
  if (!config?.url || !config?.key) {
    setText(".indoor-reading", t("sensor.unavailable"));
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(config.url, config.key);

  let plantName = null;

  const refresh = async () => {
    const [plantRes, bondRes, sensorRes, questRes] = await Promise.all([
      supabase.from("plants").select("*").eq("id", PLANT_ID).maybeSingle(),
      supabase.from("bond_state").select("*").eq("plant_id", PLANT_ID).maybeSingle(),
      supabase
        .from("sensor_readings")
        .select("temperature, humidity, light, soil_ph, recorded_at")
        .eq("plant_id", PLANT_ID)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // DEV ADDITION (reward FX): recent quest statuses for the
      // completed-quest celebration (polling fallback alongside realtime).
      supabase
        .from("quests")
        .select("id, quest_key, status, xp_reward, started_at, completed_at")
        .eq("plant_id", PLANT_ID)
        .in("status", ["ACTIVE", "VERIFYING", "COMPLETED"])
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (bondRes.data) renderBond(bondRes.data, plantName ?? plantRes.data?.name);
    if (plantRes.data) {
      plantName = plantRes.data.name;
      renderPlant(plantRes.data);
    }
    if (sensorRes.data) renderSensors(sensorRes.data);
    if (questRes.data) trackQuests(questRes.data);
  };

  await refresh();

  supabase
    .channel(`farm-${PLANT_ID}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "plants", filter: `id=eq.${PLANT_ID}` },
      (payload) => {
        plantName = payload.new?.name ?? plantName;
        renderPlant(payload.new);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "bond_state", filter: `plant_id=eq.${PLANT_ID}` },
      (payload) => renderBond(payload.new, plantName),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "quests", filter: `plant_id=eq.${PLANT_ID}` },
      (payload) => {
        trackQuest(payload.new);
        upsertQuestRow(payload.new);
      },
    )
    .subscribe();

  // Reason chips (Task 14): bond_events INSERTs carry {amount, reason} for
  // every XP award. Deliberately its OWN channel (same socket): until the
  // milestone8 migration runs, the table is missing from the
  // supabase_realtime publication and that join errors — isolating it means
  // the failure can never take down the plant/bond/quest subscriptions
  // above. Error or silence ⇒ XP chips simply stay unlabeled; nothing
  // blocks and no retry storm touches the main channel.
  try {
    supabase
      .channel(`farm-events-${PLANT_ID}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bond_events", filter: `plant_id=eq.${PLANT_ID}` },
        (payload) => onBondEventInsert(payload.new),
      )
      .subscribe();
  } catch {
    // Chips stay unlabeled — never block the page over a nice-to-have.
  }

  // Polling fallback + sensor refresh (sensor_readings has no realtime).
  setInterval(refresh, 15_000);

  // Lazy game tick so time-window quests complete while parked on this page.
  setInterval(() => {
    fetch("/api/game-tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: PLANT_ID }),
    }).catch(() => {});
  }, 60_000);
}

main();
