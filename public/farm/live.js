// PlantMoji live data binding for the team's pixel-farm page.
//
// The page markup/styles (index.html, style.css) are the designer's files,
// used AS-IS — this script only fills the existing elements with real data
// from Supabase (read-only publishable key + RLS) and keeps them fresh via
// Realtime with a polling fallback. No game logic lives here: the browser
// never decides XP or truth (handoff rules) — it only displays.

const PLANT_ID = "plant-01";
const LOCALE_KEY = "plantmoji_locale";

const COPY = {
  id: {
    "nav.dashboard": "Beranda",
    "nav.plants": "Tanaman",
    "nav.monitoring": "Pemantauan",
    "nav.camera": "Kamera AI",
    "nav.quests": "Misi",
    "nav.collection": "Koleksi",
    "nav.shop": "Toko",
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
    "vitals.title": "Kondisi Tanaman",
    "vitals.health": "Kesehatan",
    "vitals.temperature": "Suhu",
    "vitals.humidity": "Kelembapan Udara",
    "vitals.soilPh": "pH Tanah",
    "vitals.light": "Cahaya",
    bright: "Terang",
    dark: "Gelap",
    days: "Hari",
    bond: "Ikatan",
    levelUp: "NAIK LEVEL!",
    carePays: "perawatanmu membuahkan hasil",
    questComplete: "Misi selesai!",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.plants": "Plants",
    "nav.monitoring": "Monitoring",
    "nav.camera": "Camera AI",
    "nav.quests": "Quests",
    "nav.collection": "Collection",
    "nav.shop": "Shop",
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
    "vitals.title": "Plant Vitals",
    "vitals.health": "Health",
    "vitals.temperature": "Temperature",
    "vitals.humidity": "Air Humidity",
    "vitals.soilPh": "Soil pH",
    "vitals.light": "Light",
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
const t = (key) => COPY[appLocale][key] ?? key;

const MOODS = {
  Happy: { icon: "☀️", label: { id: "Sehat", en: "Happy" }, bubble: { id: "\"Aku merasa sehat!<br>Terima kasih sudah merawatku.\"", en: "\"I'm feeling so healthy!<br>Thanks for the care.\"" } },
  Overheating: { icon: "🔥", label: { id: "Terlalu Panas", en: "Too Hot!" }, bubble: { id: "\"Terlalu panas...<br>tolong sejukkan aku!\"", en: "\"It's too hot...<br>please cool me down!\"" } },
  DryAir: { icon: "💨", label: { id: "Udara Kering", en: "Dry Air" }, bubble: { id: "\"Udaranya kering...<br>tolong lembapkan udara di sekitarku.\"", en: "\"The air feels so dry...<br>a little humidity please?\"" } },
  Sleepy: { icon: "🌙", label: { id: "Kurang Cahaya", en: "Too Dark" }, bubble: { id: "\"Gelap sekali...<br>tolong beri aku cahaya!\"", en: "\"So dark... I'm getting sleepy.<br>More light please!\"" } },
  SoilAcidic: { icon: "🧪", label: { id: "Tanah Terlalu Asam", en: "Soil Too Acidic" }, bubble: { id: "\"Tanahku terlalu asam...<br>tolong periksa pH-nya.\"", en: "\"My soil feels sour...<br>can you check the pH?\"" } },
  SoilAlkaline: { icon: "🧪", label: { id: "Tanah Terlalu Basa", en: "Soil Too Alkaline" }, bubble: { id: "\"Tanahku terlalu basa...<br>tolong periksa pH-nya.\"", en: "\"My soil feels off...<br>can you check the pH?\"" } },
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
const QUEST_META = {
  KEEP_ME_HAPPY: { title: { id: "Jaga Aku Tetap Sehat", en: "Keep Me Happy" }, emoji: "🌱" },
  STAY_COMFY: { title: { id: "Tetap Nyaman", en: "Stay Comfy" }, emoji: "🛋️" },
  COOL_ME_DOWN: { title: { id: "Sejukkan Aku", en: "Cool Me Down" }, emoji: "❄️" },
  GIVE_ME_MORE_LIGHT: { title: { id: "Beri Aku Cahaya", en: "Give Me More Light" }, emoji: "☀️" },
  HUMIDIFY_MY_AIR: { title: { id: "Lembapkan Udaraku", en: "Humidify My Air" }, emoji: "💦" },
  BALANCE_SOIL_ACIDIC: { title: { id: "Seimbangkan Tanahku", en: "Balance My Soil" }, emoji: "🧪" },
  BALANCE_SOIL_ALKALINE: { title: { id: "Seimbangkan Tanahku", en: "Balance My Soil" }, emoji: "🧪" },
};

// Cross-render state for speech-bubble request de-duplication.
let lastMoodFetched = null; // mood already sent to /api/mood-message

const $ = (selector) => document.querySelector(selector);

function setText(selector, text) {
  const el = $(selector);
  if (el && text != null) el.textContent = text;
}

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
// No sound (autoplay policies + classroom use). When Supabase is not
// configured, main() returns before any data render, so all of this stays
// dormant: no DOM or <style> is injected on the static-demo path.
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
.fx-confetti, .fx-sparkle { position: fixed; image-rendering: pixelated; will-change: transform, opacity; }
.fx-chip { position: fixed; font-family: var(--font-heading, monospace); font-size: 12px; color: #fff; background: var(--color-grass, #69C455); border: 2px solid var(--color-outline, #2B3A27); box-shadow: 0 3px 0 var(--color-outline, #2B3A27); border-radius: 10px; padding: 5px 10px; white-space: nowrap; will-change: transform, opacity; }
.fx-chip-streak { background: #FF9C4B; }
.fx-banner-stack { position: fixed; top: 96px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; z-index: 1000; }
.fx-banner { font-family: var(--font-heading, monospace); background: var(--color-white, #fff); color: var(--color-outline, #2B3A27); border: 3px solid var(--color-outline, #2B3A27); border-radius: 14px; box-shadow: 0 5px 0 var(--color-outline, #2B3A27); padding: 14px 22px; text-align: center; will-change: transform, opacity; }
.fx-banner-title { font-size: 13px; color: var(--color-forest, #397A2B); margin-bottom: 8px; }
.fx-banner-detail { font-size: 11px; }
.fx-xp { color: var(--color-forest, #397A2B); }
.fx-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1001; }
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
 *  prefers-reduced-motion. */
function spawnConfetti(x, y, count) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const colors = getPalette().confetti;
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

function fxXpGain(delta) {
  const wrap = $(".xp-bar-wrap");
  if (!wrap) return;
  floatChip(`+${delta} XP`, wrap.getBoundingClientRect());
}

function fxStreakUp(days) {
  const streakEl = $(".badge.streak");
  if (!streakEl) return;
  const suffix = appLocale === "id" ? "hari" : days === 1 ? "day" : "days";
  floatChip(`+${days} ${suffix}`, streakEl.getBoundingClientRect(), "fx-chip-streak");
  if (!prefersReducedMotion()) {
    animateSafe(
      streakEl,
      [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
      { duration: 450, easing: "steps(5, end)" },
    );
  }
}

/** Level-up celebration: pixel card overlay + confetti burst. Non-blocking
 *  (pointer-events: none) and self-removing. */
function fxLevelUp(level) {
  const layer = ensureFxLayer();
  if (!layer) return;
  const overlay = document.createElement("div");
  overlay.className = "fx-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  const card = document.createElement("div");
  card.className = "fx-levelup-card";
  card.innerHTML =
    `<div class="fx-levelup-title">${t("levelUp")}</div>` +
    `<div class="fx-levelup-sub">${t("bond")} Lv.${Number(level) || 0} — ${t("carePays")}</div>`;
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

function prettifyKey(key) {
  const words = String(key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return words.replace(/\b[a-z]/g, (c) => c.toUpperCase()) || "Quest";
}

/** Quest-complete banner (top-center, non-blocking) + small confetti pop. */
function celebrateQuest(quest) {
  const layer = ensureFxLayer();
  if (!layer || !fxBannerStack) return;
  const meta = QUEST_META[quest.quest_key] ?? { title: { id: prettifyKey(quest.quest_key), en: prettifyKey(quest.quest_key) }, emoji: "🌟" };
  const xp = Number(quest.xp_reward) || 0;
  const banner = document.createElement("div");
  banner.className = "fx-banner";
  banner.innerHTML =
    `<div class="fx-banner-title">🏆 ${t("questComplete")}</div>` +
    `<div class="fx-banner-detail">${meta.emoji} ${meta.title[appLocale]} · <span class="fx-xp">+${xp} XP</span></div>`;
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

/** Record a quest row's status; celebrate only a real transition INTO
 *  COMPLETED. The first snapshot after load primes silently. A row first
 *  seen already COMPLETED only celebrates if it finished in the last five
 *  minutes (i.e. between polls) — old history never re-triggers. */
function trackQuest(row, primed = questsPrimed) {
  if (!row || typeof row !== "object" || !row.id) return;
  const prev = questStatuses.get(row.id);
  questStatuses.set(row.id, row.status);
  if (!primed) return;
  if (row.status !== "COMPLETED" || prev === "COMPLETED") return;
  if (prev === undefined) {
    const finishedAt = Date.parse(row.completed_at ?? "");
    if (!Number.isFinite(finishedAt) || Date.now() - finishedAt > 5 * 60_000) return;
  }
  celebrateQuest(row);
}

function trackQuests(rows) {
  const primed = questsPrimed;
  for (const row of rows) trackQuest(row, primed);
  questsPrimed = true;
}

/** Mood recovered to Happy: sparkles around the mascot, a bubble bounce
 *  (the bubble text itself is refreshed by renderPlant's mood-change path),
 *  and a pulse on the HP bar that just climbed back to 100%. */
function fxMoodRecovered() {
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
  const hpBar = document.querySelector('[data-vital="hp"] .v-bar');
  if (hpBar) {
    animateSafe(
      hpBar,
      [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
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

/** DEV ADDITION (HP vital): bind the designer's HP row to the current mood.
 *  Only called with real plant data — the static placeholder stays
 *  otherwise. Width transition comes from the teammate's .fill CSS. */
function renderHp(moodState) {
  const row = document.querySelector('[data-vital="hp"]');
  if (!row) return;
  const pct = HP_BY_MOOD[moodState] ?? 100;
  const fill = row.querySelector(".fill");
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.style.background =
      pct >= 80
        ? "var(--color-grass-light, #89D974)"
        : pct >= 60
          ? "var(--color-yellow, #FFDE6A)"
          : "var(--color-cheek, #FF9E9E)";
  }
  const display = row.querySelector(".v-perc");
  if (display) display.textContent = `${pct}%`;
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
    const bubble = $(".speech-bubble");
    if (bubble) bubble.innerHTML = mood.bubble[appLocale];
    // The current AI prompt is English-only. Keep the verified Indonesian
    // fallback on the default locale instead of replacing it with English.
    if (appLocale === "en") {
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
    streak.innerHTML = `<i class="icon">🔥</i> ${streakDays} ${t("days")}`;
    streak.style.display = streakDays > 0 ? "" : "none";
  }

  if (xpDelta > 0) fxXpGain(xpDelta);
  if (leveledUp) fxLevelUp(level);
  if (streakDelta > 0) fxStreakUp(streakDelta);

  prevXp = totalXp;
  prevLevel = level;
  prevStreak = streakDays;
}

function renderSensors(reading) {
  const updateVital = (name, width, value) => {
    const row = document.querySelector(`[data-vital="${name}"]`);
    if (!row) return;
    const fill = row.querySelector(".fill");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, width))}%`;
    const display = row.querySelector(".v-perc");
    if (display) display.textContent = value;
  };

  const temperature = Number(reading?.temperature);
  if (reading?.temperature != null && Number.isFinite(temperature)) {
    const label = `${temperature.toFixed(1)}°C`;
    updateVital("temperature", (temperature / 40) * 100, label);
  }

  const humidity = Number(reading?.humidity);
  if (reading?.humidity != null && Number.isFinite(humidity)) {
    updateVital("humidity", humidity, `${Math.round(humidity)}%`);
  }

  const soilPh = Number(reading?.soil_ph);
  if (reading?.soil_ph != null && Number.isFinite(soilPh)) {
    updateVital("soil-ph", (soilPh / 14) * 100, soilPh.toFixed(1));
  }

  const light = Number(reading?.light);
  if (reading?.light != null && (light === 0 || light === 1)) {
    updateVital("light", light * 100, light === 1 ? t("bright") : t("dark"));
  }

  const indoorParts = [];
  if (reading?.temperature != null && Number.isFinite(temperature)) indoorParts.push(`${temperature.toFixed(1)}°C`);
  if (reading?.humidity != null && Number.isFinite(humidity)) indoorParts.push(`${Math.round(humidity)}% RH`);
  if (indoorParts.length > 0) setText(".indoor-reading", `${t("weather.indoor")}: ${indoorParts.join(" · ")}`);
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
  const description = appLocale === "id" ? context.forecast.descriptionId : context.forecast.descriptionEn;
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
        .select("id, quest_key, status, xp_reward, completed_at")
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
      (payload) => trackQuest(payload.new),
    )
    .subscribe();

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
