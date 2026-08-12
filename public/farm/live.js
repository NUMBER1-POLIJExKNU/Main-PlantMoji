// PlantMoji live data binding for the team's pixel-farm page.
//
// The page markup/styles (index.html, style.css) are the designer's files,
// used AS-IS — this script only fills the existing elements with real data
// from Supabase (read-only publishable key + RLS) and keeps them fresh via
// Realtime with a polling fallback. No game logic lives here: the browser
// never decides XP or truth (handoff rules) — it only displays.

const PLANT_ID = "plant-01";
// Mirrors src/types/game.ts. One class period is 20–30 minutes and buys about
// 150–200 XP, so 15 XP a level is what makes the plant visibly change during
// the lesson; the level stops at 30 and total_xp keeps climbing past it.
const XP_PER_LEVEL = 15;
const MAX_BOND_LEVEL = 30;
const LOCALE_KEY = "plantmoji_locale";
const BADGE_EFFECT_STORAGE_KEY = "plantmoji_badge_effect_v1";
const BADGE_TAP_EFFECTS = {
  FIRST_RESCUE:["💚","✨","💚"], LIGHT_MASTER:["☀️","✨","🌟"], LEVEL_5_BOND:["💚","💛","💚"],
  COOL_KEEPER:["❄️","🧊","❄️"], PH_GUARDIAN:["🌱","✨","🌿"], STREAK_7:["🔥","7️⃣","🔥"],
  HUMIDITY_HERO:["💧","☁️","💦"], MOOD_SCHOLAR:["😊","😮","🤓"], CARE_VETERAN:["⭐","🌟","⭐"],
  CHRONICLER:["✏️","📓","✨"], STREAK_30:["🏆","✨","🌟"], LEVEL_10_BOND:["💛","👑","💛","✨"],
};

function activeBadgeEffect() {
  try { return localStorage.getItem(BADGE_EFFECT_STORAGE_KEY); } catch { return null; }
}

function spawnBadgeTapEffect(rect) {
  const key = activeBadgeEffect();
  const particles = BADGE_TAP_EFFECTS[key];
  if (!particles) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * .42;
  particles.forEach((glyph, index) => {
    const el = document.createElement("span");
    el.className = "badge-tap-particle";
    el.textContent = glyph;
    el.style.left = `${cx + (index - (particles.length - 1) / 2) * 34}px`;
    el.style.top = `${cy + Math.abs(index - 1) * 8}px`;
    el.style.setProperty("--tap-x", `${(index - (particles.length - 1) / 2) * 26}px`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  });
  return key === "LEVEL_10_BOND";
}

// STATIC farm-page strings, Bahasa Indonesia default with an EN toggle
// (restored dac0528 mechanism). DYNAMIC celebration copy lives in the
// central table `public/farm/strings.js` (window.PM_STRINGS, English this
// pass — Day-3 translation handles it), read defensively via PM() below.
// "JAMKACHU" and "PLANT MOJI" are proper nouns and are never translated.
const COPY = {
  id: {
    "nav.play": "DUNIAKU", "nav.tools": "ALAT", "nav.home": "Kebun Saya", "nav.quests": "Misi", "nav.plants": "Eksplor Tanaman", "nav.camera": "Kamera AI", "nav.memories": "Diari Tumbuh", "nav.status": "Pemantauan", "nav.collection": "Koleksi", "nav.shop": "Toko", "nav.reports": "Laporan", "nav.settings": "Pengaturan",
    "weather.loading": "Memuat prakiraan...",
    "weather.unavailable": "Prakiraan belum tersedia",
    "clock.label": "WAKTU JEMBER · WIB", "hud.status": "STATUS JAMKACHU", "hud.mission": "MISI HARI INI", "hud.bonus": "BONUS", "hud.quiz": "QUIZ HARI INI",
    "focus.now": "SEKARANG", "focus.step.sense": "LIHAT", "focus.step.senseHint": "Baca kondisinya", "focus.step.act": "LAKUKAN", "focus.step.actHint": "Ubah satu hal", "focus.step.verify": "CEK", "focus.step.verifyHint": "Sensor membuktikan", "focus.proof": "Tombol ini hanya memberi petunjuk. Sensor asli yang memeriksa perawatanmu.",
    "focus.waiting.title": "Hubungkan sensor", "focus.waiting.summary": "Nilai akan muncul otomatis saat perangkat tersambung.", "focus.waiting.action": "Periksa koneksi perangkat 🔌", "focus.waiting.why": "Pastikan perangkat menyala dan Arduino terhubung ke Node-RED. Nilai akan muncul sendiri—kamu tidak perlu menyegarkan halaman.",
    "focus.healthy.title": "Jamkachu nyaman", "focus.healthy.summary": "Semua kondisi aman. Tidak ada tindakan yang perlu dilakukan sekarang.",
    "focus.action.title": "Bantu Jamkachu sekarang", "focus.action.summary": "Lakukan satu tindakan di bawah, lalu biarkan sensor melihat perubahannya.",
    "focus.verifying.title": "Pertahankan kondisinya", "focus.verifying.summary": "Perawatanmu terlihat. Jangan ubah apa pun dulu saat sensor memeriksa.",
    "guide.title": "CARA BERMAIN", "guide.sense": "1 · Lihat sensor", "guide.understand": "2 · Dengar Jamkachu", "guide.act": "3 · Ubah satu hal kecil", "guide.verify": "4 · Sensor cek, hadiah tumbuh", "guide.grow": "Rawat aku — aku tumbuh dari benih sampai berbuah!", "guide.start": "AYO MULAI!",
    "env.title": "KONDISI KEBUN", "env.details": "Lihat detail ›", "env.temperature": "SUHU", "env.humidity": "UDARA", "env.light": "CAHAYA", "env.ph": "TANAH", "env.ok": "Aman", "env.check": "Perlu dicek", "env.last": "terakhir", "npc.ai": "CHAT AI",
    "quest.none": "Misi muncul saat sensorku merasakan perubahan",
    "quest.verifying": "memverifikasi…",
    "quest.min": "menit",
    "mood.Happy": "Senang",
    "mood.Overheating": "Kepanasan",
    "mood.TooCold": "Kedinginan",
    "mood.DryAir": "Udara Kering",
    "mood.HumidAir": "Udara Lembap",
    "mood.Sleepy": "Mengantuk",
    "mood.SoilAcidic": "Tanah Asam",
    "mood.SoilAlkaline": "Tanah Basa",
    "bubble.Happy": "Aku merasa sehat banget!<br>Terima kasih sudah merawatku.",
    "bubble.Overheating": "Aku kepanasan...<br>bantu sejukkan aku, ya!",
    "bubble.TooCold": "Brrr, aku kedinginan...<br>bantu hangatkan aku, ya!",
    "bubble.DryAir": "Udaranya kering...<br>boleh bantu lembapkan sedikit?",
    "bubble.HumidAir": "Udaranya pengap...<br>boleh beri aliran udara?",
    "bubble.Sleepy": "Gelap sekali... aku mengantuk.<br>Boleh tambah cahaya?",
    "bubble.SoilAcidic": "Tanahku terasa terlalu asam...<br>ajak guru cek pH-nya, ya!",
    "bubble.SoilAlkaline": "Tanahku terasa terlalu basa...<br>ajak guru cek pH-nya, ya!",
    "quest.KEEP_ME_HAPPY": "Jaga Aku Tetap Sehat",
    "quest.STAY_COMFY": "Tetap Nyaman",
    "quest.COOL_ME_DOWN": "Sejukkan Aku",
    "quest.WARM_ME_UP": "Hangatkan Aku",
    "quest.GIVE_ME_MORE_LIGHT": "Beri Aku Cahaya",
    "quest.HUMIDIFY_MY_AIR": "Lembapkan Udaraku",
    "quest.DEHUMIDIFY_MY_AIR": "Keringkan Udaraku",
    "quest.BALANCE_SOIL_ACIDIC": "Seimbangkan Tanahku",
    "quest.BALANCE_SOIL_ALKALINE": "Seimbangkan Tanahku",
    bright: "Terang",
    dark: "Gelap",
    days: "Hari",
    bond: "Ikatan",
    levelUp: "NAIK LEVEL!",
    carePays: "perawatanmu membuahkan hasil",
    questComplete: "Misi selesai!",
  },
  en: {
    "nav.play": "MY WORLD", "nav.tools": "TOOLS", "nav.home": "My Garden", "nav.quests": "Quests", "nav.plants": "Crop Explorer", "nav.camera": "Camera AI", "nav.memories": "Growth Diary", "nav.status": "Monitoring", "nav.collection": "Collection", "nav.shop": "Shop", "nav.reports": "Reports", "nav.settings": "Settings",
    "weather.loading": "Loading forecast...",
    "weather.unavailable": "Forecast unavailable",
    "clock.label": "JEMBER TIME · WIB", "hud.status": "JAMKACHU STATUS", "hud.mission": "TODAY'S MISSION", "hud.bonus": "BONUS", "hud.quiz": "TODAY'S QUIZ",
    "focus.now": "RIGHT NOW", "focus.step.sense": "LOOK", "focus.step.senseHint": "Read the condition", "focus.step.act": "DO", "focus.step.actHint": "Change one thing", "focus.step.verify": "CHECK", "focus.step.verifyHint": "Sensors prove it", "focus.proof": "This button only gives guidance. Real sensors check your care.",
    "focus.waiting.title": "Connect the sensors", "focus.waiting.summary": "Values will appear automatically when the device connects.", "focus.waiting.action": "Check the device connection 🔌", "focus.waiting.why": "Make sure the device is powered and Arduino is connected to Node-RED. Values will appear on their own—no refresh needed.",
    "focus.healthy.title": "Jamkachu is comfortable", "focus.healthy.summary": "Every condition is safe. Nothing needs changing right now.",
    "focus.action.title": "Help Jamkachu now", "focus.action.summary": "Do the one action below, then let the sensors see the change.",
    "focus.verifying.title": "Keep it steady", "focus.verifying.summary": "Your care was noticed. Do not change anything while the sensors check.",
    "guide.title": "HOW TO PLAY", "guide.sense": "1 · Check the sensors", "guide.understand": "2 · Listen to Jamkachu", "guide.act": "3 · Change one small thing", "guide.verify": "4 · Sensors check, rewards grow", "guide.grow": "Care for me — I grow from a seed all the way to fruit!", "guide.start": "LET'S GROW!",
    "env.title": "GARDEN VITALS", "env.details": "View details ›", "env.temperature": "TEMP", "env.humidity": "HUMIDITY", "env.light": "LIGHT", "env.ph": "SOIL", "env.ok": "OK", "env.check": "Check", "env.last": "last", "npc.ai": "AI CHAT",
    "quest.none": "Missions appear when my sensors feel a change",
    "quest.verifying": "verifying…",
    "quest.min": "min",
    "mood.Happy": "Happy",
    "mood.Overheating": "Overheating",
    "mood.TooCold": "Too Cold",
    "mood.DryAir": "Dry Air",
    "mood.HumidAir": "Humid Air",
    "mood.Sleepy": "Sleepy",
    "mood.SoilAcidic": "Acidic",
    "mood.SoilAlkaline": "Alkaline",
    "bubble.Happy": "I'm feeling so healthy!<br>Thanks for the care.",
    "bubble.Overheating": "It's too hot...<br>please cool me down!",
    "bubble.TooCold": "Brrr, it's too cold...<br>please warm me up!",
    "bubble.DryAir": "The air feels so dry...<br>a little humidity, please?",
    "bubble.HumidAir": "The air feels muggy...<br>a little airflow, please?",
    "bubble.Sleepy": "It's so dark... I'm sleepy.<br>More light, please!",
    "bubble.SoilAcidic": "My soil feels too acidic...<br>ask a teacher to check its pH!",
    "bubble.SoilAlkaline": "My soil feels too alkaline...<br>ask a teacher to check its pH!",
    "quest.KEEP_ME_HAPPY": "Keep Me Happy",
    "quest.STAY_COMFY": "Stay Comfy",
    "quest.COOL_ME_DOWN": "Cool Me Down",
    "quest.WARM_ME_UP": "Warm Me Up",
    "quest.GIVE_ME_MORE_LIGHT": "Give Me More Light",
    "quest.HUMIDIFY_MY_AIR": "Humidify My Air",
    "quest.DEHUMIDIFY_MY_AIR": "Dry My Air",
    "quest.BALANCE_SOIL_ACIDIC": "Balance My Soil",
    "quest.BALANCE_SOIL_ALKALINE": "Balance My Soil",
    bright: "Bright",
    dark: "Dark",
    days: "Days",
    bond: "Bond",
    levelUp: "LEVEL UP!",
    carePays: "your care is paying off",
    questComplete: "Quest complete!",
  },
};

// ── Appearance: theme + world skin ──────────────────────────────────────
// The React routes render AppearanceControls for this; "/" is rewritten to
// the static shell and never runs it, so My Garden — the screen the skin is
// actually about — had neither the controls nor the effect. Same cookie and
// localStorage keys as src/lib/appearance.ts, so a choice made on either side
// holds on the other. Kept in step by tests/farm-appearance.test.ts.
const THEME_KEY = "plantmoji_theme";
const SKIN_KEY = "plantmoji_skin";
const APPEARANCE_MAX_AGE = 31_536_000;
const FARM_THEMES = ["auto", "day", "night"];
const THEME_LABELS = {
  id: { auto: "Otomatis", day: "Siang", night: "Malam" },
  en: { auto: "Auto", day: "Day", night: "Night" },
};
// Row captions. Matches AppearanceControls' wording on the React routes.
const APPEARANCE_LABELS = {
  id: { theme: "WAKTU", skin: "LATAR" },
  en: { theme: "THEME", skin: "SKIN" },
};
const FARM_SKIN_CATALOG = [
  { key: "jember-farm", icon: "🌱", id: "Kebun Jember", en: "Jember Farm" },
  { key: "coffee-hills", icon: "☕", id: "Bukit Kopi", en: "Coffee Hills" },
  { key: "greenhouse", icon: "🏡", id: "Rumah Kaca", en: "Greenhouse" },
  { key: "tobacco-fields", icon: "🍃", id: "Ladang Tembakau", en: "Tobacco Fields" },
  { key: "kakao-garden", icon: "🍫", id: "Kebun Kakao", en: "Kakao Garden" },
  { key: "paddy-morning", icon: "🌾", id: "Pagi di Sawah", en: "Paddy Morning" },
  { key: "puger-coast", icon: "🌊", id: "Pantai Puger", en: "Puger Coast" },
  { key: "argopuro-highlands", icon: "⛰️", id: "Dataran Argopuro", en: "Argopuro Highlands" },
];

/** Cookie first (what the server rendered from), then localStorage. */
function readAppearanceValue(key, allowed, fallback) {
  try {
    const cookie = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${key}=`));
    const fromCookie = cookie?.split("=")[1];
    if (fromCookie && allowed.includes(fromCookie)) return fromCookie;
    const stored = window.localStorage.getItem(key);
    if (stored && allowed.includes(stored)) return stored;
  } catch {}
  return fallback;
}

function readFarmTheme() { return readAppearanceValue(THEME_KEY, FARM_THEMES, "auto"); }
function readFarmSkin() { return readAppearanceValue(SKIN_KEY, FARM_SKIN_CATALOG.map((s) => s.key), "jember-farm"); }

/** Paint the choice onto <html>, where style.css's skin blocks hang. */
function applyFarmAppearance() {
  const root = document.documentElement;
  if (!root) return;
  root.dataset.themePreference = readFarmTheme();
  root.dataset.farmSkin = readFarmSkin();
  applyNightUi(); // theme decides day/night, so the sky follows immediately
}

function initFarmAppearance() {
  const themeSelect = $("#farm-theme");
  const skinSelect = $("#farm-skin");
  const labels = THEME_LABELS[appLocale] ?? THEME_LABELS.en;
  const captions = APPEARANCE_LABELS[appLocale] ?? APPEARANCE_LABELS.en;
  for (const el of document.querySelectorAll("[data-appearance-label]")) {
    const caption = captions[el.getAttribute("data-appearance-label")];
    if (caption) el.textContent = caption;
  }
  if (themeSelect) {
    themeSelect.innerHTML = FARM_THEMES
      .map((value) => `<option value="${value}">${labels[value]}</option>`)
      .join("");
    themeSelect.value = readFarmTheme();
    themeSelect.addEventListener("change", () => {
      writeAppearance(THEME_KEY, themeSelect.value);
      applyFarmAppearance();
    });
  }
  if (skinSelect) {
    skinSelect.innerHTML = FARM_SKIN_CATALOG
      .map((skin) => `<option value="${skin.key}">${skin.icon} ${appLocale === "id" ? skin.id : skin.en}</option>`)
      .join("");
    skinSelect.value = readFarmSkin();
    skinSelect.addEventListener("change", () => {
      writeAppearance(SKIN_KEY, skinSelect.value);
      applyFarmAppearance();
    });
  }
  applyFarmAppearance();
}

function writeAppearance(key, value) {
  document.cookie = `${key}=${value}; path=/; max-age=${APPEARANCE_MAX_AGE}; samesite=lax`;
  try { window.localStorage.setItem(key, value); } catch {}
}

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

const MOODS = Object.fromEntries(["Happy", "Overheating", "TooCold", "DryAir", "HumidAir", "Sleepy", "SoilAcidic", "SoilAlkaline"].map((key) => [key, { key }]));
// Localized speech-bubble template for a mood: the central strings.js table
// (PM_STRINGS.moodBubbles, en+id parity-tested) first, then the local COPY
// dictionary — whose en tree is the last-resort English fallback via t().
const moodBubble = (mood) => {
  const key = mood?.key ?? "Happy";
  return PM().moodBubbles?.[key] ?? t(`bubble.${key}`);
};
// Localized quest title for the MISI HARI INI slot + quest-complete banner:
// strings.js questTitles (id names verbatim from src/lib/i18n.ts
// QUEST_COPY_ID) first, then the local COPY dictionary's English fallback.
const questTitle = (questKey) => PM().questTitles?.[questKey] ?? t(`quest.${questKey}`);

// HP is a friendly summary of the plant's CURRENT mood — the only honest
// health signal we have (no invented numbers). Happy = full HP; needs-care
// moods reduce it. Display-only, like everything else in this file.
const HP_BY_MOOD = {
  Happy: 100,
  DryAir: 70,
  HumidAir: 70,
  Sleepy: 70,
  Overheating: 55,
  TooCold: 55,
  SoilAcidic: 55,
  SoilAlkaline: 55,
};

// Display metadata for quest keys (mirrors src/game/quests/quest-definitions.ts).
// targetMin only on 'maintain' quests — drives the "23/30 min" progress in the
// home quest slot (renderQuestSlot); recovery quests show a verifying state.
const QUEST_META = {
  KEEP_ME_HAPPY: { emoji: "🌱", art: "/icons/quests/keep-me-happy.png", targetMin: 30 },
  STAY_COMFY: { emoji: "🛋️", art: "/icons/quests/stay-comfy.png", targetMin: 120 },
  COOL_ME_DOWN: { emoji: "❄️", art: "/icons/quests/cool-me-down.png" }, WARM_ME_UP: { emoji: "🧣", art: "/icons/quests/warm-me-up.png" },
  GIVE_ME_MORE_LIGHT: { emoji: "☀️", art: "/icons/quests/give-me-more-light.png" }, HUMIDIFY_MY_AIR: { emoji: "💦", art: "/icons/quests/humidify-my-air.png" },
  DEHUMIDIFY_MY_AIR: { emoji: "🌬️", art: "/icons/quests/dehumidify-my-air.png" }, BALANCE_SOIL_ACIDIC: { emoji: "🧪", art: "/icons/quests/balance-soil-acidic.png" },
  BALANCE_SOIL_ALKALINE: { emoji: "🧪", art: "/icons/quests/balance-soil-alkaline.png" },
};

// Mood word + emoji shown under the character name (#char-mood). Words come
// from PM_STRINGS.moods when available; these are the verbatim fallbacks.
const MOOD_WORDS = { Happy: "Happy", Overheating: "Overheating", TooCold: "Too Cold", DryAir: "Dry Air", HumidAir: "Humid Air", Sleepy: "Sleepy", SoilAcidic: "Acidic", SoilAlkaline: "Alkaline" };
const MOOD_EMOJI = { Happy: "😊", Overheating: "🥵", TooCold: "🥶", DryAir: "😵", HumidAir: "💧", Sleepy: "😴", SoilAcidic: "🤢", SoilAlkaline: "😖" };
// Mood state → face-swap class on .mascot-svg ("face-happy" has no CSS rule
// on purpose: with no variant class matched, the default happy group shows).
const MOOD_FACE = { Happy: "face-happy", Overheating: "face-hot", TooCold: "face-cold", DryAir: "face-dry", HumidAir: "face-humid", Sleepy: "face-sleepy", SoilAcidic: "face-acidic", SoilAlkaline: "face-alkaline" };

// Sensor HUD stat-tile pulse (2026-08-09 spec): which env-hud-card a problem
// mood pulses, and in what color. This is the SAME mood state the mascot
// face above reads — never a client-side re-derivation from raw thresholds
// — so the tile and the face can never disagree about what's wrong.
const MOOD_TILE_KIND = { Overheating: "temp", TooCold: "temp", DryAir: "hum", HumidAir: "hum", Sleepy: "light", SoilAcidic: "ph", SoilAlkaline: "ph" };
const MOOD_TILE_COLOR = { Overheating: "#e2643c", TooCold: "#7fb8d6", DryAir: "#e2a23c", HumidAir: "#6fa89c", Sleepy: "#6f6ac2", SoilAcidic: "#8fae3f", SoilAlkaline: "#c2618a" };

// ── "This one is moving" emphasis on the vitals tiles ───────────────────
// A care action in the demo sandbox changes a reading, and the tile that
// answered has to be findable at a glance from the back of a classroom.
//
// Deliberately NOT another blink: .is-mood-pulse already blinks a tile when
// its reading is out of comfort, and a second blink would make both
// meaningless — you could no longer tell "this is wrong" from "this is
// moving". These use three channels that were free, all steady rather than
// flashing, so a value easing for ten seconds looks calm instead of strobing:
//   · a trail on the gauge from where the value started to where it is now
//   · a chip with the running total change (▲ +2.4°C)
//   · a steady glow on the card border
//
// One "episode" spans a whole movement: it begins on the first meaningful
// change, keeps its starting point while the value keeps moving, and ends
// after ~700ms of quiet. So a held toggle shows the total journey, and a
// single press shows its one step.

/** Smallest change worth shouting about, per tile — keeps a real sensor's
 *  jitter from lighting the board up every ten seconds. */
const VITAL_EMPHASIS_EPSILON = { temp: 0.2, hum: 1, light: 2, ph: 0.05 };
const VITAL_EMPHASIS_UNIT = { temp: "°C", hum: "%", light: "%", ph: "" };
const VITAL_EMPHASIS_DECIMALS = { temp: 1, hum: 0, light: 0, ph: 1 };
const VITAL_EMPHASIS_END_MS = 700;
const vitalEpisode = {}; // kind -> { base, baseLeft, last, timer }

function formatVitalDelta(kind, delta) {
  const digits = VITAL_EMPHASIS_DECIMALS[kind] ?? 1;
  const arrow = delta > 0 ? "▲" : "▼";
  return `${arrow} ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(digits)}${VITAL_EMPHASIS_UNIT[kind] ?? ""}`;
}

function endVitalEpisode(kind) {
  const card = $(`[data-vital="${kind}"]`);
  delete vitalEpisode[kind];
  if (!card) return;
  card.classList.remove("is-changing", "is-rising", "is-falling");
  card.querySelector(".env-hud-delta")?.remove();
  const trail = card.querySelector(".env-gauge-trail");
  if (trail) trail.hidden = true;
}

/**
 * Mark `kind` as moving. `fromLeft`/`toLeft` are the gauge marker's position
 * before and after this update, in percent — taken from the marker itself so
 * the trail never needs its own copy of the domain maths.
 */
function emphasiseVital(kind, value, fromLeft, toLeft) {
  const card = $(`[data-vital="${kind}"]`);
  if (!card || !Number.isFinite(value)) return;
  const episode = vitalEpisode[kind];
  const epsilon = VITAL_EMPHASIS_EPSILON[kind] ?? 0.1;
  if (!episode) {
    // Nothing to compare against yet: remember this reading and stay quiet.
    vitalEpisode[kind] = { base: value, baseLeft: fromLeft, last: value, timer: null, live: false };
    return;
  }
  if (Math.abs(value - episode.last) < epsilon) return; // jitter, or settled
  episode.last = value;
  if (!episode.live) {
    // First real movement — this is where the journey started.
    episode.live = true;
    episode.base = episode.base ?? value;
    episode.baseLeft = Number.isFinite(fromLeft) ? fromLeft : toLeft;
  }

  const delta = value - episode.base;
  card.classList.add("is-changing");
  // Which edge the glow hugs is the third direction cue, after the trail's
  // gradient and the chip's fill — light spills down from the top as a reading
  // climbs and up from the bottom as it drops.
  card.classList.toggle("is-rising", delta > 0);
  card.classList.toggle("is-falling", delta < 0);
  let chip = card.querySelector(".env-hud-delta");
  if (!chip) {
    chip = document.createElement("b");
    chip.className = "env-hud-delta";
    card.appendChild(chip);
  }
  chip.textContent = formatVitalDelta(kind, delta);
  chip.classList.toggle("is-down", delta < 0);

  const gauge = card.querySelector(".env-gauge");
  if (gauge && Number.isFinite(episode.baseLeft) && Number.isFinite(toLeft)) {
    let trail = gauge.querySelector(".env-gauge-trail");
    if (!trail) {
      trail = document.createElement("i");
      trail.className = "env-gauge-trail";
      gauge.appendChild(trail);
    }
    const from = Math.max(0, Math.min(100, episode.baseLeft));
    const to = Math.max(0, Math.min(100, toLeft));
    trail.style.left = `${Math.min(from, to)}%`;
    trail.style.width = `${Math.abs(to - from)}%`;
    // Direction lives in the trail's shape, never in a second colour: it fades
    // out at where the value started and goes solid at where it is now, so the
    // solid end is always the head of the movement.
    trail.classList.toggle("is-down", delta < 0);
    trail.hidden = false;
  }

  if (episode.timer) clearTimeout(episode.timer);
  episode.timer = setTimeout(() => endVitalEpisode(kind), VITAL_EMPHASIS_END_MS);
}

/** Pulses the one env-hud-card matching `mood` (mascot's real mood) in that
 *  mood's color; clears the pulse from every other tile. Happy (or any mood
 *  with no tile mapping) clears all four — nothing pulses while comfortable. */
function applyMoodPulse(mood) {
  const targetKind = MOOD_TILE_KIND[mood];
  const color = MOOD_TILE_COLOR[mood];
  for (const kind of ["temp", "hum", "light", "ph"]) {
    const card = $(`[data-vital="${kind}"]`);
    if (!card) continue;
    // The persisted mood can lag behind the newest sensor snapshot. Never
    // paint a warning pulse over a card whose current deterministic reading
    // says Stable/In range — that would show two contradictory truths.
    if (kind === targetKind && card.classList.contains("is-alert")) {
      card.style.setProperty("--pulse-color", color);
      card.classList.add("is-mood-pulse");
    } else {
      card.classList.remove("is-mood-pulse");
    }
  }
}

/** Swap Jamkachu's drawn expression + identity line (#char-mood) to the
 *  given mood. Same body, same pot — only the expression changes (spec
 *  §2.2). The face-* classes stay on the container as the state channel;
 *  the visible face is the designer sprite via PMSprite (kiki design
 *  integration — jamkachu-sprite.js maps mood→drawn frame). */
function setMascotMood(state) {
  clearPetExpression(); // a stale tap-reaction flash never outlives a mood change
  const svg = $(".mascot-svg");
  if (svg) {
    svg.classList.remove("expr-curious", "expr-proud", "expr-giggle");
    for (const cls of Object.values(MOOD_FACE)) svg.classList.remove(cls);
    svg.classList.add(MOOD_FACE[state] ?? "face-happy");
  }
  window.PMSprite?.set({ mood: MOODS[state] ? state : "Happy" });
  // Mood word goes through the active locale dictionary first; unknown
  // states fall back to the English word (PM_STRINGS, then local table).
  const moodWord = COPY[appLocale][`mood.${state}`] ?? PM().moods?.[state] ?? MOOD_WORDS[state] ?? String(state ?? "");
  const moodEmoji = PM().moodEmoji?.[state] ?? MOOD_EMOJI[state] ?? "😊";
  const moodEl = $("#char-mood");
  if (moodEl) moodEl.textContent = `${moodWord} ${moodEmoji}`;
  // The word inside the thought bubble, under the badge that pictures the same
  // mood. No emoji here: the badge directly above it already is the picture.
  // (jamkachu-sprite.js owns the bubble's own hidden state and the badge art.)
  const moodWordEl = $("#mood-word");
  if (moodWordEl) moodWordEl.textContent = moodWord;
  applyMoodPulse(state);
  // Contextual care button + night sleep (spec §6.1/§6.2): every mood
  // render re-derives the one safe action and the sleep presentation —
  // the label is state, not a celebration, so it must always be correct.
  careMood = state ?? "Happy";
  updateCareUi();
}
// DevTools/demo handle (display-only; grants nothing). The wrapper also
// resets the real-mood diff tracker: renderPlant only repaints when
// `current_state !== lastMoodFetched`, so without the reset a demo-cycled
// face would stick forever (poll/realtime see "no change"). Nulling it
// makes the next real render re-apply truth wholesale — face, HP, bubble,
// care button, and the sleep evaluation all come back from real data.
window.setMascotMood = (state) => {
  setMascotMood(state);
  lastMoodFetched = null;
};

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
let currentCompanionStage = "Seed";
const DIALOGUE_RECENT_KEY = "pm_dialogue_recent_v1";
const DIALOGUE_RECENT_LIMIT = 20;

// Stage ladder — derived from window.PM_LADDER (companion-ladder.js, loaded
// before this module; parity-tested against src/types/game.ts
// COMPANION_LADDER). Every stage-order lookup in this file (rank
// comparisons, the evolution ceremony's silhouette swap) derives from this
// ONE array. The literal fallback exists only for stub environments where
// the ladder script tag is missing — same 10 names, same order.
const STAGE_ORDER =
  Array.isArray(window.PM_LADDER) && window.PM_LADDER.length > 0
    ? window.PM_LADDER.map((row) => row.stage)
    : ["Seed", "Sprout", "Seedling", "Bud", "Bloom", "Fruit", "Guardian", "Elder", "Radiant", "Legend"];

// One-time-per-stage guard for the evolution ceremony (Pokémon-Style
// Transformation FX plan, Task 4): a single localStorage flag naming the
// last "<cycle>:<stage>" the ceremony has already played for (cycle-aware
// per the evolution-ladder plan, Task 7 — a future rebirth cycle reaching
// the same stage celebrates again), so a duplicate/replayed companion_state
// row (a flaky realtime reconnect, a poll repeat) can never replay the ~7s
// sequence twice for the same real evolution.
const EVO_SEEN_KEY = "pm_evo_seen";
let prevCompanionStage = null; // null = not yet rendered (first render never celebrates)

// Demo-preview ladder cursor for PMFx.evolve(): repeated presses of the E
// hotkey walk consecutive ceremonies up ALL ten stages instead of replaying
// the same pair (the real currentCompanionStage only moves on data renders).
// null = no preview active; any real renderCompanion() resets it, because
// real companion_state always wins over a presentation preview.
let evoDemoStage = null;

// Captured from renderBond's `plantName` arg — the evolution ceremony's
// dialog (below) needs a display name outside main()'s closure-local
// `plantName` variable.
let lastPlantName = null;

// True once the first ONLINE refresh() painted real data — the bottom-of-file
// main().catch must never repaint fabricated offline defaults over it.
let firstOnlinePaint = false;

/** Display name for ceremony dialog, same fallback as the hatching intro. */
function currentPlantName() {
  return lastPlantName || "Jamkachu";
}

// ── Cosmetic companion skins (milestone20, display-only) ────────────────
// Jember-crop looks unlocked by bond level: renderCompanion swaps ONE
// skin-<key> palette class on .mascot-svg from companion_state.skin_key,
// and the wardrobe panel (below the farm guide wiring) writes the choice
// via /api/companion-skin. Skins never grant or gate XP, seeds, quests,
// evolution, or sensors — pure presentation, never a celebration.
let currentSkinKey = "jamkachu";
// Latest bond_state.bond_level seen by renderBond — the wardrobe lock
// states read it. Starts at 1 (worst case a skin briefly shows locked
// until the first bond render; the server re-checks every pick anyway).
let lastBondLevel = 1;

/** Catalog-normalize a companion_state.skin_key: unknown keys, a missing
 *  milestone20 column (undefined), and a missing catalog script all resolve
 *  to the default "jamkachu" — a pre-milestone20 DB renders exactly as
 *  before the milestone existed. */
function normalizeSkinKey(key) {
  const skins = window.PM_SKINS?.skins;
  return Array.isArray(skins) && skins.some((skin) => skin?.key === key) ? key : "jamkachu";
}

/** Idempotently swap the skin-<key> palette class on .mascot-svg — same
 *  remove-then-add pattern as renderCompanion's companion-<Stage> swap. */
function applySkinClass(key) {
  const next = normalizeSkinKey(key);
  const changed = next !== currentSkinKey;
  currentSkinKey = next;
  const svg = $(".mascot-svg");
  if (svg) {
    for (const cls of [...svg.classList]) {
      if (cls.startsWith("skin-")) svg.classList.remove(cls);
    }
    svg.classList.add(`skin-${next}`);
  }
  // The visible skin is a pot-palette swap on the designer sprite now
  // (jamkachu-sprite.js SKIN_RAMPS); the skin-<key> class above stays as a
  // harmless state channel.
  window.PMSprite?.set({ skinKey: next });
  // Only a REAL change repaints an open wardrobe list (selection marker) —
  // the 15s poll re-confirming the same skin must not rebuild the buttons
  // under the user's finger.
  if (changed) refreshWardrobeIfOpen();
}

function chooseFreshDialogue(candidates) {
  const lines = [...new Set((Array.isArray(candidates) ? candidates : []).filter((line) => typeof line === "string" && line.trim()))];
  if (!lines.length) return null;
  let recent = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DIALOGUE_RECENT_KEY) || "[]");
    if (Array.isArray(parsed)) recent = parsed.filter((line) => typeof line === "string").slice(-DIALOGUE_RECENT_LIMIT);
  } catch {}
  const available = lines.filter((line) => !recent.includes(line));
  const line = (available.length ? available : lines)[Math.floor(Math.random() * (available.length || lines.length))];
  try {
    localStorage.setItem(DIALOGUE_RECENT_KEY, JSON.stringify([...recent.filter((item) => item !== line), line].slice(-DIALOGUE_RECENT_LIMIT)));
  } catch {}
  return line;
}

/** Honest next-stage progress line under the identity label (evolution-
 *  ladder plan, Task 5). Reads ONLY companion_state counters written by the
 *  backend sweep + the display-only ladder mirror — when the ladder script
 *  or the milestone16 counter columns are missing, the line hides entirely
 *  rather than inventing numbers. Presentation only, zero writes. */
function renderCompanionNext(stage, state) {
  const next = $("#companion-next");
  if (!next) return;
  if (typeof window.PM_NEXT_STAGE !== "function") {
    next.textContent = ""; // ladder mirror not loaded: hide, never guess
    return;
  }
  const req = window.PM_NEXT_STAGE(stage);
  if (!req) {
    // Top of the ladder (Legend) — a quiet "fully grown" line instead.
    next.textContent = PM().companionMax ?? "";
    return;
  }
  const haveCounts = Number.isFinite(state.care_count) && Number.isFinite(state.day_count);
  if (!haveCounts) {
    next.textContent = ""; // pre-milestone16 DB: counters absent — hide
    return;
  }
  // Player-facing progress shows what remains, not raw backend counters.
  // Completed requirements disappear; over-complete values never render 5/4.
  // Text diet: only the NEAREST unmet requirement renders — one clear next
  // step beats a three-part sentence nobody reads.
  const segments = [];
  const careLeft = Math.max(0, req.care - state.care_count);
  const daysLeft = Math.max(0, req.days - state.day_count);
  const affinityLeft = Number.isFinite(state.affinity_count) ? Math.max(0, req.affinities - state.affinity_count) : 0;
  if (careLeft > 0) segments.push(appLocale === "id" ? `${careLeft} perawatan lagi` : (careLeft === 1 ? "1 more care action" : `${careLeft} more care actions`));
  if (req.affinities > 0 && Number.isFinite(state.affinity_count)) {
    if (affinityLeft > 0) segments.push(appLocale === "id" ? `coba ${affinityLeft} jenis perawatan lagi` : (affinityLeft === 1 ? "try 1 more care type" : `try ${affinityLeft} more care types`));
  }
  if (daysLeft > 0) segments.push(appLocale === "id" ? `${daysLeft} hari lagi` : (daysLeft === 1 ? "1 more day" : `${daysLeft} more days`));
  const parts = segments.filter((part) => typeof part === "string" && part);
  const stageName = PM().companionStage?.[req.stage] ?? req.stage;
  next.textContent = parts.length
    ? `${appLocale === "id" ? "BERIKUTNYA" : "NEXT"}: ${stageName} · ${parts[0]}`
    : `${appLocale === "id" ? "SIAP BEREVOLUSI" : "READY TO EVOLVE"} → ${stageName}`;
}

function renderCompanion(state) {
  if (!state || typeof state.stage !== "string") return; // migration absent: preserve the original mascot
  const stage = STAGE_ORDER.includes(state.stage) ? state.stage : "Seed";
  currentCompanionStage = stage;
  const form = typeof state.form_key === "string" && state.form_key ? state.form_key : "balanced";
  const label = $("#companion-stage");
  if (label) {
    const stageName = PM().companionStage?.[stage] ?? stage;
    const stageNumber = STAGE_ORDER.indexOf(stage) + 1;
    label.textContent = `${stageName.toUpperCase()} · ${appLocale === "id" ? "TAHAP" : "STAGE"} ${stageNumber}/${STAGE_ORDER.length}`;
  }
  const svg = $(".mascot-svg");
  if (svg) {
    for (const value of STAGE_ORDER) svg.classList.remove(`companion-${value}`);
    svg.classList.add(`companion-${stage}`);
    svg.dataset.companionForm = form;
  }
  // Designer sprite: the stage picks the drawn growth phase (stage→phase
  // table in jamkachu-sprite.js); late-stage differentiation stays via the
  // --companion-accent aura + decor + ceremony.
  window.PMSprite?.set({ stage });
  // Cosmetic skin (milestone20): swap the skin-<key> palette class from
  // companion_state.skin_key. An undefined skin_key (pre-milestone20 DB or
  // the legacy column fallback select) behaves exactly like "jamkachu".
  applySkinClass(state.skin_key);
  renderCompanionNext(stage, state);
  evoDemoStage = null; // real data render: the E-hotkey preview cursor resets
  // Evolution ceremony trigger (evolution-ladder plan, Task 7): a real RANK
  // INCREASE past the first render fires the T5 ceremony once per
  // cycle+stage. Never fires on the first render (prevCompanionStage starts
  // null), a same-stage repeat, or backward (the engine never demotes).
  const priorStage = prevCompanionStage;
  prevCompanionStage = stage;
  if (priorStage !== null && STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(priorStage)) {
    const seenKey = `${state.cycle ?? 1}:${stage}`;
    let seen = null;
    try { seen = localStorage.getItem(EVO_SEEN_KEY); } catch {}
    if (seen !== seenKey) {
      // Marked BEFORE the ceremony plays — crash-safe, no double ceremony.
      try { localStorage.setItem(EVO_SEEN_KEY, seenKey); } catch {}
      fxEvolve(priorStage, stage);
    }
  }
}

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
    // Tapping the already-active locale is a no-op: a reload here would
    // silently discard queued/pending celebrations (an unclaimed pod, a
    // deferred lucky stamp) for zero benefit. aria-pressed is already
    // correct from applyLocale(), and nothing needs re-writing.
    if (next === appLocale) return;
    document.cookie = `${LOCALE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    try { window.localStorage.setItem(LOCALE_KEY, next); } catch {}
    window.location.reload();
  });
});
applyLocale();
// initFarmAppearance() is deliberately NOT called here: it ends up in
// applyNightUi, which reads consts declared much further down this file, and
// calling it this early threw a temporal-dead-zone ReferenceError that killed
// the whole module — every screen on My Garden stayed on its markup defaults.
// It runs at the bottom instead, once everything exists.

// ── Unified seen-store bridge (public/farm/seen.js → window.PMSeen) ─────
// Every one-time moment on the farm (hatch "hatch", tour "tour", guide
// "guide.farm", tile invite "tiles.tried", future "dare.*"/"coach.*")
// reads and writes ONLY the pm_seen_v3 blob through these two helpers.
// seen.js migrated the legacy per-flag keys on its first read — live.js
// never touches them again. Fail-closed: a missing script or unreadable
// storage reports everything as SEEN, so a one-time moment can never
// replay forever (the same silence the old per-flag guards kept).
function pmSeenFlag(id) {
  try {
    return window.PMSeen ? window.PMSeen.seen(id) === true : true;
  } catch {
    return true;
  }
}
function pmMarkSeen(id) {
  try {
    window.PMSeen?.markSeen(id);
  } catch {}
}

// One small first-use guide, always reopenable with ?. Imperative dialog
// state keeps it independent of sensor/network initialization.
const farmGuide = $("#farm-guide");
const openFarmGuide = () => {
  if (typeof farmGuide?.showModal !== "function") return;
  // The "how I grow" art follows the live tier + mood on every open.
  renderGuideGrowth();
  farmGuide.showModal();
};
$("#farm-guide-open")?.addEventListener("click", openFarmGuide);
$("#farm-guide-close")?.addEventListener("click", () => { pmMarkSeen("guide.farm"); farmGuide?.close(); });
// Coach dare hook: the first-day tour's final card dares the kid to open
// the sticker book — pmCoach dispatches this event after the confetti.
window.addEventListener("pm-open-guide", () => openFarmGuide());
// First-day tour coexistence: while the spotlight tour is still owed
// (PMSeen "tour" unseen — see runFirstDayTour), the tour speaks first and
// its final card points at the ? FAB above, so the modal must not stack on
// top of it: mark the guide seen instead of auto-opening. A broken store
// fails closed (everything reads seen), keeping the old silence.
if (!pmSeenFlag("tour")) {
  pmMarkSeen("guide.farm");
} else if (!pmSeenFlag("guide.farm")) {
  openFarmGuide();
}

// ── Wardrobe picker (milestone20, display-only) ─────────────────────────
// Small button under the companion stage label → the same imperative
// <dialog> pattern as the farm guide above, listing every window.PM_SKINS
// catalog skin with a color swatch, its localized name, and a lock state
// derived from the latest bond level (lastBondLevel, stashed by renderBond).
// Picking an unlocked skin POSTs /api/companion-skin, which writes
// companion_state.skin_key and NOTHING else — no XP, no seeds, no quests,
// and deliberately no celebration FX on selection (state, not reward).
// Every player-facing string comes from strings.js's "wardrobe" group (en +
// id); the only literal fallback is the locale-neutral "Lv N" badge.
const wardrobePanel = $("#wardrobe-panel");

/** strings.js "wardrobe" group, guarded like every PM() read. */
const wardrobeText = () => PM().wardrobe ?? {};

function showWardrobeNote(text) {
  const note = $("#wardrobe-note");
  if (!note) return;
  note.hidden = !text;
  note.textContent = text ?? "";
}

/** CURRENT bond accessory tier ("" | "bow" | "ribbon") from PMSprite state
 *  (the tier thresholds and phase clamps live in jamkachu-sprite.js — the
 *  farm layer never re-derives them). Bare when the driver is absent. */
function currentSpriteTier() {
  try {
    const spriteState = window.PMSprite?.getState?.();
    if (!spriteState) return "";
    return window.PMSprite?.accessoryTier?.(spriteState.bondLevel, window.PMSprite?.stagePhase?.(spriteState.stage)) || "";
  } catch {
    return "";
  }
}

/** Wardrobe header mascot (kiki design integration): the moods-p4 GIF whose
 *  bow/ribbon variant matches the CURRENT accessory tier from PMSprite
 *  state. Fallback bare when the sprite driver is absent. Reduced motion:
 *  the static grown sprite of the same tier instead of the animated strip.
 *  Decorative either way (aria-hidden img in the markup). */
function renderWardrobeMascot() {
  const img = $("#wardrobe-mascot");
  if (!img) return;
  const tier = currentSpriteTier();
  const suffix = tier ? `-${tier}` : "";
  img.src = prefersReducedMotion()
    ? `/farm/assets/jamkachu/4x/plant-p4-fruit-happy${suffix}.png`
    : `/farm/assets/jamkachu/gif/moods-p4${suffix}.gif`;
  img.hidden = false;
}

/** Guide "how I grow" art (kiki design integration): re-points the growth
 *  strip at the CURRENT accessory tier, and at the calm strip whenever
 *  Jamkachu is not actually happy and awake — so every designer growth
 *  variant (plain + bow/ribbon tiers) is reachable in play, not just the
 *  bare happy strip the markup defaults to. The <picture> source keeps
 *  owning reduced motion; it is re-pointed at the static grown sprite of
 *  the same mood + tier. Purely decorative (aria-hidden picture); when the
 *  sprite driver is absent the markup default stands. */
function renderGuideGrowth() {
  const img = $("#farm-guide .farm-guide-grow img");
  const staticSource = $("#farm-guide .farm-guide-grow source");
  if (!img || !window.PMSprite) return;
  const tier = currentSpriteTier();
  const suffix = tier ? `-${tier}` : "";
  let strip = "plain";
  try {
    const spriteState = window.PMSprite?.getState?.();
    const drawnMood = window.PMSprite?.tables?.MOOD_SPRITE?.[spriteState?.mood];
    if (spriteState && !spriteState.sleeping && drawnMood === "happy") strip = "happy";
  } catch {
    strip = "plain";
  }
  img.src = `/farm/assets/jamkachu/gif/growth-${strip}${suffix}.gif`;
  if (staticSource) staticSource.srcset = `/farm/assets/jamkachu/4x/plant-p4-fruit-${strip}${suffix}.png`;
}

function renderWardrobeList() {
  const list = $("#wardrobe-list");
  if (!list) return;
  // The header mascot rides every list repaint: open, skin echo, and the
  // bond level-ups that can change the accessory tier (refreshWardrobeIfOpen).
  renderWardrobeMascot();
  // Defensive catalog read — a missing companion-skins.js tag simply leaves
  // the panel empty rather than breaking the page (same contract as PM()).
  const skins = window.PM_SKINS?.skins ?? [];
  list.textContent = "";
  for (const skin of skins) {
    if (!skin || typeof skin.key !== "string") continue;
    const unlockLevel = Number(skin.unlockLevel) || 1;
    const locked = unlockLevel > lastBondLevel;
    const selected = skin.key === currentSkinKey;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wardrobe-skin";
    button.dataset.skin = skin.key;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-locked", locked);
    button.setAttribute("aria-pressed", String(selected));
    const swatch = document.createElement("i");
    swatch.className = "wardrobe-swatch";
    swatch.setAttribute("aria-hidden", "true");
    if (typeof skin.accent === "string") swatch.style.background = skin.accent;
    const name = document.createElement("span");
    name.className = "wardrobe-skin-name";
    name.textContent = (appLocale === "id" ? skin.nameId : skin.nameEn) ?? skin.key;
    const state = document.createElement("span");
    state.className = "wardrobe-skin-state";
    state.textContent = locked
      ? `🔒 ${wardrobeText().lockedAt?.(unlockLevel) ?? `Lv ${unlockLevel}`}`
      : selected
        ? `✓ ${wardrobeText().current ?? ""}`.trim()
        : "";
    button.append(swatch, name, state);
    button.addEventListener("click", () => onWardrobeSkinTap(skin, locked, selected));
    list.appendChild(button);
  }
}

function onWardrobeSkinTap(skin, locked, selected) {
  const unlockLevel = Number(skin.unlockLevel) || 1;
  if (locked) {
    // Locked tap: inline "unlocks at Lv N" hint only — no request, and no
    // countdown/urgency framing (spec §4.3), just where the road leads.
    showWardrobeNote(wardrobeText().hint?.(unlockLevel) ?? `Lv ${unlockLevel}`);
    return;
  }
  showWardrobeNote(null);
  if (selected) return; // already wearing it — nothing to write
  // Same fetch pattern as the /api/game-tick tick below: fire, parse,
  // tolerate every failure (offline keeps the current skin, silently).
  fetch("/api/companion-skin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plantId: PLANT_ID, skinKey: skin.key }),
  })
    .then((res) => res.json().catch(() => null))
    .then((data) => {
      if (data?.ok === true) {
        // Apply the class immediately (state, not celebration — no FX);
        // the companion_state realtime echo re-confirms the same class.
        applySkinClass(data.skinKey ?? skin.key);
      } else if (data?.error === "migration_missing") {
        // milestone20 migration absent: gentle bilingual notice, no crash.
        showWardrobeNote(wardrobeText().migrationMissing ?? "");
      } else if (data?.error === "locked") {
        // Server truth outranks a stale local bond level.
        showWardrobeNote(wardrobeText().hint?.(unlockLevel) ?? `Lv ${unlockLevel}`);
      }
    })
    .catch(() => {});
}

/** Repaint an OPEN wardrobe (skin echo / bond level-up); closed = no-op. */
function refreshWardrobeIfOpen() {
  if (wardrobePanel?.open) renderWardrobeList();
}

function openWardrobe() {
  if (typeof wardrobePanel?.showModal !== "function") return;
  showWardrobeNote(null);
  renderWardrobeList();
  wardrobePanel.showModal();
}

// Localize the static wardrobe chrome once at load (the list itself is
// rebuilt on every open with live lock/selection state).
{
  const openLabel = $("#wardrobe-open-label");
  const title = $("#wardrobe-title");
  if (openLabel && wardrobeText().open) openLabel.textContent = wardrobeText().open;
  if (title && wardrobeText().title) title.textContent = wardrobeText().title;
  $("#wardrobe-open")?.addEventListener("click", openWardrobe);
  $("#wardrobe-close")?.addEventListener("click", () => wardrobePanel?.close());
}

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
// the user-initiated care interactions (contextual care button, petting,
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
let prevChapter = null; // bond_state.current_chapter — read for PMFx.chapter() only
const questStatuses = new Map(); // quest id → last seen status
let questsPrimed = false; // first quest snapshot recorded without celebrating

const MAX_PARTICLES = 120;
let liveParticles = 0;

const FX_CSS = `
.fx-layer { position: fixed; inset: 0; pointer-events: none; z-index: 999; overflow: hidden; }
.fx-confetti, .fx-sparkle, .fx-heart { position: fixed; image-rendering: pixelated; will-change: transform, opacity; }
.fx-heart { background: var(--color-cheek, #FF9E9E); clip-path: polygon(50% 100%, 0 40%, 0 15%, 25% 0, 50% 20%, 75% 0, 100% 15%, 100% 40%); }
.fx-star { position: fixed; image-rendering: pixelated; will-change: transform, opacity, filter; background: var(--color-yellow, #FFDE6A); clip-path: polygon(50% 0%, 65% 35%, 100% 50%, 65% 65%, 50% 100%, 35% 65%, 0% 50%, 35% 35%); }
.fx-note { position: fixed; font-family: var(--font-heading, monospace); font-size: 15px; color: #39456B; text-shadow: 2px 2px 0 rgba(255, 255, 255, 0.55); will-change: transform, opacity; }
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
.fx-chapter-veil { position: fixed; inset: 0; z-index: 1006; background: radial-gradient(circle at 50% 40%, rgba(28, 38, 24, 0.85) 0%, rgba(12, 17, 10, 0.97) 100%); display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; }
.fx-chapter-gate { max-width: 560px; padding: 24px; text-align: center; font-family: var(--font-heading, monospace); will-change: transform, opacity; }
.fx-chapter-kicker { font-size: 13px; color: var(--color-yellow, #FFDE6A); letter-spacing: 2px; margin-bottom: 18px; }
.fx-chapter-gate-title { font-size: 22px; line-height: 1.7; color: #FFF7DF; text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.5); }
.fx-chapter-line { font-family: var(--font-body, sans-serif); font-size: 16px; line-height: 1.8; color: #E9F2E4; }
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
      // The summed amount matches no single pending reason — mark it so the
      // chip renders plain ("+45 XP") instead of stealing a label that only
      // explains part of the total.
      mergeable.meta.merged = true;
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

/** Single pixel heart rising from the mascot (petting). */
function spawnHeart(rect) {
  if (!rect) return;
  const reduce = prefersReducedMotion();
  const layer = ensureFxLayer();
  if (!layer) return;
  if (liveParticles >= MAX_PARTICLES) return;
  const heart = document.createElement("div");
  heart.className = "fx-heart";
  heart.setAttribute("aria-hidden", "true");
  // Large enough to read as an intentional pet reaction on the full-size
  // desktop stage, while still remaining a single lightweight particle.
  const size = 22 + Math.floor(Math.random() * 8);
  heart.style.width = `${size}px`;
  heart.style.height = `${size}px`;
  heart.style.left = `${rect.left + rect.width * (0.3 + Math.random() * 0.4)}px`;
  heart.style.top = `${rect.top + rect.height * 0.25}px`;
  layer.appendChild(heart);
  liveParticles++;
  animateSafe(
    heart,
    reduce
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
      : [
          { transform: "translateY(0) scale(0.55)", opacity: 0 },
          { transform: "translateY(-20px) scale(1.15)", opacity: 1, offset: 0.28 },
          { transform: "translateY(-72px) scale(1)", opacity: 0 },
        ],
    { duration: 900, easing: reduce ? "linear" : "steps(9, end)", fill: "forwards" },
  );
  removeLater(heart, 1000, true);
}

/** Floating "why" card — a readable sentence (care honesty copy), longer
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
  // Backlog-merged chips sum several awards, so no single reason label is
  // honest for the total — they stay plain (and consume no pending label).
  const label = opts.merged ? null : takeReasonLabel(amount);
  floatChip(label ? `${base} · ${label}` : base, wrap.getBoundingClientRect());
}

/** T2: XP gain chip — routed through the celebration queue; carries its
 *  amount as meta so backlogged chips can merge into one. */
function fxXpGain(delta) {
  fxEnqueue(2, (done, meta) => fxXpChipNow(meta.amount, { merged: meta.merged === true }), 1200, { kind: "xp", amount: delta });
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

/** T4 level-up re-stage (Pokémon-Style Transformation FX plan, Task 5): a
 *  180ms hitstop (breathing freeze) then a small shake + `evoChirp` cue
 *  alongside the existing pixel card overlay + confetti burst — the card
 *  itself auto-dismisses exactly as before this plan. Deliberately small
 *  next to the T5 evolution ceremony (runEvolutionSequence): no silhouette,
 *  no strobe, no full-screen flash — the contrast in weight between the two
 *  events is the design. Reduced motion: skip the freeze/shake pre-beat,
 *  keep the card exactly as-is. Non-blocking (pointer-events: none) and
 *  self-removing. */
function fxLevelUpNow(level) {
  const layer = ensureFxLayer();
  if (!layer) return;
  const reduce = prefersReducedMotion();
  const wrap = $(".mascot-wrapper");
  const popCard = () => {
    if (!reduce && wrap) {
      wrap.classList.add("evo-shake-sm");
      setTimeout(() => wrap.classList.remove("evo-shake-sm"), 200);
    }
    window.PMSfx?.play("evoChirp");
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
  };
  if (reduce || !wrap) {
    popCard();
    return;
  }
  setBreathPaused(true);
  setTimeout(() => {
    setBreathPaused(false);
    popCard();
  }, 180);
}

/** T4: level-up overlay via the celebration queue. Duration covers the
 *  180ms hitstop pre-beat plus the card's own (unchanged) lifetime, so the
 *  queue never force-advances into the next celebration mid-card. */
function fxLevelUp(level) {
  fxEnqueue(4, () => fxLevelUpNow(level), 2700);
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
  const meta = QUEST_META[quest.quest_key] ?? { emoji: "🌟" };
  const title = QUEST_META[quest.quest_key] ? questTitle(quest.quest_key) : prettifyKey(quest.quest_key);
  const xp = Number(quest.xp_reward) || 0;
  const banner = document.createElement("div");
  banner.className = "fx-banner";
  banner.innerHTML =
    `<div class="fx-banner-title">${PM().fx?.questComplete ?? `🏆 ${t("questComplete")}`}</div>` +
    `<div class="fx-banner-detail">${meta.emoji} ${title} · <span class="fx-xp">+${xp} XP</span></div>`;
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

// Single-owner XP counter (rewind-race fix): a monotonically increasing
// generation names who owns the on-screen number. Each orbCascade takes a
// generation and its landing timers bail once it has advanced; renderBond
// bumps it (and clears pending landing timers) before writing an
// authoritative total, so a stale landing can never rewind the counter
// below truth. The timers here hold ONLY counter/bar/sfx writes — orb DOM
// removal rides removeLater and is never cancelled (particle budget).
let xpRenderGeneration = 0;
let xpLandingTimers = [];

function cancelXpLandings() {
  for (const id of xpLandingTimers) clearTimeout(id);
  xpLandingTimers = [];
}

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
  // This cascade becomes the counter's owner: bump the generation (stale
  // landings from an older cascade bail on it), clear their timers, and
  // cancel any in-flight count-up FIRST — before we compute anything, so a
  // tap mid animateXpCount can never leave a stale, still-climbing number
  // for the next line to read.
  const gen = ++xpRenderGeneration;
  cancelXpLandings();
  cancelXpCount(); // the landings own the counter for the next ~2.5s
  // Counter re-roll: prevXp is renderBond's own authoritative bookkeeping —
  // it is updated the instant a fresh total lands, independent of how long
  // any on-screen count-up animation takes to visually catch up. The DOM
  // text can be mid-animation (animateXpCount ticks it via rAF over 800ms)
  // and read a stale, still-climbing number, so prevXp — never the DOM —
  // is the only trustworthy "total right now". Replay the awarded segment
  // ENDING there so the cascade can never rewind or overshoot past the
  // server's truth, and the final landing always settles on the real total.
  const end = Math.max(0, Number.isFinite(prevXp) ? prevXp : xp);
  const start = Math.max(0, end - xp);
  if (numEl) numEl.textContent = String(start);
  setXpBar((start % XP_PER_LEVEL) / XP_PER_LEVEL * 100, false);
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
    // Orb visual cleanup is unconditional (never cancelled) so the particle
    // budget always comes back, even when the counter changes owner.
    removeLater(orb, i * stagger + ORB_FLIGHT_MS, true);
    xpLandingTimers.push(
      setTimeout(() => {
        // A newer authoritative render (or cascade) took the counter —
        // this landing's snapshot math would rewind it below truth. Bail.
        if (gen !== xpRenderGeneration) return;
        const value = Math.round(start + (xp * (i + 1)) / n);
        if (numEl) numEl.textContent = String(value);
        // The bar advances its share; crossing a 100-XP boundary reuses the
        // wrap-around snap juice already built into setXpBar.
        setXpBar((value % XP_PER_LEVEL) / XP_PER_LEVEL * 100, Math.floor(lastShown / XP_PER_LEVEL) < Math.floor(value / XP_PER_LEVEL));
        lastShown = value;
        window.PMSfx?.play("coin");
      }, i * stagger + ORB_FLIGHT_MS),
    );
  }
  const totalMs = (n - 1) * stagger + ORB_FLIGHT_MS + 150;
  // Landing receipt: the "+N XP" chip floats once the last orb has landed
  // (Task 14 attaches the reason label when a bond_event named one). The
  // chip stays even if the counter changed owner — the award is still real.
  setTimeout(() => fxXpChipNow(xp, { silent: true }), totalMs - 100);
  // All landings have fired by totalMs — drop the spent timer ids so
  // renderBond's "cascade still pending" check stays accurate.
  xpLandingTimers.push(
    setTimeout(() => {
      if (gen === xpRenderGeneration) xpLandingTimers = [];
    }, totalMs),
  );
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

// ── Reason chips + bonus reveal (Task 14) ───────────────────────
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

/** T3 gold "BONUS ×2" stamp: scale-slam + gold confetti + rising arpeggio
 *  + a firm buzz. Pure reveal of a server-granted bonus (spec D2) — the XP
 *  itself was already awarded and is presented by the gold orb cascade.
 *  The stamp uses plain bonus language; its confetti and sound stay focused
 *  on the earned reward. */
function fxLuckyStampNow(done) {
  const layer = ensureFxLayer();
  if (!layer) {
    done();
    return;
  }
  window.PMSfx?.play("bonus");
  window.PMSfx?.buzz(25);
  const overlay = document.createElement("div");
  overlay.className = "fx-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  const stamp = document.createElement("div");
  stamp.className = "fx-lucky-stamp";
  stamp.textContent = PM().fx?.luckyStamp ?? "BONUS ×2";
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
  if (reason.startsWith("chapter:")) {
    // Chapter Gate (plan T17): the story engine's award reason is
    // `chapter:<n>` — unlock the T5 peak. Unparsable numbers still gate
    // (dialogue-only) rather than showing a wrong chapter.
    const digits = reason.replace(/\D+/g, "");
    fxChapterGate(digits ? Number.parseInt(digits, 10) : null);
  }
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

// ── Contextual care button + night sleep + petting + micro-juice ────────
// (spec §6.1 / §6.2, reusing the Task 8 ritual juice.) The old WATER /
// FERTILIZE buttons are gone: there is no soil-moisture or nutrient sensor,
// so watering imagery could teach children the wrong action. ONE large
// mood-driven button (#care-action) always shows the single safe action for
// the CURRENT state. Pure presentation, in-fiction only: ZERO Supabase
// writes, ZERO XP, no persisted counters of any kind (spec §4.1). The
// why-cards honestly name the sensor that will verify the real care.

const WHY_CARD_COOLDOWN_MS = 30_000; // shared across all care-button taps
let lastWhyCardAt = 0;

// Mood state → care copy key (both soil moods share one adults-only action).
const CARE_KEY_BY_MOOD = {
  Happy: "Happy",
  Overheating: "Overheating",
  TooCold: "TooCold",
  DryAir: "DryAir",
  HumidAir: "HumidAir",
  Sleepy: "Sleepy",
  SoilAcidic: "Soil",
  SoilAlkaline: "Soil",
};

// Care copy key → mood-flavored relief cue (sfx.js CUES). Both temperature
// moods share the cool hiss, both air moods the mist puffs, both soil moods
// the pH wobble — audio flavor only, zero XP like every press.
const RELIEF_CUE_BY_CARE = {
  Overheating: "reliefCool",
  TooCold: "reliefCool",
  DryAir: "reliefMist",
  HumidAir: "reliefMist",
  Sleepy: "reliefLight",
  Soil: "reliefSoil",
};

// English fallbacks — PM_STRINGS.care carries the localized copy.
const CARE_FALLBACK = {
  Overheating: { label: "Move me to shade 🌳", why: "Find a cooler, shadier spot. The temperature sensor will feel the difference." },
  TooCold: { label: "Move me somewhere warmer 🧣", why: "Find a warmer spot away from cold drafts, open windows, and AC. The temperature sensor will feel the difference." },
  DryAir: { label: "Move me away from fans & AC 🌬️", why: "Fans and AC can dry the air around my leaves. This is about air humidity, not watering my soil; the humidity sensor will check the change." },
  HumidAir: { label: "Give me fresh airflow 🪟", why: "Open a window or improve airflow to clear the muggy air around my leaves. This is about air humidity, not my soil water; the humidity sensor will check the change." },
  Sleepy: { label: "Show me some light ☀️", why: "Open the curtains or move me near a window. The light sensor will see it." },
  Soil: { label: "Check my soil with a teacher 🧑‍🏫", why: "Soil pH needs an adult's help. Never add anything to the pot by yourself." },
  Happy: { label: "Pet me — or write my diary 📖", why: "I'm feeling great! Want to remember today? Write a line in my Growth Diary." },
};
const SLEEP_FALLBACK = {
  bubble: "I'm sleeping. See you tomorrow! 💤",
  why: "Shh… Jamkachu is resting. Plants sleep too — see you tomorrow!",
  nightLabel: "Night 🌙",
  button: "Good night 🌙",
};

// ── Night sleep mode (spec §6.2) ────────────────────────────────────────
// 18:00–06:00 WIB while the mood is Happy: closed-eyes face, slow breath,
// sleep bubble, quiet "Good night" button. Problem moods ALWAYS override
// sleep (safety visibility wins). Evaluated on every mood render plus a
// 60s clock so 18:00/06:00 flip without a reload.

const SLEEP_START_HOUR = 18; // 18:00 WIB inclusive
const SLEEP_END_HOUR = 6; // 06:00 WIB exclusive

/** True inside the 18:00–06:00 WIB night window (Intl failure ⇒ never night). */
function isNightWIB() {
  const now = wibNow();
  if (!now) return false;
  return now.hour >= SLEEP_START_HOUR || now.hour < SLEEP_END_HOUR;
}

// Current mood driving the care button (the static page defaults to the
// happy character) and the sleep presentation currently shown (null =
// not evaluated yet — the first evaluation applies silently, no cue).
let careMood = "Happy";
let sleepShown = null;
let careFocusState = "waiting";

/** Sleep presentation is Happy-only: a problem mood at night keeps its own
 *  face and care button. */
function sleepEligible() {
  return careMood === "Happy" && isNightWIB();
}

/** Paint the care button's label + night styling from current mood/sleep. */
function applyCareButton() {
  const btn = $("#care-action");
  if (!btn) return;
  const labelEl = btn.querySelector(".care-action-label") ?? btn;
  if (careFocusState === "waiting") {
    btn.classList.remove("care-night");
    labelEl.textContent = t("focus.waiting.action");
  } else if (sleepShown) {
    btn.classList.add("care-night");
    labelEl.textContent = PM().sleep?.button ?? SLEEP_FALLBACK.button;
  } else {
    btn.classList.remove("care-night");
    const key = CARE_KEY_BY_MOOD[careMood] ?? "Happy";
    labelEl.textContent = PM().care?.[key]?.label ?? CARE_FALLBACK[key].label;
  }
}

/** Re-evaluate the sleep presentation + care button. Idempotent per state;
 *  bubble/cue changes are diff-gated so the 60s clock never stomps a pet
 *  line mid-display. Entering sleep plays one soft "pet" settle cue (no
 *  celebration); the very first evaluation is always silent. */
function updateCareUi() {
  const sleepNow = sleepEligible();
  const changed = sleepNow !== sleepShown;
  const firstEval = sleepShown === null;
  sleepShown = sleepNow;
  applyCareButton();
  // Dusk sky + fireflies + grandpa (living world): WIB-clock STATE that is
  // deliberately INDEPENDENT of sleepShown — a problem mood keeps Jamkachu
  // awake, but the sky must stay honest about the real time of day.
  applyNightUi();
  $(".mascot-svg")?.classList.toggle("face-asleep", sleepNow);
  $(".mascot-wrapper")?.classList.toggle("breath-slow", sleepNow);
  // Designer sprite: night sleep forces the sleepy body (plan mood table).
  window.PMSprite?.set({ sleeping: sleepNow });
  if (!changed) return;
  const bubble = $(".speech-bubble");
  if (sleepNow) {
    cancelPetBubble(); // a stale pet-line restore must never stomp the sleep bubble
    clearPetExpression(); // tap-reaction faces yield to the closed-eye sleep face
    gazeReset(); // curious gaze: pupils ease home before the lids close
    if (bubble) bubble.textContent = PM().sleep?.bubble ?? SLEEP_FALLBACK.bubble;
    if (!firstEval) window.PMSfx?.play("pet");
  } else if (!firstEval && bubble) {
    // Waking (06:00 flip, or a problem mood overriding sleep): restore the
    // mood's own template line; renderPlant repaints on the next mood diff.
    cancelPetBubble();
    bubble.innerHTML = moodBubble(MOODS[careMood] ?? MOODS.Happy);
  }
}

/** Shared 30s why-card gate (the "occasional" in occasional guidance). */
function maybeWhyCard(text, rect) {
  const now = Date.now();
  if (now - lastWhyCardAt < WHY_CARD_COOLDOWN_MS) return;
  lastWhyCardAt = now;
  floatWhyCard(text, rect);
}

/** Care-button tap (spec §6.1): guidance juice only — mascot reaction,
 *  leaf/sparkle particles (never water droplets), the mood's why-card on
 *  the 30s cooldown, a mood-appropriate cue. Zero XP, zero writes. */
function onCareAction() {
  const rect = careFocusState === "waiting" ? ($("#care-action")?.getBoundingClientRect() ?? mascotRect()) : mascotRect();
  if (careFocusState === "waiting") {
    window.PMSfx?.play("tick");
    maybeWhyCard(t("focus.waiting.why"), rect);
    return;
  }
  if (sleepShown) {
    // Quiet good-night press: soft "shh" card only — no bounce, no confetti.
    window.PMSfx?.play("tick");
    maybeWhyCard(PM().sleep?.why ?? SLEEP_FALLBACK.why, rect);
    return;
  }
  const key = CARE_KEY_BY_MOOD[careMood] ?? "Happy";
  if (key === "Happy") {
    petMascot(); // existing petting reaction — satiation + "pet" cue included
  } else {
    // Mood-flavored relief texture (sfx.js CUES): a cool hiss for heat, mist
    // puffs for air, rising sunlight for dark, a soil wobble for pH — the
    // press FEELS like the fix. Same zero-XP press either way.
    window.PMSfx?.play(RELIEF_CUE_BY_CARE[key] ?? "blip");
    mascotBounce(); // relief reaction
    showPetExpression(); // the face joins in — reaction, never a reward
    spawnSparkles(rect, 10); // green/gold leaf-sparkle palette
  }
  maybeWhyCard(PM().care?.[key]?.why ?? CARE_FALLBACK[key].why, rect);
}

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

/** Hitstop: freeze/resume the idle breathing loop. The whole-body breath
 *  bob runs on the sprite img (`.animated-breath #jamkachu-sprite` in
 *  style.css) — not on `.mascot-wrapper` itself — so that's the element
 *  whose animation-play-state we need to toggle for a real freeze. Used by
 *  both the evolution ceremony (Task 4) and the level-up re-stage (Task 5). */
function setBreathPaused(paused) {
  const spriteEl = $("#jamkachu-sprite");
  if (spriteEl) spriteEl.style.animationPlayState = paused ? "paused" : "";
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
let petExpressionIndex = 0;

// ── Tap-reaction expression variety (2026-08-10 headline request:
// "표정 더 다양하게, 터치하면 표정이 달라진다던가"; re-seated on the kiki
// designer sprites 2026-08-11) ───────────────────────────────────────────
// Every tap answers with a DIFFERENT {spriteMood, emojiBurst} pair: the
// sprite flashes an alternate drawn mood for ~1.2s (via PMSprite.set
// flashMood — designer art stays the face), plus one emoji burst rides the
// existing particle system. ≥3 distinct pairs per mood: Happy taps skew
// warm/party; problem moods stay honest — every problem pool keeps at
// least two entries flashing the mood's OWN drawn body so struggle never
// fully disappears under affection. Cycled by a tap counter so consecutive
// spam-taps always visibly differ. Pure presentation: zero XP, zero
// writes, no counters beyond the cycle index.
const PET_EXPRESSION_POOLS = {
  // Positive reactions intentionally outnumber concern flashes (about 3:1),
  // so a tap feels encouraging even while the sensor mood remains honest.
  Happy: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "happy", emojiBurst: "😊" },
    { spriteMood: "happy", emojiBurst: "🎵" },
    { spriteMood: "happy", emojiBurst: "🤩" },
    { spriteMood: "happy", emojiBurst: "✨" },
    { spriteMood: "happy", emojiBurst: "💛" },
    { spriteMood: "happy", emojiBurst: "🌈" },
    { spriteMood: "happy", emojiBurst: "😄" },
    { spriteMood: "happy", emojiBurst: "🥰" },
    { spriteMood: "happy", emojiBurst: "🎉" },
    { spriteMood: "happy", emojiBurst: "🌸" },
  ],
  Overheating: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "overheat", emojiBurst: "💦" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "overheat", emojiBurst: "🥵" },
  ],
  TooCold: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "plain", emojiBurst: "🥶" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "plain", emojiBurst: "❄️" },
  ],
  DryAir: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "thirsty", emojiBurst: "💧" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "thirsty", emojiBurst: "💦" },
  ],
  HumidAir: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "plain", emojiBurst: "💦" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "plain", emojiBurst: "🌬️" },
  ],
  Sleepy: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "sleepy", emojiBurst: "💤" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "🌙" },
    { spriteMood: "sleepy", emojiBurst: "😌" },
  ],
  SoilAcidic: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "plain", emojiBurst: "🧪" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "plain", emojiBurst: "🌱" },
  ],
  SoilAlkaline: [
    { spriteMood: "happy", emojiBurst: "💖" },
    { spriteMood: "plain", emojiBurst: "🧪" },
    { spriteMood: "happy", emojiBurst: "⭐" },
    { spriteMood: "sleepy", emojiBurst: "😊" },
    { spriteMood: "plain", emojiBurst: "🪴" },
  ],
};
// Named reactions for the explicit callers (drowsy blink, surprise-hop
// giggle) — sprite-mood flavors of the retired face keys, same call sites.
const PET_NAMED_REACTIONS = {
  blink: { spriteMood: "sleepy", emojiBurst: "😌" },
  giggle: { spriteMood: "happy", emojiBurst: "😄" },
};
// The designer sprite remains the source of truth for Jamkachu's body and
// sensor mood. This small badge gives positive taps twelve visibly distinct
// friendly expressions without replacing the teammate-authored face art.
const POSITIVE_FACE_GLYPHS = {
  "💖": "😍",
  "⭐": "😎",
  "😊": "😊",
  "🎵": "😋",
  "🤩": "🤩",
  "✨": "😁",
  "💛": "🥰",
  "🌈": "😄",
  "😄": "😆",
  "🥰": "🤗",
  "🎉": "🥳",
  "🌸": "😌",
  "😌": "😉",
  "💦": "😊",
  "🥵": "😅",
  "🥶": "🙂",
  "❄️": "😊",
  "💧": "😊",
  "🌬️": "😌",
  "💤": "😴",
  "🌙": "☺️",
  "🧪": "🤓",
  "🌱": "🌱",
  "🪴": "🪴",
};
const PET_EXPRESSION_MS = 1200; // ~1.2s of reaction, then the mood frame returns
let petExpressionTimer = null;

/** One emoji rises off the sprite head — the tap reaction's burst half,
 *  riding the shipped .badge-tap-particle pixel-pop styling. */
function spawnPetEmojiBurst(glyph) {
  if (!glyph) return;
  const rect = mascotRect();
  const el = document.createElement("span");
  el.className = "badge-tap-particle";
  el.textContent = glyph;
  el.style.left = `${rect.left + rect.width / 2 + (Math.random() * 28 - 14)}px`;
  el.style.top = `${rect.top + rect.height * 0.3}px`;
  el.style.setProperty("--tap-x", `${Math.random() < 0.5 ? -22 : 22}px`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/** Drop any active tap-reaction flash — the deterministic mood frame under
 *  it returns instantly. Mood renders and sleep entry call this so a stale
 *  grin can never sit over fresh truth. */
function clearPetExpression() {
  if (petExpressionTimer !== null) {
    clearTimeout(petExpressionTimer);
    petExpressionTimer = null;
  }
  window.PMSprite?.set({ flashMood: null });
  const expression = document.getElementById("positive-expression");
  if (expression) {
    expression.classList.remove("is-visible");
    expression.textContent = "";
  }
}

/** Flash one tap-reaction pair (alternate sprite mood + emoji burst), then
 *  revert to the mood frame. `face` picks an explicit named reaction
 *  (drowsy blink, surprise hop); omitted, the per-mood pool cycles via the
 *  tap counter so consecutive taps always differ. Quiet gates: never over
 *  night sleep (sleepShown — drowsy taps route through the explicit
 *  blink), the hatch intro, or the first-day tour. PMSprite absent → the
 *  whole reaction no-ops safely. Reaction only — grants nothing, ever. */
function showPetExpression(face, ms = PET_EXPRESSION_MS) {
  if (sleepShown || hatchActive || tourActive) return; // quiet gates
  if (!window.PMSprite) return; // sprite driver absent: no-op, never throw
  let reaction = face ? PET_NAMED_REACTIONS[face] : null;
  if (!reaction) {
    const pool = PET_EXPRESSION_POOLS[careMood] ?? PET_EXPRESSION_POOLS.Happy;
    reaction = pool[petExpressionIndex % pool.length];
    petExpressionIndex += 1;
  }
  clearPetExpression(); // restart cleanly so back-to-back taps visibly swap
  window.PMSprite.set({ flashMood: reaction.spriteMood });
  const expression = document.getElementById("positive-expression");
  if (expression) {
    expression.textContent = POSITIVE_FACE_GLYPHS[reaction.emojiBurst] ?? "😊";
    expression.classList.remove("is-visible");
    // Force a fresh animation when two taps happen back-to-back.
    void expression.offsetWidth;
    expression.classList.add("is-visible");
  }
  spawnPetEmojiBurst(reaction.emojiBurst);
  petExpressionTimer = setTimeout(() => {
    petExpressionTimer = null;
    clearPetExpression();
  }, ms);
}

// Idle expression variety: every 25–45s (randomized) with no interaction, a
// brief idle bob/tilt of the sprite (~0.8s) or an occasional quiet sparkle
// keeps Jamkachu feeling alive between visits. (The old pupil-glance/blink
// DOM writes retired with the inline-SVG face — the designer sprite has no
// separately addressable pupils.) Skipped ENTIRELY under
// prefers-reduced-motion (the matchMedia check inside prefersReducedMotion)
// and behind the same quiet gates as tap reactions. Grants nothing.
// (`lastPointerAt` and `mascotDown` are declared later in this file — the
// first timer tick fires long after module evaluation, so the bindings are
// live by then.)
const IDLE_EXPRESSION_MIN_MS = 25_000;
const IDLE_EXPRESSION_MAX_MS = 45_000;
const IDLE_EXPRESSION_MS = 800;

function maybeIdleExpression() {
  if (prefersReducedMotion()) return; // matchMedia guard — skip entirely
  if (document.visibilityState !== "visible") return;
  if (sleepShown || hatchActive || tourActive || mascotDown) return;
  if (fxPlaying || fxQueue.length > 0) return; // never compete with a celebration
  if (Date.now() - lastPointerAt < IDLE_EXPRESSION_MIN_MS) return; // user is around
  if (petExpressionTimer !== null) return; // a tap reaction is mid-flight
  if (Math.random() < 0.5) {
    // Idle bob/tilt: a short class flash on the container; style.css runs
    // the one-shot keyframes on the sprite img (reduced-motion gated there
    // too, belt-and-suspenders with the guard above).
    const svg = $(".mascot-svg");
    if (!svg) return;
    svg.classList.add("idle-bob");
    setTimeout(() => $(".mascot-svg")?.classList.remove("idle-bob"), IDLE_EXPRESSION_MS);
  } else {
    spawnSparkles(mascotRect(), 3); // occasional sparkle — quiet, tiny
  }
}

(function scheduleIdleExpression() {
  setTimeout(() => {
    maybeIdleExpression();
    scheduleIdleExpression();
  }, IDLE_EXPRESSION_MIN_MS + Math.random() * (IDLE_EXPRESSION_MAX_MS - IDLE_EXPRESSION_MIN_MS));
})();

// ── Tactile interactions (curious gaze / double-tap hop / body-part pokes /
// mood-aware petting / long-press lean-in / night lullaby stroke) ─────────
// All pure presentation: ZERO XP, zero writes, no hidden counters — the
// existing pet cooldown/satiation state above is the ONLY pacing mechanism;
// everything else here is gesture-detection timestamps and rotation indexes.
const DOUBLE_TAP_MS = 300;
const LEAN_HOLD_MS = 600;
const LEAN_CANCEL_DIST = 14; // px of drift that turns a hold into a drag
const LULLABY_MAX_SPEED = 0.15; // px/ms — average speed of a gentle stroke
const LULLABY_MIN_MS = 500;
const LULLABY_MIN_DIST = 24; // the stroke must actually travel across
const LULLABY_CARD_COOLDOWN_MS = 60_000; // why-card at most once per minute
const LULLABY_BREATH_MS = 5000;
const PET_SURPRISE_FALLBACK = "Secret move: LEAF SPRING!";
const LEAN_IN_FALLBACK = "Mmm… staying close to you is my favorite.";
const LULLABY_FALLBACK = {
  why: "Your slow, gentle stroke felt like a lullaby 🎵 Jamkachu is sleeping even more soundly.",
};
const POKE_FALLBACK = {
  pot: "Boom! Tiny pot drum! 🥁",
  potSticker: "Hey! That's my favorite sticker. 💚",
  stem: "Hihi, that's my tummy — it tickles!",
};
// English fallbacks for the mood-aware comfort petting lines (item 4);
// PM_STRINGS.petComfort carries the localized sets. Each line is gratitude
// plus the real sensor-backed fix — mirrors the care-button honesty rules
// (never watering/fertilizing: those sensors do not exist).
const PET_COMFORT_FALLBACK = {
  Overheating: [
    "Thanks… a cooler, shadier spot would feel even better.",
    "Your hands help… but this room is really warm right now.",
    "Phew… some shade would be lovely.",
    "That's nice… the temperature sensor still says it's hot, though.",
    "A little cooler and I'll be all smiles again.",
  ],
  TooCold: [
    "Thanks… a warmer spot would feel even better.",
    "Your hands are warm… but this room is really cold right now.",
    "Brrr… somewhere cozier would be lovely.",
    "That's nice… the temperature sensor still says it's cold, though.",
    "A little warmer and I'll be all smiles again.",
  ],
  DryAir: [
    "That feels nice… the air is still pretty dry, though.",
    "Thanks… away from fans and drafts, my air gets cozier.",
    "Sweet of you… moister air would be even sweeter.",
    "The humidity sensor still says the air is very dry.",
    "A calmer, less breezy spot would feel wonderful.",
  ],
  HumidAir: [
    "That feels nice… the air is still pretty muggy, though.",
    "Thanks… a little fresh airflow would make my air cozier.",
    "Sweet of you… drier, fresher air would be even sweeter.",
    "The humidity sensor still says the air is very humid.",
    "An open window or gentle breeze would feel wonderful.",
  ],
  Sleepy: [
    "Thanks… some light would wake me right up.",
    "So cozy… but it's pretty dark in here right now.",
    "Your hands are warm… a bright window would be dreamy.",
    "The light sensor says it's dark right now.",
    "A little daylight and I'll perk right up.",
  ],
  Soil: [
    "Thanks… my soil still feels a bit funny, though.",
    "That helps… could a teacher check my soil pH with you?",
    "The pH sensor says my soil isn't quite right yet.",
    "Soil fixes need a grown-up — never add anything to my pot alone, okay?",
    "Your pets are sweet… my soil could use an adult's check.",
  ],
};
let lastPetTapAt = 0; // double-tap detector (surprise hop)
let petComfortIndex = 0; // comfort-line rotation (mood-aware petting)
let petQuickIndex = 0; // short acknowledgement rotation for rapid taps
let lullabyCardAt = 0; // 60s why-card gate (spec'd rate limit, not a counter)
let lullabyBreathTimer = null;

const PET_QUICK_FALLBACK = {
  en: [
    "Thanks! Your touch feels warm 💛",
    "Aww, that feels cozy!",
    "Thank you for checking on me 🌱",
    "Your gentle tap made me smile!",
  ],
  id: [
    "Makasih! Sentuhanmu hangat 💛",
    "Aww, nyaman banget!",
    "Makasih sudah menemaniku 🌱",
    "Ketukan lembutmu bikin aku tersenyum!",
  ],
};

function quickPetLine() {
  const configured = PM().petting;
  const lines = Array.isArray(configured) && configured.length > 0
    ? configured
    : (PET_QUICK_FALLBACK[appLocale] ?? PET_QUICK_FALLBACK.en);
  const line = lines[petQuickIndex % lines.length];
  petQuickIndex += 1;
  return line;
}

/** Temporarily replace the speech bubble with `line`, restoring the saved
 *  mood bubble after `ms` — the petting mechanism, shared by the pressable
 *  vitals (T19) and the memory rotation (spec §6.5) so every transient line
 *  rides the SAME guards: cancelPetBubble() on mood/sleep transitions wipes
 *  a stale restore, and petSavedBubble keeps the original content safe. */
function showTransientBubble(line, ms) {
  const bubble = $(".speech-bubble");
  if (!bubble) return;
  if (petSavedBubble === null) petSavedBubble = bubble.innerHTML;
  bubble.textContent = line;
  if (petRestoreTimer !== null) clearTimeout(petRestoreTimer);
  petRestoreTimer = setTimeout(() => {
    petRestoreTimer = null;
    const el = $(".speech-bubble");
    if (el && petSavedBubble !== null) el.innerHTML = petSavedBubble;
    petSavedBubble = null;
  }, ms);
}

/** Shared satiation accounting (in-fiction only, never persisted): the 5th
 *  interaction inside the rolling window engages the existing 10s rest.
 *  Callers show the yawn line when this returns true. */
function petSatiationHit(now) {
  if (petTapTimes.length < 5) return false;
  petSatiatedUntil = now + PET_SATIATION_MS;
  petTapTimes = [];
  return true;
}

function petYawnLine() {
  return PM().pettingYawn ?? "So cozy… Jamkachu needs a tiny nap now. Zzz…";
}

/** Dopamine contract (2026-08-09): a tap on Jamkachu NEVER dies silently.
 *  The full pet path stays paced (600ms cooldown, 5-in-30s satiation), but
 *  declined taps get these cheap acknowledgments instead of nothing —
 *  compositor-only, no bubble churn, no satiation/cooldown accounting, so
 *  the pacing changes the response's flavor, never its existence. Audio
 *  rides the sfx dispatcher's own rate limit. */
function quickPetResponse() {
  showPetExpression();
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    animateSafe(
      wrapper,
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.05, 0.96)" },
        { transform: "scale(1, 1)" },
      ],
      { duration: 160, easing: "steps(3, end)" },
    );
  }
  spawnHeart(wrapper ? wrapper.getBoundingClientRect() : null);
  // Rapid taps used to show only the visual effect because the full pet path
  // is paced. Keep the acknowledgement just as warm, without touching XP or
  // satiation accounting.
  showTransientBubble(quickPetLine(), PET_BUBBLE_RESTORE_MS);
  window.PMSfx?.play("pet");
}

/** Satiated (in-fiction rest) taps: sleepy flavor, still alive — a soft
 *  breath-squash and a floating lullaby note instead of hearts. */
function drowsyPetResponse() {
  showPetExpression("blink"); // drowsy flavor: sleepy blink, not the party pool
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    animateSafe(
      wrapper,
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.03, 0.98)" },
        { transform: "scale(1, 1)" },
      ],
      { duration: 260, easing: "ease-out" },
    );
  }
  spawnLullabyNote(mascotRect());
  window.PMSfx?.play("purr");
}

function petMascot(part = "head") {
  // Night sleep (spec §6.2): a sleeping Jamkachu is never squash-animated,
  // hearted, or chatted awake — mirror the care button's quiet good-night
  // path (soft tick + the shh card on its shared 30s cooldown) and leave
  // the sleep bubble untouched.
  if (sleepShown) {
    window.PMSfx?.play("tick");
    maybeWhyCard(PM().sleep?.why ?? SLEEP_FALLBACK.why, mascotRect());
    return;
  }
  const now = Date.now();
  // Double-tap surprise hop: a second tap inside 300ms used to die silently
  // in the pet cooldown — now it becomes one big hop. The pair still counts
  // as the ONE pet the first tap already recorded, so interaction volume
  // never rises (no extra satiation entry, cooldown re-armed like a pet).
  const sinceLastTap = now - lastPetTapAt;
  lastPetTapAt = now;
  if (now < petSatiatedUntil) {
    drowsyPetResponse();
    return;
  }
  if (sinceLastTap <= DOUBLE_TAP_MS && now < petCooldownUntil) {
    lastPetTapAt = 0; // a third tap never chains a second hop
    surpriseHop(now);
    return;
  }
  if (now < petCooldownUntil) {
    quickPetResponse();
    return;
  }
  petCooldownUntil = now + PET_COOLDOWN_MS;
  petTapTimes = petTapTimes.filter((time) => now - time < PET_WINDOW_MS);
  petTapTimes.push(now);

  // Body-part router (stateless, pure geometry): pot knocks and stem boops
  // share the cooldown + satiation accounting above; the head continues
  // into the shipped petting below, exactly as before.
  if (part === "pot") {
    potKnock(now);
    return;
  }
  if (part === "stem") {
    stemBoop(now);
    return;
  }

  window.PMSfx?.play("pet");
  showPetExpression();
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    // Mood-aware petting: a not-Happy Jamkachu gets a softer squash.
    const mid = careMood === "Happy" ? "scale(1.1, 0.9)" : "scale(1.06, 0.94)";
    animateSafe(
      wrapper,
      [
        { transform: "scale(1, 1)" },
        { transform: mid },
        { transform: "scale(1, 1)" },
      ],
      { duration: 210, easing: "steps(4, end)" },
    );
  }
  spawnHeart(wrapper ? wrapper.getBoundingClientRect() : null);
  const bestFriendHug = spawnBadgeTapEffect(wrapper ? wrapper.getBoundingClientRect() : mascotRect());
  if (bestFriendHug) {
    setTimeout(() => spawnHeart(mascotRect()), 90);
    setTimeout(() => spawnHeart(mascotRect()), 180);
  }

  let line;
  if (petSatiationHit(now)) {
    line = petYawnLine();
  } else if (bestFriendHug) {
    line = appLocale === "id" ? "Pelukan sahabat! Sebentar lagi ya. 💛" : "Best-friend hug! Stay a little longer. 💛";
  } else if (careMood !== "Happy" && CARE_KEY_BY_MOOD[careMood]) {
    // Comfort lines (item 4): gratitude + the real sensor-backed fix the
    // mood engine already knows about. Both soil moods share one family.
    const family = CARE_KEY_BY_MOOD[careMood];
    const table = PM().petComfort?.[family];
    const set = Array.isArray(table) && table.length > 0 ? table : PET_COMFORT_FALLBACK[family];
    line = set[petComfortIndex % set.length];
    petComfortIndex++;
  } else {
    const lines = Array.isArray(PM().petting) && PM().petting.length > 0 ? PM().petting : PET_FALLBACK_LINES;
    line = lines[petLineIndex % lines.length];
    petLineIndex++;
  }

  showTransientBubble(line, PET_BUBBLE_RESTORE_MS);
}

// ── Camera Live Guardian (milestone19) ──────────────────────────────────
// camera_events realtime → presentation ONLY. `touch` rows ride the
// existing pet-response machinery (quickPetResponse: compositor squash +
// heart + pet sfx — instant, no bubble churn) plus one giggle line;
// `pest_advice` rows show a transient advisory bubble and a T2-queued
// why-card. No XP, no Seed surface, no counters, no network — a camera
// signal can never be a reward (spec §Invariants). Never while asleep,
// hatching, mid-fx, or during night suspension. The 10s client throttle
// additionally swallows any replayed backlog on a flaky reconnect.
let lastCameraTouchAt = 0;
const CAMERA_TOUCH_GAP_MS = 10_000;

function onCameraEventInsert(row) {
  if (!row || typeof row !== "object") return;
  if (sleepShown || hatchActive || tourActive || isNightWIB() || fxPlaying) return; // never tickle a sleeping/hatching/touring Jamkachu
  if (row.kind === "touch") {
    const now = Date.now();
    if (now - lastCameraTouchAt < CAMERA_TOUCH_GAP_MS) return;
    lastCameraTouchAt = now;
    quickPetResponse();
    showTransientBubble(
      PM().cameraGuardian?.touchLine ??
        (appLocale === "id"
          ? "Hihi, geli! Ada yang menyentuh daun asliku 🌿"
          : "Hehe, that tickles! Someone touched my real leaves 🌿"),
      PET_BUBBLE_RESTORE_MS,
    );
    return;
  }
  if (row.kind === "pest_advice") {
    const note = row.note && typeof row.note === "object" ? row.note : {};
    const rawAdvice = typeof note.message === "string" ? note.message : note.advice;
    const line = typeof rawAdvice === "string" && rawAdvice.trim() ? rawAdvice.trim().slice(0, 220) : null;
    if (line) showTransientBubble(line, 6000);
    fxEnqueue(
      2,
      () =>
        floatWhyCard(
          PM().cameraGuardian?.pestWhy ??
            (appLocale === "id"
              ? "Kamera penjaga menduga ada sesuatu di tanaman asli — sekadar petunjuk, coba lihat ya!"
              : "The watch camera thinks something might be on the real plant — just a hint, worth a look!"),
          mascotRect(),
        ),
      1200,
    );
  }
}

/** Double-tap surprise hop (item 2): one big steps(4) hop + wide-eye pupils
 *  + an excited line. Reduced motion keeps the eye swap and the line. */
function surpriseHop(now) {
  petCooldownUntil = now + PET_COOLDOWN_MS; // hops pace exactly like pets
  window.PMSfx?.play("boing");
  showPetExpression("giggle", 700); // playful giggle for the hop (gasp face was cut — too scary)
  $(".mascot-svg")?.classList.add("eyes-wide");
  setTimeout(() => $(".mascot-svg")?.classList.remove("eyes-wide"), 700);
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    animateSafe(
      wrapper,
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-18px)", offset: 0.4 },
        { transform: "translateY(0)" },
      ],
      { duration: 420, easing: "steps(4, end)" },
    );
  }
  showTransientBubble(PM().petSurprise ?? PET_SURPRISE_FALLBACK, PET_BUBBLE_RESTORE_MS);
}

/** Pot knock (item 3): a small side-to-side rattle. The pot is baked into
 *  the designer sprite now, so the whole img rattles a few px (the closest
 *  honest read of "knocking the pot"); the line still swaps when the Lv.2
 *  heart-sticker decoration is visible on the pot. */
function potKnock(now) {
  window.PMSfx?.play("knock");
  const pot = $("#jamkachu-sprite");
  if (pot && !prefersReducedMotion()) {
    animateSafe(
      pot,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "steps(4, end)" },
    );
  }
  let line;
  if (petSatiationHit(now)) {
    line = petYawnLine();
  } else if ($(".mascot-svg")?.classList.contains("decor-lv2")) {
    line = PM().poke?.potSticker ?? POKE_FALLBACK.potSticker;
  } else {
    line = PM().poke?.pot ?? POKE_FALLBACK.pot;
  }
  showTransientBubble(line, PET_BUBBLE_RESTORE_MS);
}

/** Stem boop (item 3): quick 1.03 stretch + tummy-giggle line, "blip" cue. */
function stemBoop(now) {
  window.PMSfx?.play("blip");
  const wrapper = $(".mascot-wrapper");
  if (wrapper && !prefersReducedMotion()) {
    animateSafe(
      wrapper,
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(0.99, 1.03)" },
        { transform: "scale(1, 1)" },
      ],
      { duration: 200, easing: "steps(3, end)" },
    );
  }
  const line = petSatiationHit(now) ? petYawnLine() : (PM().poke?.stem ?? POKE_FALLBACK.stem);
  showTransientBubble(line, PET_BUBBLE_RESTORE_MS);
}

/** Map a pointer position into the mascot's 300x350 viewBox and name the
 *  body part under it (stateless geometry; unknown/degenerate ⇒ head). */
function mascotPartAt(clientX, clientY) {
  const svg = $(".mascot-svg");
  if (!svg) return "head";
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return "head";
  const x = ((clientX - rect.left) / rect.width) * 300;
  const y = ((clientY - rect.top) / rect.height) * 350;
  // Sprite geometry (kiki pack): pot rim starts at y≈238 in the 300×350
  // box (row 40 of the 64px grid, img bottom-anchored); the stem column
  // sits center x 150 between the head block and the rim.
  if (y >= 238) return "pot"; // pot rim downward
  if (y > 170 && x >= 125 && x <= 175) return "stem"; // stem column below head
  return "head"; // head block + leaves keep the shipped petting
}

// ── Mascot pointer pipeline (items 2/3/5/6) ─────────────────────────────
// One pointerdown/move/up pipeline on .mascot-wrapper routes: quick tap →
// body-part petting (on release), double tap → hop, ≥600ms head hold →
// lean-in, and — only while asleep — a slow gentle drag → night lullaby.
// A single active pointer at a time; pointercancel aborts quietly.

let mascotDown = null; // { id, t, x, y, part, asleep, dist, lastX, lastY, spent }
let leanTimer = null; // pending 600ms hold detector
let leanSide = null; // "left" | "right" while the lean-in is held

/** Drop every lean visual (and any pending hold timer). `settle` plays the
 *  gentle steps() return-to-upright when motion is allowed. */
function clearLean(settle) {
  if (leanTimer !== null) {
    clearTimeout(leanTimer);
    leanTimer = null;
  }
  const side = leanSide;
  leanSide = null;
  $(".mascot-svg")?.classList.remove("lean-cheeks");
  const wrapper = $(".mascot-wrapper");
  if (!wrapper || !side) return;
  wrapper.classList.remove("lean-left", "lean-right");
  if (settle && !prefersReducedMotion()) {
    const from = side === "left" ? -3 : 3;
    animateSafe(
      wrapper,
      [
        { transform: `rotate(${from}deg)` },
        { transform: `rotate(${-from / 3}deg)` },
        { transform: "rotate(0deg)" },
      ],
      { duration: 350, easing: "steps(4, end)" },
    );
  }
}

/** 600ms hold reached: begin the lean-in (head region, awake only). The
 *  shared pet pacing still applies — satiated/cooldown holds do nothing,
 *  and the release then falls through to petMascot's own guards. */
function beginLean() {
  leanTimer = null;
  if (!mascotDown || mascotDown.asleep || sleepShown) return;
  if (mascotDown.dist > LEAN_CANCEL_DIST) return; // a drag, not a hold
  const now = Date.now();
  if (now < petSatiatedUntil || now < petCooldownUntil) return;
  const rect = mascotRect();
  leanSide = mascotDown.x < rect.left + rect.width / 2 ? "left" : "right";
  $(".mascot-svg")?.classList.add("lean-cheeks");
  $(".mascot-wrapper")?.classList.add(leanSide === "left" ? "lean-left" : "lean-right");
}

/** Lean-in release: settle upright with ONE heart, a warm line, and the
 *  purr cue. Counts as one pet (cooldown + satiation entry). */
function releaseLean() {
  clearLean(true);
  if (sleepShown) return; // slipped into sleep mid-hold — let go quietly
  const now = Date.now();
  window.PMSfx?.play("purr");
  petCooldownUntil = now + PET_COOLDOWN_MS; // a lean-in paces like a pet
  petTapTimes = petTapTimes.filter((time) => now - time < PET_WINDOW_MS);
  petTapTimes.push(now); // satiation still applies (one interaction)
  spawnHeart(mascotRect()); // exactly one heart (skips itself under reduce)
  const line = petSatiationHit(now) ? petYawnLine() : (PM().leanIn ?? LEAN_IN_FALLBACK);
  showTransientBubble(line, PET_BUBBLE_RESTORE_MS);
}

/** Sleeping-mascot release: a slow gentle drag becomes a lullaby; anything
 *  quicker keeps the shipped tick + shh behavior. */
function evaluateLullaby(down) {
  const duration = Date.now() - down.t;
  const gentle =
    duration >= LULLABY_MIN_MS &&
    down.dist >= LULLABY_MIN_DIST &&
    down.dist / duration < LULLABY_MAX_SPEED;
  if (!gentle) {
    window.PMSfx?.play("tick");
    maybeWhyCard(PM().sleep?.why ?? SLEEP_FALLBACK.why, mascotRect());
    return;
  }
  nightLullaby();
}

/** Night lullaby (item 6): ONE soft note pixel floats up, the sleeping
 *  breath deepens ~10% for 5s, and (max once per 60s) a why-card explains
 *  the hum. Jamkachu stays asleep — bubble and face are never touched. */
function nightLullaby() {
  window.PMSfx?.play("lullaby");
  spawnLullabyNote(mascotRect());
  const wrapper = $(".mascot-wrapper");
  if (wrapper) {
    wrapper.classList.add("breath-deep");
    if (lullabyBreathTimer !== null) clearTimeout(lullabyBreathTimer);
    lullabyBreathTimer = setTimeout(() => {
      lullabyBreathTimer = null;
      $(".mascot-wrapper")?.classList.remove("breath-deep");
    }, LULLABY_BREATH_MS);
  }
  const now = Date.now();
  if (now - lullabyCardAt >= LULLABY_CARD_COOLDOWN_MS) {
    lullabyCardAt = now;
    floatWhyCard(PM().lullaby?.why ?? LULLABY_FALLBACK.why, mascotRect());
  }
}

/** One pixel musical note drifting up from the sleeping mascot. Rides the
 *  shared particle budget; skipped under reduced motion. */
function spawnLullabyNote(rect) {
  if (prefersReducedMotion() || !rect) return;
  const layer = ensureFxLayer();
  if (!layer || liveParticles >= MAX_PARTICLES) return;
  const note = document.createElement("div");
  note.className = "fx-note";
  note.setAttribute("aria-hidden", "true");
  note.textContent = "♪";
  note.style.left = `${rect.left + rect.width * 0.5}px`;
  note.style.top = `${rect.top + rect.height * 0.3}px`;
  layer.appendChild(note);
  liveParticles++;
  animateSafe(
    note,
    [
      { transform: "translateY(0)", opacity: 0 },
      { transform: "translateY(-12px)", opacity: 0.9, offset: 0.25 },
      { transform: "translateY(-46px)", opacity: 0 },
    ],
    { duration: 1800, easing: "steps(9, end)", fill: "forwards" },
  );
  removeLater(note, 1900, true);
}

function startMascotPointer(event) {
  if (mascotDown) return; // one active pointer at a time
  mascotDown = {
    id: event.pointerId,
    t: Date.now(),
    x: event.clientX,
    y: event.clientY,
    part: mascotPartAt(event.clientX, event.clientY),
    asleep: Boolean(sleepShown),
    dist: 0,
    lastX: event.clientX,
    lastY: event.clientY,
    spent: false,
  };
  try {
    $(".mascot-wrapper")?.setPointerCapture?.(event.pointerId);
  } catch {
    // capture unavailable — moves outside the wrapper just end the gesture
  }
  if (!mascotDown.asleep && mascotDown.part === "head") {
    if (leanTimer !== null) clearTimeout(leanTimer);
    leanTimer = setTimeout(beginLean, LEAN_HOLD_MS);
  }
}

function moveMascotPointer(event) {
  if (!mascotDown || event.pointerId !== mascotDown.id) return;
  mascotDown.dist += Math.hypot(event.clientX - mascotDown.lastX, event.clientY - mascotDown.lastY);
  mascotDown.lastX = event.clientX;
  mascotDown.lastY = event.clientY;
  if (mascotDown.dist > LEAN_CANCEL_DIST && !mascotDown.asleep) {
    // A real drag is a stroke, not a hold — cancel a pending or active lean.
    if (leanTimer !== null) {
      clearTimeout(leanTimer);
      leanTimer = null;
    }
    if (leanSide !== null) {
      clearLean(false); // drifted into a drag mid-lean: let go quietly
      mascotDown.spent = true;
    }
  }
}

function endMascotPointer(event) {
  const down = mascotDown;
  if (!down || event.pointerId !== down.id) return;
  mascotDown = null;
  if (leanTimer !== null) {
    clearTimeout(leanTimer);
    leanTimer = null;
  }
  if (leanSide !== null) {
    releaseLean();
    return;
  }
  if (down.spent) return; // an aborted lean-in already consumed this press
  if (down.asleep) {
    if (sleepShown) evaluateLullaby(down);
    return;
  }
  if (sleepShown) return; // fell asleep mid-press — never chat over sleep
  petMascot(down.part);
}

function cancelMascotPointer(event) {
  if (!mascotDown || event.pointerId !== mascotDown.id) return;
  mascotDown = null;
  clearLean(false); // also clears a pending hold timer
}

// ── Curious gaze (item 1) ───────────────────────────────────────────────
// The pupil highlights (.pupils, index.html) drift up to 3px toward the
// pointer while Jamkachu is awake. rAF-throttled, transform-only; eases
// back to center on leave or after 3s idle (CSS transition). Skipped while
// asleep or hatching; fully static under reduced motion. No audio.
// NOTE (kiki sprites, 2026-08-11): the designer sprite has no separately
// addressable pupils, so the pipeline below quietly no-ops on its null
// checks — kept because the gazeReset/gazeActive contracts are shared with
// the sleep path and the idle behaviors above.

const GAZE_MAX_PX = 3;
const GAZE_IDLE_MS = 3000;
let gazeFrame = null;
let gazePointer = null; // latest {x, y} awaiting the next frame
let gazeIdleTimer = null;
let gazeActive = false; // pupils are currently off-center

function gazeReset() {
  if (gazeIdleTimer !== null) {
    clearTimeout(gazeIdleTimer);
    gazeIdleTimer = null;
  }
  if (gazeFrame !== null) {
    cancelAnimationFrame(gazeFrame);
    gazeFrame = null;
  }
  gazePointer = null;
  if (!gazeActive) return;
  gazeActive = false;
  const pupils = $(".mascot-svg .pupils");
  if (pupils) pupils.style.transform = ""; // CSS transition eases them home
}

function gazeApply() {
  gazeFrame = null;
  if (!gazePointer) return;
  if (sleepShown || hatchActive || tourActive) {
    gazeReset();
    return;
  }
  const pupils = $(".mascot-svg .pupils");
  const svg = $(".mascot-svg");
  if (!pupils || !svg) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // Eye-line center (~x 140, y 52 in the 300x350 viewBox) in screen px.
  const cx = rect.left + (140 / 300) * rect.width;
  const cy = rect.top + (52 / 350) * rect.height;
  const dx = gazePointer.x - cx;
  const dy = gazePointer.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const pull = Math.min(1, len / 40) * GAZE_MAX_PX; // nearby pointers pull less
  // Clamp: the highlights sit 2px from each eye's left/top edge — never
  // let them spill out of the pixel eye.
  const tx = Math.max(-2, Math.min(3, (dx / len) * pull));
  const ty = Math.max(-2, Math.min(3, (dy / len) * pull));
  pupils.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
  gazeActive = true;
  if (gazeIdleTimer !== null) clearTimeout(gazeIdleTimer);
  gazeIdleTimer = setTimeout(gazeReset, GAZE_IDLE_MS);
}

function onGazeMove(event) {
  if (prefersReducedMotion() || sleepShown || hatchActive || tourActive) return;
  gazePointer = { x: event.clientX, y: event.clientY };
  if (gazeFrame === null) gazeFrame = requestAnimationFrame(gazeApply);
}

// ── Pressable vital rows (plan T19) ─────────────────────────────────────
// Tapping an env-strip value makes Jamkachu comment in the speech bubble
// using the SAME thresholds as the mood engine (threshold-true lines from
// PM().vitals), so a comment can never contradict the current mood. The
// hysteresis bands (temp 28–32, humidity 40–45) stay silent on purpose.
// At night a light tap gets the gentle night line, never a "dark" warning.
// Zero XP, zero writes; 2s shared cooldown; bubble restores like petting.

const VITAL_TAP_COOLDOWN_MS = 2000;
const VITAL_TEMP_HOT = 32; // > 32 → hot (Overheating threshold)
const VITAL_TEMP_COLD = 14; // < 14 → cold (TooCold threshold)
const VITAL_HUM_DRY = 40; // < 40 → dry (DryAir threshold)
const VITAL_HUM_GOOD = 45; // >= 45 → good (recovery threshold)
const VITAL_HUM_HUMID = 60; // > 60 → humid (HumidAir threshold)
const VITAL_PH_MIN = 6.0;
const VITAL_PH_MAX = 7.0;
const VITAL_LIGHT_MIN = 30; // Node-RED LDR is 0–100%; 30% is inclusive sufficient
const VITALS_FALLBACK = {
  tempHot: "Phew, vent please!",
  tempCold: "Brrr, warm me up!",
  tempGood: "Perfect temperature!",
  humDry: "Air feels dry",
  humHumid: "Air feels muggy",
  humGood: "The air feels lovely!",
  lightDark: "Pretty dark here",
  lightGood: "Sunbathing time!",
  lightNight: "Night 🌙 — it's supposed to be dark now. Sweet dreams!",
  phGood: "Soil feels great",
  phOff: "My soil tastes funny — mind checking the pH?",
};
let vitalTapCooldownUntil = 0;
// Latest rendered reading (null until real data) — renderSensors updates it.
const lastVitals = { temperature: null, humidity: null, light: null, soilPh: null };

function vitalString(key) {
  return PM().vitals?.[key] ?? VITALS_FALLBACK[key];
}

/** Threshold-true comment for one vital, or null when no threshold holds
 *  (unknown reading, or a hysteresis band where any claim could contradict
 *  the mood engine's current state). */
function vitalComment(kind) {
  if (kind === "temp") {
    const v = lastVitals.temperature;
    if (v == null) return null;
    if (v > VITAL_TEMP_HOT) return vitalString("tempHot");
    if (v < VITAL_TEMP_COLD) return vitalString("tempCold");
    if (v >= ECHO_TEMP_MIN && v <= ECHO_TEMP_MAX) return vitalString("tempGood");
    return null;
  }
  if (kind === "hum") {
    const v = lastVitals.humidity;
    if (v == null) return null;
    if (v < VITAL_HUM_DRY) return vitalString("humDry");
    if (v > VITAL_HUM_HUMID) return vitalString("humHumid");
    if (v >= VITAL_HUM_GOOD) return vitalString("humGood");
    return null;
  }
  if (kind === "light") {
    const v = lastVitals.light;
    if (!Number.isFinite(v)) return null;
    if (v >= VITAL_LIGHT_MIN) return vitalString("lightGood");
    // Night (spec §6.2): dark is normal — gentle night line, no warning.
    return isNightWIB() ? vitalString("lightNight") : vitalString("lightDark");
  }
  if (kind === "ph") {
    const v = lastVitals.soilPh;
    if (v == null) return null;
    return v >= VITAL_PH_MIN && v <= VITAL_PH_MAX ? vitalString("phGood") : vitalString("phOff");
  }
  return null;
}

// One-time pressable invite (kid-guide Task 1): until the very first tile
// tap ever, the tiles carry .env-invite (a gentle CSS wiggle, reduced-motion
// gated) so they read as buttons. The first tap retires it FOREVER via
// PMSeen "tiles.tried" — cosmetic only, nothing granted.
const TILES_SEEN_ID = "tiles.tried";
let tileInviteRetired = pmSeenFlag(TILES_SEEN_ID);

function retireTileInvite() {
  if (tileInviteRetired) return;
  tileInviteRetired = true;
  pmMarkSeen(TILES_SEEN_ID);
  for (const el of document.querySelectorAll(".env-hud-card.env-invite")) el.classList.remove("env-invite");
}

function onVitalTap(kind) {
  // Retire the invite wiggle on ANY tile tap — even one that lands inside
  // the comment cooldown or has nothing true to say.
  retireTileInvite();
  const now = Date.now();
  if (now < vitalTapCooldownUntil) return;
  const line = vitalComment(kind);
  if (!line) return; // nothing true to say — never invent a comment
  vitalTapCooldownUntil = now + VITAL_TAP_COOLDOWN_MS;
  window.PMSfx?.play("blip");
  showTransientBubble(line, PET_BUBBLE_RESTORE_MS);
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
      // The care button plays its own mood-appropriate cue instead.
      if (target.id !== "care-action") {
        window.PMSfx?.play("blip");
      }
    },
    { passive: true },
  );

  $("#care-action")?.addEventListener("pointerdown", onCareAction);
  // Keyboard activation (it's a real <button>): click with detail 0 means
  // Enter/Space — pointer taps already went through pointerdown above.
  // Same pattern as #npc-farmer.
  $("#care-action")?.addEventListener("click", (event) => {
    if (event.detail === 0) onCareAction();
  });

  // Tactile mascot pipeline (items 2/3/5/6): taps resolve on release so a
  // ≥600ms head hold can become the lean-in and a slow night drag the
  // lullaby; quick taps still land in petMascot with their body part.
  const mascotEl = $(".mascot-wrapper");
  if (mascotEl) {
    mascotEl.addEventListener("pointerdown", startMascotPointer);
    mascotEl.addEventListener("pointermove", moveMascotPointer);
    mascotEl.addEventListener("pointerup", endMascotPointer);
    mascotEl.addEventListener("pointercancel", cancelMascotPointer);
  }

  // Curious gaze (item 1): pupils track the pointer across the mascot
  // stage; leaving the stage eases them back to center.
  const stageEl = $(".mascot-stage");
  if (stageEl) {
    stageEl.addEventListener("pointermove", onGazeMove, { passive: true });
    stageEl.addEventListener("pointerleave", gazeReset);
  }

  // Pressable vitals (plan T19): pointer + keyboard (role=button spans).
  const vitalCards = { temp: "temp", hum: "hum", light: "light", ph: "ph" };
  for (const [key, kind] of Object.entries(vitalCards)) {
    const el = $(`[data-vital="${key}"]`);
    if (!el) continue;
    el.addEventListener("pointerdown", () => onVitalTap(kind));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onVitalTap(kind);
      }
    });
  }
  // Tile invite wiggle (kid-guide Task 1): only while "tiles.tried" is
  // unseen — the first onVitalTap above retires it forever.
  if (!tileInviteRetired) {
    for (const el of document.querySelectorAll(".env-hud-card")) el.classList.add("env-invite");
  }

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

// ── Living world (dusk sky · fireflies · idle life · wind · grandpa NPC) ──
// All pure presentation and STATE, never celebration: the night class
// mirrors the WIB clock, the ambient behaviors grant nothing, count nothing
// toward anything, and write nothing. Reduced motion: JS guards skip every
// moving behavior here, and the CSS keyframes are additionally media-gated.

// (2) Dusk sky: re-evaluated from updateCareUi (every mood render + the
// existing 60s clock). INDEPENDENT of sleepShown on purpose — sleep is
// Happy-only (spec §6.2) but the sky must stay honest about the real time
// of day. Composes with room-warm/env-hot; the night overlay paints above
// them. Silent — no cue, no copy.
function applyNightUi() {
  const now = wibNow();
  // "auto" keeps the honest WIB clock; an explicit Day/Night pick overrides
  // it, which is what the sidebar's THEME control is for.
  const theme = readFarmTheme();
  const night = theme === "night" ? true
    : theme === "day" ? false
      : now ? now.hour >= SLEEP_START_HOUR || now.hour < SLEEP_END_HOUR : false;
  document.body?.classList.toggle("night", night);
  const farmerTag = $("#npc-farmer .npc-ai-tag");
  // Local COPY dictionary (id "CHAT AI") — strings.js has no npc group, so
  // the old PM().npc read always fell through to English after updateCareUi.
  if (farmerTag) farmerTag.textContent = night ? "Zzz.." : t("npc.ai");
  if (!night) {
    if (farmerNightSleepTimer !== null) window.clearTimeout(farmerNightSleepTimer);
    farmerNightSleepTimer = null;
    document.body?.classList.remove("farmer-night-awake");
    const farmer = $("#npc-farmer");
    farmer?.classList.remove("npc-night-awake");
    farmer?.style.removeProperty("--farmer-awake-left");
    farmer?.style.removeProperty("--farmer-awake-top");
  }
  if (night) $("#npc-farmer")?.classList.remove("npc-farming");
  const celestial = $(".env-sun");
  if (celestial && now) {
    const hour = now.hour + now.minute / 60;
    const progress = night
      ? (hour >= SLEEP_START_HOUR ? hour - SLEEP_START_HOUR : hour + 24 - SLEEP_START_HOUR) / 12
      : (hour - SLEEP_END_HOUR) / 12;
    const clamped = Math.max(0, Math.min(1, progress));
    celestial.style.setProperty("--celestial-x", `${8 + clamped * 84}%`);
    celestial.style.setProperty("--celestial-y", `${70 - Math.sin(Math.PI * clamped) * 58}%`);
  }
  if (night) clearFarmerBubble(); // grandpa is asleep in bed — end any mid-line chat
  syncFireflies();
}

// (3) Fireflies: 6–8 glowing 4px pixels in slow CSS figure-eights (shell
// drifts X over the full period, dot drifts Y at half period — a Lissajous
// 1:2) with steps(1) blinks, only while body.night is active AND the tab is
// visible. JS only spawns/removes the long-lived elements; they count
// against the shared particle budget and release it on removal (the 06:00
// flip or a tab hide).
const FIREFLY_BASE = 6; // + up to 2 random extras → 6–8
let fireflies = [];

function spawnFireflies() {
  if (fireflies.length > 0) return; // already lit
  const layer = ensureFxLayer();
  if (!layer) return;
  const want = FIREFLY_BASE + Math.floor(Math.random() * 3);
  const n = Math.max(0, Math.min(want, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < n; i++) {
    const fly = document.createElement("div");
    fly.className = "fx-firefly";
    fly.setAttribute("aria-hidden", "true");
    fly.style.left = `${(4 + Math.random() * 88).toFixed(1)}vw`;
    fly.style.bottom = `${Math.round(118 + Math.random() * 96)}px`; // above the grass
    const period = 7 + Math.random() * 4; // full figure-eight period (s)
    fly.style.animationDuration = `${period.toFixed(2)}s`;
    fly.style.animationDelay = `${(-Math.random() * period).toFixed(2)}s`;
    const dot = document.createElement("span");
    dot.className = "fx-firefly-dot";
    dot.style.animationDuration = `${(period / 2).toFixed(2)}s, ${(2.2 + Math.random() * 1.6).toFixed(2)}s`;
    dot.style.animationDelay = `${(-Math.random() * period).toFixed(2)}s, ${(-Math.random() * 3).toFixed(2)}s`;
    fly.appendChild(dot);
    layer.appendChild(fly);
    liveParticles++;
    fireflies.push(fly);
  }
}

function clearFireflies() {
  for (const fly of fireflies) {
    fly.remove();
    liveParticles = Math.max(0, liveParticles - 1);
  }
  fireflies = [];
}

function syncFireflies() {
  if (isNightWIB() && document.visibilityState === "visible") spawnFireflies();
  else clearFireflies();
}

document.addEventListener("visibilitychange", syncFireflies);

// (4) Idle micro-behaviors: after 60–120s with NO pointer interaction (and
// only while: tab visible, awake, celebration queue idle, speech bubble
// idle, not hatching, no active press), Jamkachu looks around, slowly
// squash-stretches, or ruffles its leaves. The soft 'hum' cue plays on
// every third behavior at most. The interaction timestamp is the ONLY
// state — nothing is counted toward anything or persisted. Skipped
// entirely under reduced motion.
const IDLE_MIN_MS = 60_000;
const IDLE_MAX_MS = 120_000;
const IDLE_HUM_EVERY = 3;
let lastPointerAt = Date.now();
let idleBehaviorCount = 0;

const notePointerActivity = () => {
  lastPointerAt = Date.now();
};
document.addEventListener("pointerdown", notePointerActivity, { capture: true, passive: true });
document.addEventListener("pointermove", notePointerActivity, { capture: true, passive: true });

/** Look-around glance: the sprite has no separately addressable pupils, so
 *  the whole body shifts a couple of px, holds, and eases home (WAAPI —
 *  animateSafe is a no-op where unsupported). Never fights the gaze state. */
function idleLookAround() {
  if (gazeActive) return; // the pointer gaze owns the mascot right now
  const spriteEl = $("#jamkachu-sprite");
  if (!spriteEl) return;
  const tx = Math.random() < 0.5 ? -3 : 3;
  const hold = 1200 + Math.random() * 900;
  animateSafe(
    spriteEl,
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${tx}px, -1px)`, offset: 0.15 },
      { transform: `translate(${tx}px, -1px)`, offset: 0.85 },
      { transform: "translate(0, 0)" },
    ],
    { duration: hold, easing: "steps(6, end)" },
  );
}

function idleSquashStretch() {
  const wrapper = $(".mascot-wrapper");
  if (!wrapper) return;
  animateSafe(
    wrapper,
    [
      { transform: "scale(1, 1)" },
      { transform: "scale(1.035, 0.97)", offset: 0.35 },
      { transform: "scale(0.985, 1.02)", offset: 0.7 },
      { transform: "scale(1, 1)" },
    ],
    { duration: 1700, easing: "steps(8, end)" },
  );
}

function idleLeafRuffle() {
  const leaves = $("#jamkachu-sprite"); // whole-sprite ruffle (leaves are baked in)
  if (!leaves) return;
  animateSafe(
    leaves,
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-1.6deg)" },
      { transform: "rotate(1.4deg)" },
      { transform: "rotate(-0.7deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 550, easing: "steps(5, end)" },
  );
}

function idleHappyExpression() {
  if (careMood !== "Happy" || sleepShown) return;
  // The old expr-curious/proud/giggle face groups retired with the inline
  // SVG — a comfortable idle Jamkachu now flashes a happy-pool reaction
  // pair for a beat (same quiet gates inside showPetExpression).
  showPetExpression(undefined, 1900);
}

function maybeIdleBehavior() {
  if (prefersReducedMotion()) return; // spec: skipped entirely
  if (document.visibilityState !== "visible") return;
  if (sleepShown || hatchActive || tourActive || mascotDown) return;
  if (fxPlaying || fxQueue.length > 0) return; // never compete with a celebration
  if (petRestoreTimer !== null || petSavedBubble !== null) return; // bubble busy
  if (Date.now() - lastPointerAt < IDLE_MIN_MS) return; // user is around
  idleBehaviorCount++;
  if (idleBehaviorCount % IDLE_HUM_EVERY === 0) window.PMSfx?.play("hum");
  const roll = Math.floor(Math.random() * 4);
  if (roll === 0) idleLookAround();
  else if (roll === 1) idleSquashStretch();
  else if (roll === 2) idleLeafRuffle();
  else idleHappyExpression();
}

(function scheduleIdleBehavior() {
  setTimeout(() => {
    maybeIdleBehavior();
    scheduleIdleBehavior();
  }, IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS));
})();

// (6) Wind gust: every random 3–6 minutes (tab visible, queue idle) the
// grass bed, the cloud sheet, and Jamkachu's leaves lean the same way for
// ~2.5s while a few leaf-green pixels drift across. Visual-only while
// asleep; the soft 'breeze' cue (the whoosh recipe at low volume) is
// daytime-only. Skipped entirely under reduced motion.
const WIND_MIN_MS = 3 * 60_000;
const WIND_MAX_MS = 6 * 60_000;
const WIND_GUST_MS = 2500;
const WIND_LEAF_COLORS = ["#69C455", "#89D974", "#397A2B"];

function spawnWindLeaves() {
  const layer = ensureFxLayer();
  if (!layer) return;
  const n = Math.max(0, Math.min(3 + Math.floor(Math.random() * 2), MAX_PARTICLES - liveParticles));
  for (let i = 0; i < n; i++) {
    const bit = document.createElement("div");
    bit.className = "fx-confetti";
    bit.setAttribute("aria-hidden", "true");
    const size = 5 + Math.floor(Math.random() * 3);
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.background = WIND_LEAF_COLORS[i % WIND_LEAF_COLORS.length];
    bit.style.left = "-20px";
    bit.style.top = `${Math.round(window.innerHeight * (0.4 + Math.random() * 0.35))}px`;
    layer.appendChild(bit);
    liveParticles++;
    const drift = window.innerWidth + 60;
    const duration = 1700 + Math.random() * 700;
    animateSafe(
      bit,
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
        { transform: `translate(${Math.round(drift * 0.2)}px, ${-Math.round(12 + Math.random() * 18)}px) rotate(120deg)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${drift}px, ${Math.round(16 + Math.random() * 40)}px) rotate(${Math.round(300 + Math.random() * 120)}deg)`, opacity: 0.85 },
      ],
      { duration, delay: i * 140, easing: "steps(12, end)", fill: "forwards" },
    );
    removeLater(bit, duration + i * 140 + 100, true);
  }
}

function maybeWindGust() {
  if (prefersReducedMotion()) return; // spec: skipped entirely
  if (document.visibilityState !== "visible") return;
  if (fxPlaying || fxQueue.length > 0 || hatchActive || tourActive) return;
  document.body?.classList.add("fx-wind");
  setTimeout(() => document.body?.classList.remove("fx-wind"), WIND_GUST_MS);
  const leaves = $("#jamkachu-sprite");
  if (leaves) {
    // WAAPI wins over the CSS breath animation for the gust's duration, so
    // the sprite leans the same direction as the grass/cloud containers.
    animateSafe(
      leaves,
      [
        { transform: "skewX(0deg)" },
        { transform: "skewX(-6deg)", offset: 0.25 },
        { transform: "skewX(-6deg)", offset: 0.75 },
        { transform: "skewX(0deg)" },
      ],
      { duration: WIND_GUST_MS, easing: "steps(10, end)" },
    );
  }
  spawnWindLeaves();
  // Daytime-only sound; a sleeping Jamkachu keeps the gust visual-only.
  if (!sleepShown && !isNightWIB()) window.PMSfx?.play("breeze");
}

(function scheduleWindGust() {
  setTimeout(() => {
    maybeWindGust();
    scheduleWindGust();
  }, WIND_MIN_MS + Math.random() * (WIND_MAX_MS - WIND_MIN_MS));
})();

// (7) Farmer grandpa NPC: wanders the grass floor behind the stage (pure
// CSS), gone at night (body.night hides him), and every 2–4 minutes — or
// instantly when tapped, sharing ONE 60s cooldown — offers a grandpa-voiced
// guidance line for the CURRENT mood. STRICTLY sensor-grounded, mirroring
// the care button's honesty rules: only what the mood engine already knows,
// and NEVER watering/fertilizing (those sensors do not exist). Tapping him
// grants NOTHING, ever — he is pure guidance and charm.
const FARMER_BUBBLE_MS = 6000;
const FARMER_COOLDOWN_MS = 25_000;
const FARMER_FIRST_MIN_MS = 8_000;
const FARMER_FIRST_MAX_MS = 15_000;
const FARMER_AUTO_MIN_MS = 35_000;
const FARMER_AUTO_MAX_MS = 70_000;
const FARMER_ACTIVITY_QUIET_MS = 20_000;
const FARMER_FARMING_MS = 3_600;
// English fallbacks — PM_STRINGS.farmer carries the localized sets. Both
// soil moods share the "Soil" family, exactly like the care button.
const FARMER_FALLBACK = {
  Overheating: [
    "Hoho… this room is toasty. A shadier, cooler spot would do the little one good.",
    "Phew! Even my hat feels warm. Find your friend somewhere cooler, hm?",
  ],
  TooCold: [
    "Hoho… this room is nippy. A warmer spot would do the little one good.",
    "Brr! Even my old bones feel it. Move your friend somewhere warmer, hm?",
  ],
  DryAir: [
    "Hoho… the air is thirsty-dry. Away from fans and drafts it gets cozier.",
    "My old whiskers feel the dry air too. A calmer corner would help, hm?",
  ],
  HumidAir: [
    "Hoho… the air is heavy and damp. A little fresh airflow would help, hm?",
    "My old whiskers feel the mugginess too. Crack a window for the little one.",
  ],
  Sleepy: [
    "Hoho… mighty dim in here. Open a curtain — plants love a bright morning.",
    "A little sunshine works wonders. Scoot the pot near a window, hm?",
  ],
  Soil: [
    "Hoho… the soil pH looks off. Check it together with your teacher, hm?",
    "Soil business is grown-up business — never add anything to the pot alone.",
  ],
  Happy: [
    "Hoho… a well-tended plant and a kind little farmer. Fine work!",
    "Patience grows the best gardens — and you have plenty of it.",
    "In all my farming years, care like yours is what makes things bloom.",
    "Listen to the sensors, little farmer — they speak for the plant.",
    "A happy plant means a watchful friend. Keep it up, hm?",
  ],
};
const FARMER_IDLE_FALLBACK = {
  en: {
    companion: [
      "Hoho… no need to hurry. Plants are very good teachers of patience.",
      "Every careful look teaches us something, even when nothing needs changing.",
      "Let’s give the little one a calm moment, then ask the sensors again.",
    ],
    wisdom: [
      "A sensor is a clue, not a command. We look, think, and check again together.",
      "Good gardeners change one small thing at a time, then watch what happens.",
    ],
  },
  id: {
    companion: [
      "Hoho… tidak perlu terburu-buru. Tanaman pandai mengajarkan kesabaran.",
      "Setiap pengamatan mengajarkan sesuatu, bahkan saat belum ada yang perlu diubah.",
      "Kita beri si kecil waktu tenang, lalu tanyakan lagi kepada sensor.",
    ],
    wisdom: [
      "Sensor itu petunjuk, bukan perintah. Kita lihat, pikirkan, lalu periksa lagi bersama.",
      "Perawat kebun yang baik mengubah satu hal kecil, lalu memperhatikan hasilnya.",
    ],
  },
};
let farmerCooldownUntil = 0;
const farmerLineIndex = {}; // per-family rotation so he never repeats verbatim
const farmerRecentLines = [];
const farmerRecentCategories = [];
let farmerLastUserActivityAt = 0;
let farmerBubbleEl = null;
let farmerBubbleTimer = null;
let farmerChatController = null;
let farmerMotionAnimation = null;
let farmerMotionPaused = false;
let farmerMotionEpoch = 0;
let farmerRestartTimer = null;
let farmerNightSleepTimer = null;
let farmerDrag = null;
let suppressFarmerClick = false;
let farmerDragPleaTimer = null;

const FARMER_CHAT_COPY = {
  id: {
    kicker: "TEMAN KEBUNMU", title: "Farmer Tani", close: "Tutup percakapan",
    hello: "Hoho… datanglah, Nak. Apa yang ingin kamu ketahui tentang tanaman kecil kita?",
    placeholder: "Tanya tentang tanaman atau sensor…", send: "TANYA",
    note: "Kakek menjelaskan data sensor. Untuk perubahan tanah, tanyakan juga kepada guru atau petani setempat.",
    thinking: "Hmm… Kakek lihat dulu, ya…", network: "Hoho… jalur pesannya sedang sepi. Coba sebentar lagi, Nak.",
    demo: "DATA SENSOR VIRTUAL · MODE DEMO",
    prompts: ["Bagaimana keadaan tanaman sekarang?", "Apakah cahayanya cukup?", "Apa arti pH tanah?"],
  },
  en: {
    kicker: "YOUR GARDEN FRIEND", title: "Farmer Tani", close: "Close chat",
    hello: "Hoho… come sit with me, my young friend. What would you like to know about our little plant?",
    placeholder: "Ask about the plant or sensors…", send: "ASK",
    note: "Grandpa explains sensor data. Ask a teacher or local farmer before changing the soil.",
    thinking: "Hmm… let Grandpa take a look…", network: "Hoho… the message path is quiet. Try me again in a little while, my young friend.",
    demo: "VIRTUAL SENSOR DATA · DEMO MODE",
    prompts: ["How is the plant doing?", "Is the light sufficient?", "What does soil pH mean?"],
  },
};

function farmerCopy() { return FARMER_CHAT_COPY[appLocale] ?? FARMER_CHAT_COPY.id; }

function setFarmerMotionPaused(paused) {
  farmerMotionPaused = paused;
  const farmer = $("#npc-farmer");
  farmer?.classList.toggle("npc-talking", paused);
  if (!farmerMotionAnimation) return;
  try {
    if (paused) farmerMotionAnimation.pause();
    else farmerMotionAnimation.play();
  } catch {}
}

function farmerDelay(ms, epoch) {
  return new Promise((resolve) => setTimeout(() => resolve(epoch === farmerMotionEpoch), ms));
}

async function farmerAnimate(keyframes, options, epoch) {
  const farmer = $("#npc-farmer");
  if (!farmer || epoch !== farmerMotionEpoch) return false;
  try {
    farmerMotionAnimation = farmer.animate(keyframes, { fill: "forwards", ...options });
    if (farmerMotionPaused) farmerMotionAnimation.pause();
    await farmerMotionAnimation.finished;
    farmerMotionAnimation = null;
    return epoch === farmerMotionEpoch;
  } catch {
    farmerMotionAnimation = null;
    return false;
  }
}

function farmerGround() {
  const farmer = $("#npc-farmer");
  const grass = $(".grass-floor");
  if (!farmer || !grass) return null;
  const rect = grass.getBoundingClientRect();
  const width = farmer.offsetWidth || 48;
  const height = farmer.offsetHeight || 56;

  // Vertically he must stand ON the grass, so `top` stays measured from it.
  //
  // Horizontally the whole grass strip is his: the status rail (.home-stack)
  // used to sit ON the grass, and since .mascot-stage is its own stacking
  // context the farmer's z-index could not lift him over those cards — walking
  // right made him vanish behind them, so the lane was clamped to the
  // character column. The rail now ends well above the floor (it carries its
  // own clamp(44px,8vh,92px) bottom margin), leaving the grass clear across
  // the full width, so the clamp is gone and he laps the whole garden.
  const left = Math.round(rect.left + 12);
  return {
    left,
    right: Math.round(Math.max(left, rect.right - width - 12)),
    top: Math.round(rect.top - height + 8),
  };
}

/**
 * Keeps .npc-facing-left in sync with the sprite's horizontal flip.
 *
 * The AI-CHAT tag is a CHILD of the button, so the scaleX(-1) that turns the
 * sprite around on the leftward leg also mirrors the tag's TEXT — half of
 * every lap the label read backwards. CSS cannot see the parent's animated
 * transform, so the flip state is mirrored onto a class and the tag
 * counter-flips there. Call this beside every write of farmer.style.transform
 * (and before any animation whose keyframes carry a scaleX).
 */
function setFarmerFacing(facing) {
  $("#npc-farmer")?.classList.toggle("npc-facing-left", facing < 0);
}

async function farmerWalkTo(x, facing, epoch, duration = 10_000) {
  const farmer = $("#npc-farmer");
  if (!farmer) return false;
  setFarmerFacing(facing); // keyframes below flip the sprite immediately
  farmer.classList.add("npc-walking");
  const from = Number.parseFloat(farmer.style.left) || x;
  const ok = await farmerAnimate(
    [{ left: `${from}px`, transform: `scaleX(${facing})` }, { left: `${x}px`, transform: `scaleX(${facing})` }],
    { duration, easing: "linear" }, epoch,
  );
  farmer.classList.remove("npc-walking");
  if (ok) { farmer.style.left = `${x}px`; farmer.style.transform = `scaleX(${facing})`; }
  return ok;
}

/** A quiet, daytime-only tending beat between walks. The hoe and soil puffs
 * are CSS art so Tani keeps the same transparent designer sprite; this loop
 * is decorative and never changes sensor values, inventory, XP, or rewards. */
async function farmerFarmPlot(epoch) {
  const farmer = $("#npc-farmer");
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!farmer || reduced || isNightWIB() || document.body?.classList.contains("night")
    || farmerDrag || epoch !== farmerMotionEpoch) return epoch === farmerMotionEpoch;
  farmer.classList.add("npc-farming");
  const completed = await farmerDelay(FARMER_FARMING_MS, epoch);
  farmer.classList.remove("npc-farming");
  return completed;
}

async function farmerFallAndClimb(ground, epoch) {
  const farmer = $("#npc-farmer");
  const vine = $("#npc-farmer-vine");
  if (!farmer || !vine || epoch !== farmerMotionEpoch) return;
  farmer.classList.add("npc-falling");
  setFarmerFacing(-1); // the teeter keyframes below hold scaleX(-1)
  await farmerAnimate([
    { transform: "translateX(0) rotate(0deg) scaleX(-1)" },
    { transform: "translateX(-5px) rotate(-9deg) scaleX(-1)" },
    { transform: "translateX(3px) rotate(8deg) scaleX(-1)" },
    { transform: "translateX(-9px) rotate(-16deg) scaleX(-1)" },
  ], { duration: 520, easing: "steps(4,end)" }, epoch);
  if (epoch !== farmerMotionEpoch) return;
  showFarmerBubble(appLocale === "id" ? "Hoho… jalannya habis! Tunggu sebentar, Nak." : "Hoho… the path ended! Hold on, my young friend.", 2600, false);
  setFarmerFacing(1); // the fall/climb keyframes replace transform without scaleX
  await farmerAnimate([
    { left: `${ground.left}px`, top: `${ground.top}px`, transform: "rotate(-16deg)" },
    { left: `${ground.left - 18}px`, top: `${ground.top + 92}px`, transform: "rotate(-4deg)" },
  ], { duration: 720, easing: "steps(5,end)" }, epoch);
  if (!(await farmerDelay(850, epoch))) return;
  vine.style.left = `${ground.left + 12}px`;
  vine.style.top = `${ground.top + 18}px`;
  vine.classList.add("is-visible");
  if (!(await farmerDelay(380, epoch))) return;
  await farmerAnimate([
    { left: `${ground.left - 18}px`, top: `${ground.top + 92}px`, transform: "rotate(0deg)" },
    { left: `${ground.left + 8}px`, top: `${ground.top + 48}px`, transform: "rotate(2deg)" },
    { left: `${ground.left + 24}px`, top: `${ground.top}px`, transform: "rotate(0deg)" },
  ], { duration: 1500, easing: "steps(8,end)" }, epoch);
  vine.classList.remove("is-visible");
  farmer.style.left = `${ground.left + 24}px`;
  farmer.style.top = `${ground.top}px`;
  farmer.style.transform = "scaleX(1)";
  farmer.classList.remove("npc-falling");
  showFarmerBubble(appLocale === "id" ? "Nah, sudah kembali! Sedikit memanjat membuat lutut tua tetap kuat, hoho." : "There we are! A little climbing keeps these old knees strong, hoho.", 3000, false);
}

async function runFarmerMotion() {
  const farmer = $("#npc-farmer");
  if (!farmer) return;
  const epoch = ++farmerMotionEpoch;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let ground = farmerGround();
  if (!ground) return;
  const previousLeft = Number.parseFloat(farmer.style.left);
  const firstPlacement = !farmer.classList.contains("npc-ready") || !Number.isFinite(previousLeft);
  const startLeft = firstPlacement
    ? ground.left + Math.max(30, (ground.right - ground.left) * .35)
    : previousLeft;
  farmer.style.left = `${Math.max(ground.left, Math.min(ground.right, startLeft))}px`;
  farmer.style.top = `${ground.top}px`;
  farmer.classList.add("npc-ready");
  if (reduced) return;
  while (epoch === farmerMotionEpoch) {
    if (isNightWIB()) {
      if (!(await farmerDelay(30_000, epoch))) return;
      continue;
    }
    ground = farmerGround();
    if (!ground) return;
    farmer.style.top = `${ground.top}px`;
    if (!(await farmerWalkTo(ground.right, 1, epoch, 12_000))) return;
    if (!(await farmerDelay(700, epoch))) return;
    if (!(await farmerFarmPlot(epoch))) return;
    if (!(await farmerDelay(900, epoch))) return;
    if (!(await farmerWalkTo(ground.left, -1, epoch, 14_000))) return;
    if (!(await farmerDelay(600, epoch))) return;
    await farmerFallAndClimb(ground, epoch);
    if (!(await farmerDelay(4200, epoch))) return;
  }
}

function restartFarmerMotion() {
  farmerMotionEpoch += 1;
  try { farmerMotionAnimation?.cancel(); } catch {}
  farmerMotionAnimation = null;
  $("#npc-farmer")?.classList.remove("npc-farming");
  $("#npc-farmer-vine")?.classList.remove("is-visible");
  window.setTimeout(() => void runFarmerMotion(), 80);
}

function scheduleFarmerNightSleep() {
  if (farmerNightSleepTimer !== null) window.clearTimeout(farmerNightSleepTimer);
  farmerNightSleepTimer = window.setTimeout(() => {
    farmerNightSleepTimer = null;
    if (!isNightWIB() || farmerDrag) return;
    clearFarmerBubble();
    document.body?.classList.remove("farmer-night-awake");
    const farmer = $("#npc-farmer");
    farmer?.classList.remove("npc-night-awake", "npc-grabbed", "npc-landing");
    farmer?.style.removeProperty("--farmer-awake-left");
    farmer?.style.removeProperty("--farmer-awake-top");
    restartFarmerMotion();
  }, 3000);
}

function wakeFarmerAtNight() {
  if (!isNightWIB()) return false;
  const farmer = $("#npc-farmer");
  if (!farmer) return false;
  if (farmerNightSleepTimer !== null) window.clearTimeout(farmerNightSleepTimer);
  farmerNightSleepTimer = null;
  const wasSleeping = !farmer.classList.contains("npc-night-awake");
  const rect = farmer.getBoundingClientRect();
  const ground = farmerGround();
  document.body?.classList.add("farmer-night-awake");
  farmer.classList.add("npc-night-awake");
  if (wasSleeping) {
    // `rect` belongs to the rotated, scaled sleeping sprite. Reusing its top
    // after removing that transform stands the upright farmer at mattress
    // height, where he appears to float. Keep his horizontal bed position,
    // but put his feet on the measured grass floor when he wakes.
    const uprightWidth = farmer.offsetWidth || 48;
    const wakeLeft = ground
      ? Math.max(ground.left, Math.min(ground.right, rect.left + rect.width / 2 - uprightWidth / 2))
      : rect.left;
    farmer.style.left = `${wakeLeft}px`;
    farmer.style.top = `${ground?.top ?? rect.top}px`;
    farmer.style.setProperty("--farmer-awake-left", `${wakeLeft}px`);
    farmer.style.setProperty("--farmer-awake-top", `${ground?.top ?? rect.top}px`);
    farmer.style.transform = "none";
    setFarmerFacing(1);
  }
  return true;
}

function startFarmerDrag(event) {
  const farmer = event.currentTarget;
  if (event.button !== 0 || farmerDrag || hatchActive || tourActive
    || farmer.classList.contains("npc-falling") || $("#farmer-chat")?.open) return;
  wakeFarmerAtNight();
  const rect = farmer.getBoundingClientRect();
  if (farmerRestartTimer !== null) window.clearTimeout(farmerRestartTimer);
  farmerRestartTimer = null;
  farmerMotionEpoch += 1;
  // Every farmerAnimate() runs with fill:"forwards" but only the newest is
  // held in farmerMotionAnimation — which farmerAnimate itself nulls once the
  // animation finishes. A finished forwards-filling animation keeps applying
  // its end left/top from the animation origin, and that outranks the inline
  // styles moveFarmerDrag writes, so the sprite refused to follow the pointer.
  // Cancel every animation on the element, not just the tracked one. `rect` is
  // measured above, while they still hold him, so he does not jump on grab.
  try { farmer.getAnimations().forEach((animation) => animation.cancel()); } catch {}
  farmerMotionAnimation = null;
  clearFarmerBubble();
  farmer.style.left = `${rect.left}px`;
  farmer.style.top = `${rect.top}px`;
  if (farmer.classList.contains("npc-night-awake")) {
    farmer.style.setProperty("--farmer-awake-left", `${rect.left}px`);
    farmer.style.setProperty("--farmer-awake-top", `${rect.top}px`);
  }
  farmer.style.transform = "none";
  setFarmerFacing(1); // carried upright — the grab/landing transforms have no scaleX
  farmer.classList.remove("npc-walking", "npc-talking", "npc-farming");
  // moveFarmerDrag's preventDefault only starts after the 6px slop, so without
  // this the first few pixels of every grab swept a text selection across the
  // name/mood lines behind him and left them highlighted blue.
  document.body?.classList.add("farmer-dragging");
  farmer.setPointerCapture?.(event.pointerId);
  farmerDrag = {
    id: event.pointerId, startX: event.clientX, startY: event.clientY,
    offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
    moved: false,
  };
  farmerDragPleaTimer = window.setTimeout(() => {
    farmerDragPleaTimer = null;
    if (!farmerDrag?.moved) return;
    showFarmerBubble(appLocale === "id"
      ? "Aduh, Kakek takut! Tolong turunkan Kakek, Nak!"
      : "Oh my, this is scary! Please put me down, my young friend!", 4200, false);
  }, 2500);
}

function moveFarmerDrag(event) {
  const drag = farmerDrag;
  const farmer = $("#npc-farmer");
  if (!drag || !farmer || event.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
  event.preventDefault();
  drag.moved = true;
  farmer.classList.add("npc-grabbed");
  const width = farmer.offsetWidth || 48;
  const height = farmer.offsetHeight || 56;
  farmer.style.left = `${Math.max(0, Math.min(window.innerWidth - width, event.clientX - drag.offsetX))}px`;
  farmer.style.top = `${Math.max(0, Math.min(window.innerHeight - height, event.clientY - drag.offsetY))}px`;
  if (farmer.classList.contains("npc-night-awake")) {
    farmer.style.setProperty("--farmer-awake-left", farmer.style.left);
    farmer.style.setProperty("--farmer-awake-top", farmer.style.top);
  }
  if (farmerBubbleEl) {
    const left = Number.parseFloat(farmer.style.left) || 0;
    const top = Number.parseFloat(farmer.style.top) || 0;
    farmerBubbleEl.style.left = `${Math.round(Math.max(120, Math.min(left + width / 2, window.innerWidth - 120)))}px`;
    farmerBubbleEl.style.top = `${Math.round(top - 8)}px`;
  }
}

async function endFarmerDrag(event) {
  const drag = farmerDrag;
  const farmer = $("#npc-farmer");
  if (!drag || !farmer || event.pointerId !== drag.id) return;
  farmerDrag = null;
  if (farmerDragPleaTimer !== null) window.clearTimeout(farmerDragPleaTimer);
  farmerDragPleaTimer = null;
  farmer.releasePointerCapture?.(event.pointerId);
  document.body?.classList.remove("farmer-dragging"); // before the early return below
  if (!drag.moved) {
    // A night tap wakes him in place. Restarting the wander loop here makes
    // the just-woken fixed-position sprite run through daytime placement and
    // briefly snap toward the page centre before the sleep timer restores it.
    if (isNightWIB()) {
      scheduleFarmerNightSleep();
    } else {
      restartFarmerMotion();
    }
    return;
  }
  suppressFarmerClick = true;
  window.setTimeout(() => { suppressFarmerClick = false; }, 0);
  const ground = farmerGround();
  if (!ground) { restartFarmerMotion(); return; }
  const currentLeft = Number.parseFloat(farmer.style.left) || ground.left;
  const currentTop = Number.parseFloat(farmer.style.top) || ground.top;
  const landingLeft = Math.max(ground.left, Math.min(ground.right, currentLeft));
  const epoch = ++farmerMotionEpoch;
  farmer.classList.remove("npc-grabbed");
  farmer.classList.add("npc-landing");
  await farmerAnimate([
    { left: `${currentLeft}px`, top: `${currentTop}px`, transform: "rotate(0deg) scale(1.08)" },
    { left: `${landingLeft}px`, top: `${ground.top - 8}px`, transform: "rotate(0deg) scale(.94)", offset: .82 },
    { left: `${landingLeft}px`, top: `${ground.top}px`, transform: "rotate(0deg) scale(1)" },
  ], { duration: 520, easing: "cubic-bezier(.2,.8,.25,1)" }, epoch);
  farmer.classList.remove("npc-landing");
  farmer.style.left = `${landingLeft}px`;
  farmer.style.top = `${ground.top}px`;
  if (farmer.classList.contains("npc-night-awake")) {
    farmer.style.setProperty("--farmer-awake-left", `${landingLeft}px`);
    farmer.style.setProperty("--farmer-awake-top", `${ground.top}px`);
  }
  farmer.style.transform = "scaleX(1)";
  setFarmerFacing(1);
  restartFarmerMotion();
  if (isNightWIB()) scheduleFarmerNightSleep();
}

function cancelFarmerDrag(event) {
  if (!farmerDrag || event.pointerId !== farmerDrag.id) return;
  void endFarmerDrag(event);
}

function scheduleFarmerMotionRestart() {
  if (farmerDrag) return;
  if (farmerRestartTimer !== null) window.clearTimeout(farmerRestartTimer);
  farmerRestartTimer = window.setTimeout(() => {
    farmerRestartTimer = null;
    restartFarmerMotion();
  }, 180);
}

/** Next grandpa line for the CURRENT mood (Sleepy is inherently daytime-only
 *  here: at night farmerSpeak bails before ever picking a line). */
function farmerLine() {
  const family = CARE_KEY_BY_MOOD[careMood] ?? "Happy";
  const table = PM().farmer?.[family];
  const set = Array.isArray(table) && table.length > 0 ? table : FARMER_FALLBACK[family];
  const index = farmerLineIndex[family] ?? 0;
  farmerLineIndex[family] = index + 1;
  return set[index % set.length];
}

function randomFarmerLine(lines) {
  const available = lines.filter((line) => !farmerRecentLines.includes(line));
  const pool = available.length > 0 ? available : lines;
  return pool[Math.floor(Math.random() * pool.length)] ?? farmerLine();
}

function autonomousFarmerLine() {
  const family = CARE_KEY_BY_MOOD[careMood] ?? "Happy";
  const localizedFarmer = PM().farmer;
  const moodLines = Array.isArray(localizedFarmer?.[family]) && localizedFarmer[family].length > 0
    ? localizedFarmer[family]
    : FARMER_FALLBACK[family];
  const idle = localizedFarmer?.idle ?? FARMER_IDLE_FALLBACK[appLocale] ?? FARMER_IDLE_FALLBACK.id;
  let categories = family === "Happy"
    ? [{ key: "mood", weight: .35, lines: moodLines }, { key: "companion", weight: .4, lines: idle.companion }, { key: "wisdom", weight: .25, lines: idle.wisdom }]
    : [{ key: "mood", weight: .55, lines: moodLines }, { key: "companion", weight: .3, lines: idle.companion }, { key: "wisdom", weight: .15, lines: idle.wisdom }];
  const lastTwo = farmerRecentCategories.slice(-2);
  if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1]) categories = categories.filter((entry) => entry.key !== lastTwo[0]);
  const total = categories.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  const selected = categories.find((entry) => { roll -= entry.weight; return roll <= 0; }) ?? categories[0];
  const line = randomFarmerLine(Array.isArray(selected.lines) ? selected.lines : moodLines);
  farmerRecentLines.push(line);
  farmerRecentCategories.push(selected.key);
  if (farmerRecentLines.length > 3) farmerRecentLines.shift();
  if (farmerRecentCategories.length > 3) farmerRecentCategories.shift();
  return line;
}

function farmerCanSpeakAutonomously() {
  const farmer = $("#npc-farmer");
  return document.visibilityState === "visible"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    && !isNightWIB()
    && !hatchActive
    && !tourActive
    && !fxPlaying
    && fxQueue.length === 0
    && !farmerBubbleEl
    && !$("#farmer-chat")?.open
    && !farmer?.classList.contains("npc-falling")
    && !farmer?.classList.contains("npc-grabbed")
    && Date.now() - farmerLastUserActivityAt >= FARMER_ACTIVITY_QUIET_MS;
}

function clearFarmerBubble() {
  if (farmerBubbleTimer !== null) {
    clearTimeout(farmerBubbleTimer);
    farmerBubbleTimer = null;
  }
  farmerBubbleEl?.remove();
  farmerBubbleEl = null;
  if (!$("#farmer-chat")?.open) setFarmerMotionPaused(false);
}

function showFarmerBubble(text, duration = FARMER_BUBBLE_MS, pauseMotion = true) {
  const farmer = $("#npc-farmer");
  if (!farmer) return false;
  clearFarmerBubble();
  if (pauseMotion) setFarmerMotionPaused(true);
  const rect = farmer.getBoundingClientRect();
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "npc-bubble";
  bubble.setAttribute("aria-live", "polite");
  bubble.setAttribute("aria-label", `${text} ${appLocale === "id" ? "Ketuk untuk berbicara dengan Farmer Tani." : "Tap to talk with Farmer Tani."}`);
  const line = document.createElement("span");
  line.textContent = text;
  const cta = document.createElement("small");
  cta.textContent = appLocale === "id" ? "✨ KETUK UNTUK CHAT AI" : "✨ TAP FOR AI CHAT";
  bubble.append(line, cta);
  bubble.addEventListener("click", openFarmerChat);
  bubble.style.left = `${Math.round(Math.max(120, Math.min(rect.left + rect.width / 2, window.innerWidth - 120)))}px`;
  bubble.style.top = `${Math.round(rect.top - 8)}px`;
  document.body.appendChild(bubble);
  farmerBubbleEl = bubble;
  farmerBubbleTimer = setTimeout(clearFarmerBubble, duration);
  return true;
}

/** Show one guidance bubble above grandpa's hat (he pauses mid-stride while
 *  talking — .npc-talking freezes the wander). Returns false when the shared
 *  60s cooldown, the night, or the hatching intro swallowed it. */
function farmerSpeak(line = farmerLine()) {
  const farmer = $("#npc-farmer");
  if (!farmer || isNightWIB() || hatchActive || tourActive || farmer.classList.contains("npc-falling") || $("#farmer-chat")?.open) return false;
  const now = Date.now();
  if (now < farmerCooldownUntil) return false;
  farmerCooldownUntil = now + FARMER_COOLDOWN_MS;
  return showFarmerBubble(line);
}

function addFarmerChatMessage(kind, text, marker) {
  const log = $("#farmer-chat-log");
  if (!log) return null;
  const message = document.createElement("p");
  message.className = `farmer-chat-message is-${kind}${marker ? ` ${marker}` : ""}`;
  message.textContent = kind === "farmer" ? "" : text;
  log.appendChild(message);
  while (log.children.length > 8) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
  if (kind === "farmer") typeFarmerMessage(message, text);
  return message;
}

function typeFarmerMessage(element, text) {
  if (!element) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { element.textContent = text; return; }
  let index = 0;
  const timer = window.setInterval(() => {
    index += 1; element.textContent = text.slice(0, index); element.parentElement.scrollTop = element.parentElement.scrollHeight;
    if (index >= text.length || !element.isConnected) window.clearInterval(timer);
  }, 18);
  element.addEventListener("click", () => { index = text.length; element.textContent = text; window.clearInterval(timer); }, { once: true });
}

function showFarmerIntelligence(running) {
  const panel = $("#farmer-chat-system");
  if (!panel) return;
  panel.hidden = false;
  const lines = appLocale === "id" ? ["membaca kondisi tanaman", "memuat sensor terbaru", "memeriksa misi aktif", "mengunci aturan keselamatan", running ? "menyusun jawaban ramah..." : "jawaban aman siap"] : ["reading plant mood", "loading latest sensors", "checking active quest", "locking safety rules", running ? "forming a friendly answer..." : "safe response ready"];
  const title = appLocale === "id" ? "PANDUAN KAKEK TANI" : "GRANDPA'S GARDEN TIPS";
  panel.innerHTML = `<b>${title}</b>${lines.map((line, index) => `<span style="--delay:${index * 90}ms">&gt; ${line}</span>`).join("")}`;
  panel.classList.toggle("is-running", running);
}

function prepareFarmerChat() {
  const copy = farmerCopy();
  setText("#farmer-chat-kicker", copy.kicker);
  setText("#farmer-chat-title", copy.title);
  setText("#farmer-chat-send", copy.send);
  setText("#farmer-chat-note", copy.note);
  const close = $(".farmer-chat-close");
  if (close) close.setAttribute("aria-label", copy.close);
  const input = $("#farmer-chat-input");
  if (input) input.placeholder = copy.placeholder;
  const prompts = $("#farmer-chat-prompts");
  if (prompts) {
    prompts.replaceChildren(...copy.prompts.map((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => { if (input) input.value = label; $("#farmer-chat-form")?.requestSubmit(); });
      return button;
    }));
  }
  const log = $("#farmer-chat-log");
  if (log && log.children.length === 0) addFarmerChatMessage("farmer", copy.hello);
}

function openFarmerChat() {
  const dialog = $("#farmer-chat");
  if (!dialog || dialog.hasAttribute("open") || $("#npc-farmer")?.classList.contains("npc-falling")) return;
  clearFarmerBubble();
  prepareFarmerChat();
  showFarmerIntelligence(false);
  setFarmerMotionPaused(true);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  $("#farmer-chat-input")?.focus();
  window.PMSfx?.play("tick");
}

$("#farmer-chat")?.addEventListener("close", () => {
  farmerChatController?.abort();
  farmerChatController = null;
  setFarmerMotionPaused(false);
});
$("#farmer-chat")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
$("#farmer-chat-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#farmer-chat-input");
  const send = $("#farmer-chat-send");
  const question = input?.value.trim();
  if (!question || !send) return;
  input.value = "";
  input.disabled = true;
  send.disabled = true;
  addFarmerChatMessage("user", question);
  const thinking = addFarmerChatMessage("farmer", farmerCopy().thinking, "is-thinking");
  showFarmerIntelligence(true);
  farmerChatController?.abort();
  farmerChatController = new AbortController();
  const timeout = window.setTimeout(() => farmerChatController?.abort(), 6500);
  try {
    const response = await fetch("/api/farmer-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // While the sandbox owns the screen it owns Grandpa's answer too: send
      // the values the tiles are showing, or he replies about the real row and
      // contradicts the garden the class is looking at. Only ever sent while
      // PMCheat is active — normal play posts nothing here and the route falls
      // straight back to the sensors.
      body: JSON.stringify({
        question,
        locale: appLocale,
        demo: window.__pmSupabaseConfigured !== true,
        cheatVitals: window.PMCheat?.isActive() ? window.PMCheat.getState()?.vitals : undefined,
      }),
      signal: farmerChatController.signal,
    });
    const result = response.ok ? await response.json() : null;
    thinking?.remove();
    const dialog = $("#farmer-chat");
    if (result?.dataSource === "demo" && dialog?.dataset.demoShown !== "true") {
      addFarmerChatMessage("system", farmerCopy().demo);
      dialog.dataset.demoShown = "true";
    }
    addFarmerChatMessage("farmer", typeof result?.reply === "string" ? result.reply : farmerCopy().network);
    showFarmerIntelligence(false);
  } catch {
    thinking?.remove();
    if ($("#farmer-chat")?.open) addFarmerChatMessage("farmer", farmerCopy().network);
    showFarmerIntelligence(false);
  } finally {
    window.clearTimeout(timeout);
    farmerChatController = null;
    input.disabled = false;
    send.disabled = false;
    if ($("#farmer-chat")?.open) input.focus();
  }
});

$("#npc-farmer")?.addEventListener("pointerdown", startFarmerDrag);
// Listen on the window while grabbed: pointer capture is not reliable on
// every embedded/mobile browser once the cursor leaves this tiny sprite.
window.addEventListener("pointermove", moveFarmerDrag, { passive: false });
window.addEventListener("pointerup", (event) => void endFarmerDrag(event));
window.addEventListener("pointercancel", cancelFarmerDrag);
$("#npc-farmer")?.addEventListener("click", (event) => {
  if (suppressFarmerClick) {
    suppressFarmerClick = false;
    event.preventDefault();
    return;
  }
  if (isNightWIB()) {
    wakeFarmerAtNight();
    scheduleFarmerNightSleep();
    event.preventDefault();
    return;
  }
  openFarmerChat();
});

document.addEventListener("pointerdown", () => { farmerLastUserActivityAt = Date.now(); }, { capture: true, passive: true });
document.addEventListener("keydown", () => { farmerLastUserActivityAt = Date.now(); }, { capture: true });

function scheduleFarmerTalk(first = false) {
  const min = first ? FARMER_FIRST_MIN_MS : FARMER_AUTO_MIN_MS;
  const max = first ? FARMER_FIRST_MAX_MS : FARMER_AUTO_MAX_MS;
  window.setTimeout(() => {
    if (farmerCanSpeakAutonomously()) farmerSpeak(autonomousFarmerLine());
    scheduleFarmerTalk(false);
  }, min + Math.random() * (max - min));
}
scheduleFarmerTalk(true);

window.addEventListener("resize", scheduleFarmerMotionRestart, { passive: true });
if (typeof ResizeObserver === "function") {
  // Both feed farmerGround(): the grass gives his footing, the stage his lane.
  const groundObserver = new ResizeObserver(scheduleFarmerMotionRestart);
  for (const el of [$(".grass-floor"), $(".mascot-stage")]) {
    if (el) groundObserver.observe(el);
  }
}
void runFarmerMotion();
window.setInterval(() => {
  if (!isNightWIB()) return;
  const dialog = $("#farmer-chat");
  if (dialog?.open) dialog.close();
  clearFarmerBubble();
}, 60_000);

// ── End living world ────────────────────────────────────────────────────

setupCareInteractions();
updateCareUi(); // initial paint — the care label must be correct before any data
setInterval(updateCareUi, 60_000); // sleep window flips without a reload (spec §6.2)

// ── PMFx presentation hooks (demo script, Task 21 / spec §3) ────────────
// window.PMFx replays existing celebrations for the presenter hotkeys in
// demo.js. PRESENTATION ONLY: nothing here touches the notePresented /
// reason ledgers, Supabase, or XP — safe to call repeatedly because the
// celebration queue paces stacked calls.

const PMFX_DEMO_XP = 20; // fake pod reward; lucky presents the same amount (net ×2 story)

// ── Chapter Gate (plan T17 — the T5 peak) ───────────────────────────────
// Full-screen dark pixel vignette: chapter number + title (client-side
// CHAPTER_TITLES map in strings.js — copied from story-definitions.ts),
// then one dialogue line, tap-through with 4s auto-advance, gold confetti
// finale + "chapter" cue. ≤8s total (the T5 tier cap); reduced motion gets
// the same static cards. Triggered by the bond_events reason prefix
// `chapter:` and by PMFx.chapter().

const CHAPTER_GATE_MS = 8000;
const CHAPTER_STEP_MS = 4000; // per-step auto-advance
const CHAPTER_TITLES_FALLBACK = {
  1: "First Meeting in Jember",
  2: "Roots in Volcanic Soil",
  3: "Trust, Rain or Shine",
  4: "Through Heat and Gray Skies",
  5: "Full Bloom, Carnival Bright",
  6: "Harvest of Wisdom",
};
const CHAPTER_GATE_FALLBACK = {
  label: (n) => `Chapter ${n}`,
  dialogue: "Our story grows, leaf by leaf. Thanks for growing with me!",
};

/** T5 chapter gate. `chapter` may be null (unparsable reason) — the gate
 *  then plays the dialogue beat only, never a wrong number. */
function fxChapterGateNow(chapter, done) {
  const layer = ensureFxLayer();
  if (!layer) {
    done();
    return;
  }
  const n = Number(chapter) > 0 ? Number(chapter) : null;
  window.PMSfx?.play("chapter");
  window.PMSfx?.buzz(30);
  const veil = document.createElement("div");
  veil.className = "fx-chapter-veil";
  veil.setAttribute("role", "status");
  veil.setAttribute("aria-live", "polite");
  const gate = document.createElement("div");
  gate.className = "fx-chapter-gate";
  veil.appendChild(gate);
  layer.appendChild(veil);
  const reduce = prefersReducedMotion();

  const label = n ? (PM().chapterGate?.label?.(n) ?? CHAPTER_GATE_FALLBACK.label(n)) : null;
  const title = n ? (PM().chapterTitles?.[n] ?? CHAPTER_TITLES_FALLBACK[n] ?? label) : null;
  const dialogue = PM().chapterGate?.dialogue ?? CHAPTER_GATE_FALLBACK.dialogue;
  const steps = [];
  if (n) steps.push({ kicker: `📖 ${label}`, title });
  steps.push({ line: dialogue });

  let index = -1;
  let stepTimer = null;
  let finished = false;
  const showStep = () => {
    index++;
    if (index >= steps.length) {
      finish();
      return;
    }
    const step = steps[index];
    gate.innerHTML = "";
    if (step.title != null) {
      const kicker = document.createElement("div");
      kicker.className = "fx-chapter-kicker";
      kicker.textContent = step.kicker;
      const titleEl = document.createElement("div");
      titleEl.className = "fx-chapter-gate-title";
      titleEl.textContent = step.title;
      gate.appendChild(kicker);
      gate.appendChild(titleEl);
    } else {
      const lineEl = document.createElement("div");
      lineEl.className = "fx-chapter-line";
      lineEl.textContent = step.line;
      gate.appendChild(lineEl);
    }
    if (!reduce) {
      animateSafe(
        gate,
        [
          { transform: "scale(0.85)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 300, easing: "steps(5, end)", fill: "both" },
      );
    }
    if (stepTimer !== null) clearTimeout(stepTimer);
    stepTimer = setTimeout(showStep, CHAPTER_STEP_MS);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    if (stepTimer !== null) clearTimeout(stepTimer);
    veil.remove();
    // Gold confetti finale (skips itself under reduced motion).
    spawnConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 36, GOLD_CONFETTI);
    done();
  };
  veil.addEventListener("pointerdown", showStep); // tap-through
  showStep();
  // Self-cleanup safety: the veil must never outlive the queue's T5 cap
  // (the queue force-advance alone would leave the veil on screen).
  setTimeout(finish, CHAPTER_GATE_MS - 200);
}

/** Enqueue the T5 chapter gate for chapter `n` (null ⇒ dialogue-only). */
function fxChapterGate(chapter) {
  fxEnqueue(5, (done) => fxChapterGateNow(chapter, done), CHAPTER_GATE_MS);
}

// ── Evolution ceremony (Pokémon-Style Transformation FX plan, Task 4) ───
// T5 companion evolution: a phase-driven sequencer (anticipate → suspense →
// payoff) — a precomputed schedule table, NOT CSS loops. Farm layer stays
// presentation-only: nothing here writes companion_state — the real stage
// classes are re-asserted by the next renderCompanion() call, same
// self-healing contract as PMFx.levelUp()'s decoration preview. Triggered
// by renderCompanion's rank-increase detection above (fxEvolve) and by the
// PMFx.evolve() demo preview below.

// Inter-burst waits shrink 14→2 frames (×16.7ms) while the alternation
// count grows 1→7 (pret/pokecrystal engine/movie/evolution_animation.asm)
// — the silhouette SHAPE swap between old/new form accelerates into the
// flash. Hard cuts only, never CSS transitions.
const EVO_WAITS = [14, 12, 10, 8, 6, 4, 2].map((f) => Math.round(f * 16.7));
const EVO_SWAP_MS = 50; // ~3 frames per alternation

// Queue fallback cap: MUST outlive the worst-case non-reduced run — Act 1
// (~1.3s) + Act 2 strobe (~2.3s) + silence beat (0.22s) + hitstop (0.05s) +
// the FULL 6s kiosk auto-dismiss wait — not just the interactive median (a
// tap usually ends it much sooner). A shorter cap would let the queue start
// the NEXT celebration while this one is still legitimately on screen
// (the same "duration ≥ item's own max time" rule podDrop's cap follows).
const EVO_SEQUENCE_QUEUE_MS = 11_500;

const EVO_FALLBACK = {
  noticing: (name) => `What? ${name} is changing…!`,
  evolved: (name, stage) => `Congratulations! ${name} grew into ${stage}!`,
  finalForm: "FINAL FORM",
};

/** Every destination rung owns a palette, particle silhouette, and flight
 * path. The spectacle can stay maximal without replaying the same show nine
 * times; labels remain ordinary growth language throughout. */
const EVO_THEMES = Object.freeze({
  Sprout:   { key: "sprout",   motion: "rise",       a: "#74ef72", b: "#fff27a", c: "#2a9d55", burst: 34 },
  Seedling: { key: "seedling", motion: "droplets",   a: "#7ee9ff", b: "#dffcff", c: "#36a9e8", burst: 36 },
  Bud:      { key: "bud",      motion: "spiral",     a: "#db8cff", b: "#fff0a4", c: "#8958d4", burst: 38 },
  Bloom:    { key: "bloom",    motion: "petals",     a: "#ff7eb6", b: "#fff1d2", c: "#ff4f73", burst: 42 },
  Fruit:    { key: "fruit",    motion: "cascade",    a: "#ffb13b", b: "#fff18c", c: "#e9543f", burst: 44 },
  Guardian: { key: "guardian", motion: "shield",     a: "#66e0c2", b: "#eafff8", c: "#237b6d", burst: 46 },
  Elder:    { key: "elder",    motion: "runes",      a: "#c69cff", b: "#f6e9ff", c: "#6551b8", burst: 48 },
  Radiant:  { key: "radiant",  motion: "solar",      a: "#fff36a", b: "#ffffff", c: "#ff922e", burst: 52 },
  Legend:   { key: "legend",   motion: "aurora",     a: "#75f7ff", b: "#fff4a8", c: "#ff69d4", burst: 56 },
});

function evolutionTheme(stage) {
  return EVO_THEMES[stage] ?? EVO_THEMES.Sprout;
}

/** Evolution-ceremony speech-bubble line. Cancels a stale petting-bubble
 *  restore so it can never stomp mid-scene. */
function speechBubble(text) {
  if (!text) return;
  cancelPetBubble();
  const bubble = $(".speech-bubble");
  if (bubble) bubble.textContent = text;
}

/** Localized {stage} name for the ceremony dialog, from strings.js's
 *  companionStage table — falls back to the raw stage key. */
function localizedStage(stage) {
  return PM().companionStage?.[stage] ?? stage;
}

let evoTintEl = null;

/** Lazily create (or reuse) the fixed radial stage-tint backdrop — a
 *  persistent singleton toggled via its `.on` class, same lazy-singleton
 *  pattern as ensureFxLayer(). */
function ensureEvoTint(theme) {
  if (!document.body) return null;
  if (!evoTintEl || !evoTintEl.isConnected) {
    evoTintEl = document.createElement("div");
    evoTintEl.className = "evo-tint";
    evoTintEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(evoTintEl);
  }
  evoTintEl.style.setProperty("--evo-a", theme.a);
  evoTintEl.style.setProperty("--evo-b", theme.b);
  evoTintEl.style.setProperty("--evo-c", theme.c);
  return evoTintEl;
}

/** Full-screen ceremony HUD. Visual labels stay aria-hidden while a single
 *  polite status node announces only the final result. */
function createEvolutionHud(oldStage, newStage, grand, theme) {
  if (!document.body) return null;
  const hud = document.createElement("div");
  hud.className = `evo-ceremony-hud evo-theme-${theme.key}${grand ? " is-grand" : ""}`;
  hud.style.setProperty("--evo-a", theme.a);
  hud.style.setProperty("--evo-b", theme.b);
  hud.style.setProperty("--evo-c", theme.c);
  const kicker = appLocale === "id" ? "LEVEL NAIK" : "LEVEL UP";
  const evolving = appLocale === "id" ? "EVOLUSI DIMULAI" : "EVOLUTION START";
  hud.innerHTML =
    `<div class="evo-theme-rays" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>` +
    `<div class="evo-theme-orbit" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>` +
    `<div class="evo-theme-emblem" aria-hidden="true"></div>` +
    `<div class="evo-ceremony-kicker" aria-hidden="true">${kicker}</div>` +
    `<div class="evo-ceremony-reel" aria-hidden="true"><span>${localizedStage(oldStage)}</span><b>◆</b><span>${localizedStage(newStage)}</span></div>` +
    `<div class="evo-ceremony-charge" aria-hidden="true">${evolving}</div>` +
    `<div class="evo-ceremony-result" aria-hidden="true"></div>` +
    `<div class="sr-only evo-ceremony-status" role="status" aria-live="polite"></div>`;
  document.body.appendChild(hud);
  return hud;
}

/** Energy pixels converge on Jamkachu during the riser. They share the
 *  global particle budget and animate only transform/opacity. */
function spawnEvoChargeOrbs(n, theme) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const rect = mascotRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.42;
  const total = Math.max(0, Math.min(n, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < total; i++) {
    const orb = document.createElement("i");
    orb.className = "fx-evo-charge";
    orb.setAttribute("aria-hidden", "true");
    const angle = Math.PI * 2 * i / Math.max(1, total) + Math.random() * 0.35;
    const distance = Math.max(window.innerWidth, window.innerHeight) * (0.42 + Math.random() * 0.18);
    const sx = cx + Math.cos(angle) * distance;
    const sy = cy + Math.sin(angle) * distance;
    orb.style.left = `${sx}px`;
    orb.style.top = `${sy}px`;
    orb.style.setProperty("--evo-a", theme.a);
    orb.style.setProperty("--evo-b", theme.b);
    layer.appendChild(orb);
    liveParticles++;
    const delay = i * 38;
    const duration = 720 + Math.random() * 420;
    animateSafe(
      orb,
      [
        { transform: "translate(0,0) scale(.45)", opacity: 0 },
        { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0.2 },
        { transform: `translate(${cx - sx}px,${cy - sy}px) scale(.2)`, opacity: 1 },
      ],
      { duration, delay, easing: "steps(12,end)", fill: "forwards" },
    );
    removeLater(orb, delay + duration + 80, true);
  }
}

function spawnEvoShockwaves(grand, theme) {
  if (prefersReducedMotion() || !document.body) return;
  const count = grand ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const ring = document.createElement("div");
    ring.className = `evo-shockwave evo-theme-${theme.key}`;
    ring.style.setProperty("--evo-a", theme.a);
    ring.style.setProperty("--evo-b", theme.b);
    ring.style.animationDelay = `${i * 110}ms`;
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    removeLater(ring, 1050 + i * 110);
  }
}

/** Nine distinct payoff choreographies. Each path is intentionally legible:
 * leaves rise, dew arcs down, buds spiral, petals flutter, fruit cascades,
 * shields lock outward, runes zig-zag, sunlight fires radially, and the final
 * aurora sweeps upward. No gameplay state is written. */
function evoBurstPath(motion, angle, distance) {
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  const tangentX = -Math.sin(angle) * distance;
  const tangentY = Math.cos(angle) * distance;
  const path = {
    rise: [
      { transform: "translate(0,20px) rotate(0deg) scale(.25)", opacity: 0 },
      { transform: `translate(${x * .2}px,${-distance * .55}px) rotate(100deg) scale(1)`, opacity: 1 },
      { transform: `translate(${x * .55}px,${-distance * 1.18}px) rotate(220deg) scale(.65)`, opacity: 0 },
    ],
    droplets: [
      { transform: "translate(0,-10px) scale(.35)", opacity: 0 },
      { transform: `translate(${x * .48}px,${-distance * .62}px) scale(1.15)`, opacity: 1 },
      { transform: `translate(${x}px,${Math.abs(y) * .72 + 70}px) scale(.55)`, opacity: 0 },
    ],
    spiral: [
      { transform: "translate(0,0) rotate(0deg) scale(.2)", opacity: 0 },
      { transform: `translate(${tangentX * .38}px,${tangentY * .38}px) rotate(190deg) scale(1)`, opacity: 1 },
      { transform: `translate(${x}px,${y}px) rotate(520deg) scale(.55)`, opacity: 0 },
    ],
    petals: [
      { transform: "translate(0,-8px) rotate(-25deg) scale(.2)", opacity: 0 },
      { transform: `translate(${x * .5 + tangentX * .18}px,${y * .42 - 28}px) rotate(55deg) scale(1.15)`, opacity: 1 },
      { transform: `translate(${x + tangentX * .25}px,${y + 65}px) rotate(175deg) scale(.7)`, opacity: 0 },
    ],
    cascade: [
      { transform: "translate(0,-80px) rotate(0deg) scale(.3)", opacity: 0 },
      { transform: `translate(${x * .55}px,${-distance * .48}px) rotate(140deg) scale(1.2)`, opacity: 1 },
      { transform: `translate(${x}px,${Math.abs(y) + 105}px) rotate(310deg) scale(.8)`, opacity: 0 },
    ],
    shield: [
      { transform: "translate(0,0) scale(.1)", opacity: 0 },
      { transform: `translate(${x * .52}px,${y * .52}px) scale(1.4)`, opacity: 1 },
      { transform: `translate(${x * .82}px,${y * .82}px) scale(.9)`, opacity: 0 },
    ],
    runes: [
      { transform: "translate(0,0) rotate(0deg) scale(.25)", opacity: 0 },
      { transform: `translate(${x * .32 + tangentX * .28}px,${y * .32 + tangentY * .28}px) rotate(90deg) scale(1)`, opacity: 1 },
      { transform: `translate(${x - tangentX * .22}px,${y - tangentY * .22}px) rotate(180deg) scale(.7)`, opacity: 0 },
    ],
    solar: [
      { transform: "translate(0,0) scale(.1)", opacity: 0 },
      { transform: `translate(${x * .38}px,${y * .38}px) scale(1.5)`, opacity: 1 },
      { transform: `translate(${x * 1.45}px,${y * 1.45}px) scale(.35)`, opacity: 0 },
    ],
    aurora: [
      { transform: `translate(${tangentX * .18}px,60px) rotate(-20deg) scale(.2)`, opacity: 0 },
      { transform: `translate(${x * .35 - tangentX * .34}px,${-distance * .48}px) rotate(30deg) scale(1.35)`, opacity: 1 },
      { transform: `translate(${x * .72 + tangentX * .28}px,${-distance * 1.15}px) rotate(110deg) scale(.6)`, opacity: 0 },
    ],
  };
  return path[motion] ?? path.rise;
}

function spawnEvoThemeBurst(theme) {
  if (prefersReducedMotion() || window.matchMedia?.("(max-width: 800px)").matches) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const rect = mascotRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * .38;
  const total = Math.max(0, Math.min(theme.burst, MAX_PARTICLES - liveParticles));
  for (let i = 0; i < total; i++) {
    const particle = document.createElement("i");
    particle.className = `fx-evo-theme fx-evo-${theme.key}`;
    particle.setAttribute("aria-hidden", "true");
    particle.style.left = `${cx}px`;
    particle.style.top = `${cy}px`;
    particle.style.setProperty("--evo-a", theme.a);
    particle.style.setProperty("--evo-b", theme.b);
    particle.style.setProperty("--evo-c", theme.c);
    layer.appendChild(particle);
    liveParticles++;
    const angle = Math.PI * 2 * i / Math.max(1, total) + (i % 3) * .08;
    const distance = 105 + (i % 7) * 20 + Math.random() * 35;
    const delay = (i % 6) * 22;
    const duration = 850 + (i % 5) * 105;
    animateSafe(particle, evoBurstPath(theme.motion, angle, distance), {
      duration, delay, easing: "cubic-bezier(.16,.74,.28,1)", fill: "forwards",
    });
    removeLater(particle, delay + duration + 100, true);
  }
}

/** Single full-screen white pulse — fires at MOST once per ceremony
 *  (WCAG 2.3.1). Opacity-only WAAPI tween; self-removes via removeLater,
 *  this file's one source of FX-element cleanup. */
function flashOnce(ms) {
  if (!document.body) return;
  const flash = document.createElement("div");
  flash.className = "evo-flash";
  flash.setAttribute("aria-hidden", "true");
  document.body.appendChild(flash);
  animateSafe(
    flash,
    [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }],
    { duration: ms, easing: "linear", fill: "forwards" },
  );
  removeLater(flash, ms + 50);
}

/** Resolves on the first tap anywhere, or after `ms` — whichever comes
 *  first (kiosk safety: the ceremony must never wait on a player who never
 *  taps). Used for the payoff's tap-to-continue reveal. */
function dismissOrTimeout(ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(finish, ms);
    function finish() {
      if (settled) return;
      settled = true;
      document.removeEventListener("pointerdown", onTap, { capture: true });
      clearTimeout(timer);
      resolve();
    }
    function onTap() {
      finish();
    }
    document.addEventListener("pointerdown", onTap, { capture: true });
  });
}

/** Star-burst payoff particles: `n` small pixel stars fly out from the
 *  mascot, two spawned per ~33ms tick, WAAPI outward drift + fade
 *  (0.5-1.5s), a per-particle hue-rotate for the palette-cycling shimmer.
 *  Shares this file's global MAX_PARTICLES budget with every other FX. */
function spawnEvoStars(n, theme) {
  if (prefersReducedMotion()) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  const rect = mascotRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.35;
  const total = Math.max(0, Math.min(n, MAX_PARTICLES - liveParticles));
  let spawned = 0;
  const tick = () => {
    for (let k = 0; k < 2 && spawned < total; k++, spawned++) {
      const i = spawned;
      const star = document.createElement("div");
      star.className = `fx-star evo-star-${theme.key}`;
      star.setAttribute("aria-hidden", "true");
      const size = 8 + Math.floor(Math.random() * 6);
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.left = `${cx}px`;
      star.style.top = `${cy}px`;
      star.style.setProperty("--evo-a", theme.a);
      star.style.setProperty("--evo-b", theme.b);
      star.style.filter = `hue-rotate(${(i * 17) % 80 - 40}deg)`;
      layer.appendChild(star);
      liveParticles++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 130;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const duration = 500 + Math.random() * 1000;
      animateSafe(
        star,
        [
          { transform: "translate(0px, 0px) scale(0.5)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx * 1.4}px, ${dy * 1.4}px) scale(0.5)`, opacity: 0 },
        ],
        { duration, easing: "steps(8, end)", fill: "forwards" },
      );
      removeLater(star, duration + 100, true);
    }
    if (spawned < total) setTimeout(tick, 33);
  };
  tick();
}

// Current ceremony's tap-to-fast-forward trigger; null while no ceremony is
// running. Exposed via window.__pmEvoFF() for callers outside this closure.
let evoFastForward = null;
window.__pmEvoFF = () => evoFastForward?.();

/** T5 evolution ceremony: dialog beat → accelerating silhouette strobe
 *  between `oldStage`/`newStage` → one full-screen flash + hitstop + shake
 *  + reveal (cry + fanfare + star burst) → tap-or-6s dismiss. No cancel
 *  mechanic: unlike Pokémon's B-button, the evolution already happened
 *  server-side, so a tap only fast-forwards to the payoff, never reverts.
 *  Reduced motion: a single 900ms crossfade, no strobe/flash/shake.
 *  Presentation only — real stage classes re-assert on the next
 *  renderCompanion(), same self-healing contract as PMFx.levelUp(). */
async function runEvolutionSequence(oldStage, newStage) {
  const svg = $(".mascot-svg");
  const wrap = $(".mascot-wrapper");
  if (!svg || !wrap) return;
  const reduce = prefersReducedMotion();
  const grand = newStage === STAGE_ORDER.at(-1);
  const theme = evolutionTheme(newStage);
  let ff = false; // fast-forward flag: a tap jumps the remaining strobe steps
  const ffTap = () => { ff = true; };
  evoFastForward = ffTap;
  document.addEventListener("pointerdown", ffTap, { capture: true });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 4000)));
  // Same-phase evolutions (stage→phase table in jamkachu-sprite.js buckets
  // e.g. Sprout+Seedling onto one drawn frame) render byte-identical sprites
  // for oldStage and newStage — under the .evo-sil white-silhouette filter
  // the strobe would freeze into a static shape. .evo-sil-alt marks the
  // new-stage beats so style.css can stretch the silhouette upward, keeping
  // two visibly distinct shapes alternating on every transition pair.
  const strobeSamePhase =
    typeof window.PMSprite?.stagePhase === "function" &&
    window.PMSprite?.stagePhase(oldStage) === window.PMSprite?.stagePhase(newStage);
  const setStage = (stage) => {
    for (const cls of [...svg.classList]) if (cls.startsWith("companion-")) svg.classList.remove(cls);
    svg.classList.add(`companion-${stage}`);
    svg.classList.toggle("evo-sil-alt", strobeSamePhase && stage === newStage && svg.classList.contains("evo-sil"));
    // Designer sprite: each strobe step swaps the drawn phase frame too
    // (stage→phase table in jamkachu-sprite.js), so the silhouette
    // alternation stays visible on the img.
    window.PMSprite?.set({ stage });
  };
  const tint = ensureEvoTint(theme);
  const hud = createEvolutionHud(oldStage, newStage, grand, theme);
  let riser = null;
  try {
    document.body?.classList.add("evolution-active");
    wrap.classList.add("evo-arena");
    svg.style.willChange = "filter, transform";
    // Anticipation must show the PRE-evolution form — renderCompanion already
    // applied the new stage class before enqueuing, which would spoil the
    // reveal (and turn the reduced-motion crossfade into a dim-and-undim).
    setStage(oldStage);
    // ── ACT 1: anticipate (~1.3-1.8s) — dialog + tint + pulse
    speechBubble(PM().evo?.noticing?.(currentPlantName()) ?? EVO_FALLBACK.noticing(currentPlantName()));
    tint?.classList.add("on");
    hud?.classList.add("is-charging");
    if (reduce) {
      // Safe path: crossfade only — no strobe, no flash, no shake.
      await sleep(900);
      svg.classList.add("evo-xfade");
      await sleep(450);
      setStage(newStage);
      await sleep(450);
      svg.classList.remove("evo-xfade");
    } else {
      wrap.classList.add("evo-pulse");
      riser = window.PMSfx?.evoRiser(6) ?? null;
      spawnEvoChargeOrbs(grand ? 32 : 22, theme);
      await sleep(1300);
      // ── ACT 2: suspense — accelerating silhouette strobe (mascot-local)
      svg.classList.add("evo-sil");
      for (let i = 0; i < EVO_WAITS.length && !ff; i++) {
        await sleep(EVO_WAITS[i]);
        for (let k = 0; k <= i && !ff; k++) {
          setStage(k % 2 === 0 ? newStage : oldStage);
          await sleep(EVO_SWAP_MS);
        }
      }
      riser?.stop();
      riser = null;
      setStage(newStage);
      wrap.classList.remove("evo-pulse");
      // Silence beat: eye and ear stop together right before the sting.
      hud?.classList.add("is-hold");
      await sleep(ff ? 0 : 250);
      // ── ACT 3: payoff — ONE flash + hitstop + shake + reveal
      flashOnce(80); // single 80ms full-screen pulse (WCAG 2.3.1)
      setBreathPaused(true); // hitstop: freeze idle breathing
      await sleep(80);
      setBreathPaused(false);
      svg.classList.remove("evo-sil", "evo-sil-alt");
      wrap.classList.add("evo-shake-lg");
      svg.classList.add("evo-reveal-bounce");
      window.PMSfx?.cry();
      window.PMSfx?.evoFanfare();
      window.PMSfx?.evoImpact?.({ grand });
      window.PMSfx?.buzz(grand ? [45, 30, 90] : [35, 25, 65]);
      spawnEvoShockwaves(grand, theme);
      spawnEvoThemeBurst(theme);
      spawnEvoStars(grand ? 52 : 36, theme);
    }
    // Announcement precedence: full evo line → strings.js companionEvolved
    // (still localized, stage-only) → hard-coded English EVO_FALLBACK.
    const evoStageName = localizedStage(newStage);
    const evolvedLine =
      PM().evo?.evolved?.(currentPlantName(), evoStageName) ??
      PM().companionEvolved?.(evoStageName) ??
      EVO_FALLBACK.evolved(currentPlantName(), evoStageName);
    const tapHint = PM().evo?.tapToContinue;
    speechBubble(tapHint ? `${evolvedLine} · ${tapHint}` : evolvedLine);
    if (hud) {
      const result = hud.querySelector(".evo-ceremony-result");
      const status = hud.querySelector(".evo-ceremony-status");
      const stageLabel = localizedStage(newStage);
      // `grand` is reaching the LAST stage (STAGE_ORDER.at(-1)) — the end of
      // a growth arc a student spent days on. The staging carries the weight;
      // the label simply names the earned final form.
      const finalFormLabel = PM().evo?.finalForm ?? EVO_FALLBACK.finalForm;
      if (result) result.textContent = grand ? `${finalFormLabel} · ${stageLabel}` : stageLabel;
      if (status) status.textContent = evolvedLine;
      hud.classList.remove("is-charging", "is-hold");
      hud.classList.add("is-revealed");
    }
    await dismissOrTimeout(6000); // tap-to-continue, kiosk-safe
  } finally {
    document.removeEventListener("pointerdown", ffTap, { capture: true });
    evoFastForward = null;
    riser?.stop();
    setBreathPaused(false); // ceremony must never leave breathing frozen
    svg.style.willChange = "auto";
    tint?.classList.remove("on");
    hud?.remove();
    document.body?.classList.remove("evolution-active");
    wrap.classList.remove("evo-arena", "evo-pulse", "evo-shake-lg");
    svg.classList.remove("evo-sil", "evo-sil-alt", "evo-reveal-bounce", "evo-xfade");
    // real companion_state re-asserts stage classes on the next data render
  }
}

/** Full evolution sequence, called from the celebration queue's runFn. */
function fxEvolveNow(oldStage, newStage) {
  return runEvolutionSequence(oldStage, newStage);
}

/** Enqueue the T5 evolution ceremony (renderCompanion's rank-increase
 *  trigger, and PMFx.evolve() below). */
function fxEvolve(oldStage, newStage) {
  fxEnqueue(5, (done) => { fxEvolveNow(oldStage, newStage).then(done, done); }, EVO_SEQUENCE_QUEUE_MS);
}

// ── End evolution ceremony ───────────────────────────────────────────────

window.PMFx = {
  /** Gold "BONUS ×2" stamp + gold orb burst — mirrors the server-lucky
   *  reveal WITHOUT noteReason/notePresented (pure display). */
  lucky() {
    fxEnqueue(3, (done) => fxLuckyStampNow(done), LUCKY_STAMP_MS + 100);
    fxEnqueue(2, () => orbCascade(PMFX_DEMO_XP, { gold: true }), ORB_CASCADE_TOTAL_MS + 200);
  },
  /** T4 level-up overlay for the next level, extended with the decoration
   *  reveal for the next unlockable decoration (demo beat 3: level-up →
   *  new decoration). Presentation only — the previewed decoration classes
   *  are re-asserted from real bond_level on the next data render. */
  levelUp() {
    const next = (prevLevel ?? 1) + 1;
    fxLevelUp(next);
    const decorLevel = DECOR_LEVELS.find((lvl) => lvl >= next);
    if (decorLevel) {
      applyDecorations(decorLevel);
      fxDecorReveal(decorLevel);
    }
  },
  /** T5 chapter gate for the next chapter (display only). */
  chapter() {
    fxChapterGate(Math.min((prevChapter ?? 1) + 1, 6));
  },
  /** Reward-pod drop with a fake quest — bypasses celebrateQuest's
   *  presented-XP ledger on purpose (nothing real is being presented). */
  pod() {
    fxEnqueue(3, (done) => podDrop({ quest_key: "KEEP_ME_HAPPY", xp_reward: PMFX_DEMO_XP }, done), POD_AUTO_BURST_MS + 700);
  },
  /** T5 evolution ceremony preview, walking the ladder: the first press
   *  starts from the real rendered stage, and every following press
   *  continues from the last previewed stage (evoDemoStage advances at
   *  enqueue time, so two quick presses queue two CONSECUTIVE ceremonies)
   *  — repeated E presses demonstrate all ten stages. At the top (Legend)
   *  the DEMO PAIR wraps to Seed→Sprout (not Legend→Seed, which would read
   *  as de-evolution) so presenters can always show the full ceremony.
   *  Presentation only — real stage classes re-assert (and the cursor
   *  resets) on the next renderCompanion(), same contract as
   *  PMFx.levelUp(); this bypasses the pm_evo_seen guard on purpose
   *  (nothing real is being presented). */
  evolve() {
    const base = STAGE_ORDER.includes(evoDemoStage) ? evoDemoStage : currentCompanionStage;
    const idx = STAGE_ORDER.indexOf(base);
    const hasNext = idx >= 0 && idx < STAGE_ORDER.length - 1;
    const oldStage = hasNext ? base : STAGE_ORDER[0];
    const newStage = hasNext ? STAGE_ORDER[idx + 1] : STAGE_ORDER[1];
    evoDemoStage = newStage;
    fxEvolve(oldStage, newStage);
  },
};

// ── End care button + sleep + petting + micro-juice + PMFx ──────────────

// ── Level decorations (spec §6.4) ───────────────────────────────────────
// Levels leave visible traces: Lv.2 pot heart sticker, Lv.3 flag beside the
// pot, Lv.5 warmer room glow, Lv.7 head ribbon, Lv.10 golden pot + best-
// friend token. PURE presentation derived from bond_level: renderBond
// applies them idempotently on EVERY render (first included — decorations
// are state, not celebration). Only the LEVEL-UP diff adds a short T3
// reveal after the level-up overlay.

// Lv.7 ("head ribbon") retired with the designer sprites: the drawn art
// already awards a head bow at bond 4 and a prize ribbon at bond 8
// (jamkachu-sprite.js tiers), so announcing a third ribbon promised a
// reward the character could not show.
const DECOR_LEVELS = [2, 3, 5, 10];
const DECOR_KEY_BY_LEVEL = { 2: "sticker", 3: "flag", 5: "room", 10: "goldpot" };
const DECOR_ANCHOR = {
  sticker: ".decor-sticker",
  flag: ".decor-flag",
  goldpot: ".decor-token",
  // "room" has no single element — sparkles fall back to the mascot stage.
};
const DECOR_FALLBACK = {
  reveal: (name) => `New decoration: ${name}!`,
  sticker: "Pot heart sticker",
  flag: "Pot flag",
  room: "Warmer room glow",
  goldpot: "Golden pot",
  bffToken: "Best Friend 💛",
};
const DECOR_REVEAL_MS = 1600;

/** Apply every decoration the given bond level has earned (and remove any
 *  it has not — idempotent, so demo previews self-correct on the next real
 *  render). */
function applyDecorations(level) {
  const lv = Number(level) || 1;
  const svg = $(".mascot-svg");
  if (svg) {
    svg.classList.toggle("decor-lv2", lv >= 2);
    svg.classList.toggle("decor-lv3", lv >= 3);
    svg.classList.toggle("decor-lv10", lv >= 10);
  }
  document.body?.classList.toggle("room-warm", lv >= 5);
  // Designer sprite: bond level also picks the automatic accessory tier
  // (bare → head bow ≥4 → prize ribbon ≥8, clamped by growth phase) — the
  // bond→tier table lives in jamkachu-sprite.js.
  window.PMSprite?.set({ bondLevel: lv });
  const token = $("#bff-token");
  if (token) {
    token.hidden = lv < 10;
    if (lv >= 10) token.textContent = PM().decor?.bffToken ?? DECOR_FALLBACK.bffToken;
  }
}

/** Immediate decoration reveal (queue item body): chip naming the new
 *  decoration + sparkles at the decoration itself + "coin" cue. */
function fxDecorRevealNow(level) {
  const key = DECOR_KEY_BY_LEVEL[level];
  if (!key) return;
  window.PMSfx?.play("coin");
  const name = PM().decor?.[key] ?? DECOR_FALLBACK[key];
  const text = PM().decor?.reveal?.(name) ?? DECOR_FALLBACK.reveal(name);
  const anchor = DECOR_ANCHOR[key] ? $(DECOR_ANCHOR[key]) : null;
  const anchorRect = anchor?.getBoundingClientRect?.();
  const rect = anchorRect && anchorRect.width > 0 ? anchorRect : mascotRect();
  spawnSparkles(rect, 8);
  floatChip(text, rect);
}

/** T3 follow-up reveal — enqueued AFTER fxLevelUp (T4), so the queue plays
 *  overlay first, then this short chip+sparkle beat. */
function fxDecorReveal(level) {
  fxEnqueue(3, (done) => {
    fxDecorRevealNow(level);
    setTimeout(done, DECOR_REVEAL_MS);
  }, DECOR_REVEAL_MS);
}

// ── Seed Shop purchases (milestone18) ────────────────────────────────────
// PURE presentation from shop_purchases rows: the ONE equipped pot and ONE
// equipped accessory become .shop-<item_key> classes on .mascot-svg, and
// every owned decor item becomes .own-<item_key> on .shop-decor-layer.
// Applied idempotently on every render, exactly like applyDecorations.

const SHOP_POT_KEYS = ["pot_terracotta", "pot_batik", "pot_tincan", "pot_coffee_sack", "pot_bamboo", "pot_jember_mosaic"];
// Same drift the decor list below suffered: the catalog sold the last three
// and the farm had never heard of them, so wearing one cost Seeds and changed
// nothing. tests/shop-farm-wearables.test.ts pins this list against the catalog.
const SHOP_ACC_KEYS = ["acc_strawhat", "acc_ribbon", "acc_glasses", "acc_coffee_crown", "acc_bandana", "acc_goggles", "acc_jfc_headdress", "acc_taeguk_ribbon", "acc_indonesia_sash"];
// Every decor key in SHOP_CATALOG, in catalog order. The last three were
// missing, so buying the JFC banner, the flag or the Mugunghwa patch put a row
// in the table and changed nothing on the farm — the item simply never existed
// out here. tests/shop-farm-decor.test.ts pins this list against the catalog.
const SHOP_DECOR_KEYS = ["decor_scarecrow", "decor_fence", "decor_lantern", "decor_pond", "decor_coffee_sign", "decor_greenhouse", "decor_rain_barrel", "decor_compost", "decor_tobacco_barn", "decor_puger_pinwheel", "decor_jfc_banner", "decor_indonesia_flag", "decor_mugunghwa"];

function renderShopPurchases(rows) {
  const svg = $(".mascot-svg");
  const layer = $(".shop-decor-layer");
  const list = Array.isArray(rows) ? rows : [];
  const equippedPot = list.find((r) => r.category === "pot" && r.equipped)?.item_key ?? null;
  const equippedAcc = list.find((r) => r.category === "accessory" && r.equipped)?.item_key ?? null;
  // Decor hangs on the equipped flag, not on merely owning it. Keying it off
  // ownership made every bought decoration permanent — there was no way to take
  // one back off the farm. purchase_item equips decor on purchase, so buying
  // still puts it out immediately; equip_item can now take it off again.
  const ownedDecor = new Set(list.filter((r) => r.category === "decor" && r.equipped).map((r) => r.item_key));
  if (svg) {
    SHOP_POT_KEYS.forEach((key) => svg.classList.toggle(`shop-${key}`, key === equippedPot));
    SHOP_ACC_KEYS.forEach((key) => svg.classList.toggle(`shop-${key}`, key === equippedAcc));
  }
  // Designer sprite: the equipped pot replaces the baked-in pot with the
  // matching catalog artwork. Accessories stay overlay-SVG groups driven by
  // the classes above.
  window.PMSprite?.set({ potItemKey: equippedPot });
  if (layer) {
    SHOP_DECOR_KEYS.forEach((key) => layer.classList.toggle(`own-${key}`, ownedDecor.has(key)));
  }
}

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

/** The dominant home decision surface. It explains the same real quest
 *  state in four child-readable phases without creating a second source of
 *  truth: sensor availability and renderQuestSlot choose the state; this
 *  function only paints localized guidance. */
function renderCareFocus(state) {
  const focus = $("#care-focus");
  if (!focus) return;
  const next = ["waiting", "healthy", "action", "verifying"].includes(state) ? state : "waiting";
  const presentation = {
    waiting: { icon: "📡", steps: ["current", "todo", "todo"] },
    healthy: { icon: "💚", steps: ["done", "not-needed", "done"] },
    action: { icon: "👐", steps: ["done", "current", "todo"] },
    verifying: { icon: "🔍", steps: ["done", "done", "current"] },
  }[next];
  careFocusState = next;
  focus.dataset.careState = next;
  setText("#care-focus-icon", presentation.icon);
  setText("#care-focus-title", t(`focus.${next}.title`));
  setText("#care-focus-summary", t(`focus.${next}.summary`));
  ["sense", "act", "verify"].forEach((step, index) => {
    const item = focus.querySelector(`[data-care-step="${step}"]`);
    if (!item) return;
    item.dataset.stepState = presentation.steps[index];
    if (presentation.steps[index] === "current") item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  applyCareButton();
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
  // Text diet: the old CARE VERIFICATION CORE console is gone — the amber
  // shimmer (.verifying) + "Sensor is checking…" line below already tell
  // the whole story without engineering vocabulary.
  slotEl?.classList.toggle("verifying", quest?.status === "VERIFYING");
  if (quest?.status === "VERIFYING") renderCareFocus("verifying");
  else if (quest?.status === "ACTIVE") renderCareFocus("action");
  else if (lastReading != null && careMood !== "Happy") renderCareFocus("action");
  else if (lastReading != null) renderCareFocus("healthy");
  else renderCareFocus("waiting");
  if (!quest) {
    nameEl.textContent = t("quest.none");
    progressEl.textContent = "";
    return;
  }
  const meta = QUEST_META[quest.quest_key];
  // Drawn icon where the designer has one, the emoji it replaced otherwise.
  // The title stays textContent — it is data — and the icon is a real element,
  // so nothing here builds markup out of a quest key.
  nameEl.textContent = "";
  if (meta?.art) {
    const icon = document.createElement("img");
    icon.className = "pm-inline-art";
    icon.src = meta.art;
    icon.alt = "";
    nameEl.append(icon, ` ${questTitle(quest.quest_key)}`);
  } else {
    nameEl.textContent = meta ? `${meta.emoji} ${questTitle(quest.quest_key)}` : prettifyKey(quest.quest_key);
  }
  if (quest.status === "VERIFYING") {
    // Static structure via innerHTML, dynamic copy via textContent (safe).
    progressEl.innerHTML =
      '🔍 <span class="cq-verifying-text"></span><span class="cq-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
    const textEl = progressEl.querySelector(".cq-verifying-text");
    if (textEl) textEl.textContent = PM().verifying?.checking ?? "Sensor is checking…";
  } else if (meta?.targetMin && quest.started_at) {
    const elapsedMin = Math.max(0, Math.floor((Date.now() - Date.parse(quest.started_at)) / 60_000));
    progressEl.textContent = `${Math.min(elapsedMin, meta.targetMin)}/${meta.targetMin} ${t("quest.min")}`;
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
  const svg = $(".mascot-svg");
  if (svg) {
    for (const cls of [...svg.classList]) if (cls.startsWith("crop-")) svg.classList.remove(cls);
    const cropKey = typeof plant.crop_profile_key === "string" && plant.crop_profile_key.trim() ? plant.crop_profile_key : "strawberry";
    svg.classList.add(`crop-${cropKey}`);
  }
  const mood = MOODS[plant.current_state] ?? MOODS.Happy;
  // DEV ADDITION (speech bubble — personality/AI voice): paint the local
  // template instantly, then ask /api/mood-message for the personalized line
  // (AI-flavored when a key is set, deterministic template otherwise). Both
  // run only when the mood actually CHANGED, so the 15 s poll never
  // re-fetches or stomps a displayed message. Fetch failure ⇒ template stays.
  if (plant.current_state !== lastMoodFetched) {
    const state = plant.current_state;
    lastMoodFetched = state;
    setMascotMood(state); // also re-derives the care button + sleep (spec §6)
    const bubble = $(".speech-bubble");
    // While the sleep presentation is active the sleep line owns the bubble
    // (setMascotMood → updateCareUi just painted it) — never stomp it.
    if (bubble && !sleepShown) bubble.innerHTML = moodBubble(mood);
    cancelPetBubble(); // a real mood message must never be stomped by a stale pet-line restore
    const dialogueTime = (wibNow()?.hour ?? 12) < 12 ? "morning" : "later";
    fetch(`/api/mood-message?plantId=${encodeURIComponent(PLANT_ID)}&stage=${encodeURIComponent(currentCompanionStage)}&time=${dialogueTime}&locale=${encodeURIComponent(appLocale)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data.message !== "string") return;
        if (lastMoodFetched !== state) return; // mood moved on mid-flight
        if (sleepShown) return; // Jamkachu is asleep — keep the sleep bubble
        // Transient-bubble guard (same chain as petting/vitals/memories):
        // renderPlant cancelled any stale restore when this fetch started,
        // so a pending restore here means a NEW transient line took the
        // bubble mid-flight — writing over it would flash, then the restore
        // timer would stomp us right back. Drop the fetched line; the
        // template painted at fetch start remains the saved content.
        if (petRestoreTimer !== null || petSavedBubble !== null) return;
        const el = $(".speech-bubble");
        const fresh = chooseFreshDialogue(data.candidates ?? [data.message]);
        if (el && fresh) el.textContent = fresh;
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
  // (#char-name under the mascot is the single name owner now — the STATUS
  // JAMKACHU panel's old duplicate name line was removed; renderBond keeps
  // its bond-level label fresh instead.)
}

function renderBond(bond, plantName) {
  if (!bond) return;
  if (plantName) lastPlantName = plantName; // evolution ceremony's dialog name (see currentPlantName())
  // #char-name is the single name owner — keep it synced to the DB name so a
  // Settings rename actually shows on the home screen (the old .username
  // writer was removed; without this no code ever wrote the name at all).
  if (plantName) {
    const nameEl = $("#char-name");
    if (nameEl && nameEl.textContent !== plantName) nameEl.textContent = plantName;
  }
  const totalXp = Number(bond.total_xp) || 0;
  const level = Number(bond.bond_level) || 1;
  const streakDays = Number(bond.current_streak) || 0;
  // Wardrobe lock states (milestone20) read the latest REAL bond level —
  // display-only, the server re-checks every skin pick against bond_state.
  const bondLevelChanged = level !== lastBondLevel;
  lastBondLevel = level;
  if (bondLevelChanged) refreshWardrobeIfOpen();
  // DEV ADDITION (reward FX): diff against the previous render. All prev*
  // start null, so the FIRST render only records state — no celebration for
  // merely loading the page. Deltas <= 0 (poll repeats, demo resets) never
  // celebrate either.
  const firstRender = prevXp === null;
  const xpDelta = firstRender ? 0 : totalXp - prevXp;
  const leveledUp = !firstRender && level > prevLevel;
  const streakDelta = firstRender ? 0 : streakDays - prevStreak;

  // Bond-level label right above the XP bar ("Ikatan Lv.3"): the panel's
  // single remaining identity line — the plant NAME lives only in
  // #char-name under the mascot now (no more cat-vs-plant confusion).
  const levelEl = $(".username");
  const atMax = Number(bond.bond_level) >= MAX_BOND_LEVEL;
  if (levelEl) levelEl.textContent = atMax
    ? `${t("bond")} Lv.${MAX_BOND_LEVEL} · MAX`
    : `${t("bond")} Lv.${bond.bond_level}`;
  // At the cap the bar is full and stays full — a bar that kept sliding back
  // to 7% would promise a level that can no longer arrive.
  setXpBar(atMax ? 100 : (totalXp % XP_PER_LEVEL) / XP_PER_LEVEL * 100, leveledUp);
  const xpWrap = $(".xp-bar-wrap");
  if (xpWrap) xpWrap.classList.toggle("is-max", atMax);
  // renderOfflineHome may have hidden the badges before the backend came
  // back — real data always un-hides (`.badge[hidden]` really hides now).
  const coinBadge = $(".badge.coin");
  if (coinBadge) coinBadge.hidden = false;
  const numEl = ensureCoinNumber();
  if (numEl) {
    if (xpDelta > 0 && !prefersReducedMotion()) {
      // Authoritative count-up takes the counter back from any in-flight
      // orb cascade: bump the generation so late landings bail, and clear
      // their timers so none can rewind the number after we settle.
      xpRenderGeneration++;
      cancelXpLandings();
      const shown = Number.parseInt(numEl.textContent, 10);
      animateXpCount(numEl, Number.isFinite(shown) ? shown : prevXp, totalXp);
    } else if (firstRender || xpDelta !== 0 || xpLandingTimers.length === 0) {
      xpRenderGeneration++;
      cancelXpLandings();
      cancelXpCount();
      numEl.textContent = String(totalXp);
    }
    // Remaining case — a poll repeat (delta 0) while a cascade's landings
    // are mid-flight: the cascade already settles at this exact total, so
    // it keeps the counter (no mid-animation stomp).
  }
  const streak = $(".badge.streak");
  if (streak) {
    // Flame tier grows at 7/14/30 days (Task 15) — text-level, no sprites.
    streak.innerHTML = `<i class="icon">${flameFor(streakDays)}</i> ${streakDays} ${t("days")}`;
    streak.style.display = streakDays > 0 ? "" : "none";
    if (streakDays > 0) streak.hidden = false; // clear renderOfflineHome's hide
  }
  // Ember ignition (sfx wiring): a real streak GAIN that crosses a flame
  // tier (7/14/30) crackles once. Diff-gated like every celebration — the
  // first render and poll repeats stay silent.
  if (!firstRender && streakDelta > 0 && flameFor(streakDays) !== flameFor(prevStreak)) {
    window.PMSfx?.play("emberCrackle");
  }

  // Seed coin balance (milestone18): shown verbatim from bond_state.seeds —
  // the farm layer never computes balances. The chip stays hidden until the
  // migration adds the column (bond.seeds === undefined pre-migration).
  const seedsBadge = $(".badge.seeds");
  if (seedsBadge) {
    if (typeof bond.seeds === "number") {
      seedsBadge.hidden = false;
      const numEl2 = seedsBadge.querySelector("[data-seed-num]");
      const labelEl = seedsBadge.querySelector("[data-seed-label]");
      if (numEl2) numEl2.textContent = String(bond.seeds);
      if (labelEl) labelEl.textContent = PM().seedShop?.label ?? "Seeds";
    } else {
      seedsBadge.hidden = true;
    }
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
  if (leveledUp) {
    fxLevelUp(level);
    // Level decorations (spec §6.4): when the new level unlocks one, extend
    // the level-up celebration with a short T3 reveal (highest new unlock
    // on a multi-level jump — the decorations themselves are all applied).
    const newDecorLevel = DECOR_LEVELS.filter((lvl) => lvl > prevLevel && lvl <= level).pop();
    if (newDecorLevel) fxDecorReveal(newDecorLevel);
  }
  if (streakDelta > 0) fxStreakUp(streakDelta);
  // Streak keeper (Task 15): kind restart line on a real reset diff, and
  // the once-per-WIB-day daytime nudge (self-gated by its localStorage
  // day-flag, so poll repeats can never re-fire it).
  if (!firstRender && prevStreak > 1 && streakDays <= 1) fxStreakBroken();
  // First-render suppression applies to the nudge too: the first paint of a
  // session never floats it (celebration policy — and retake continuity:
  // the localStorage day-flag alone would make take 1 differ from retakes).
  if (!firstRender) maybeStreakNudge(bond, streakDays);

  // Decorations are STATE, not celebration: re-derive them from the current
  // level on every render, first render included (idempotent toggles).
  applyDecorations(level);
  const chapterNow = Number(bond.current_chapter);
  if (Number.isFinite(chapterNow) && chapterNow > 0) prevChapter = chapterNow;

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
      minute: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { date, hour: Number(get("hour")) % 24, minute: Number(get("minute")) || 0 }; // some engines say "24" at midnight
  } catch {
    // Fixed UTC+7 fallback keeps a classroom demo useful even in a browser
    // whose Intl build omitted IANA timezone data. Jember/WIB has no DST.
    const shifted = new Date(Date.now() + 7 * 60 * 60_000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const day = String(shifted.getUTCDate()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
  }
}

/** Visible home clock. This deliberately shares the same WIB source used by
 * streaks and the day/night world, so the sky, date logic, and displayed time
 * cannot disagree when the viewer's device is in another timezone. */
function renderJemberClock() {
  const now = wibNow();
  const time = $("#jember-clock-time");
  if (!time) return;
  if (!now) {
    time.textContent = "--:--";
    return;
  }
  time.textContent = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;
}

renderJemberClock();
window.setInterval(renderJemberClock, 30_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderJemberClock();
});

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
  // Never say "visit today" over a sleeping character (spec §6.2) — the
  // 20:00 cutoff below already covers most of the night window.
  if (sleepShown) return;
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

// ── Jamkachu memories (spec §6.5) ───────────────────────────────────────
// No AI: template sentences built from the last few bond_events rows
// (queried in refresh(); table/query failure is silently tolerated), rotated
// into the idle speech bubble at most ONCE per hour (localStorage
// pm_memory_at) — and only when the mood is Happy, Jamkachu is not
// sleeping, and no pet/care line is pending. The bubble rides the shared
// showTransientBubble machinery, so mood/sleep transitions cancel a stale
// restore exactly like they do for petting.

const MEMORY_AT_KEY = "pm_memory_at";
const MEMORY_INTERVAL_MS = 3600_000; // one memory line per visit-hour
const MEMORY_BUBBLE_MS = 6000;
const MEMORIES_FALLBACK = {
  day: { today: "Today", yesterday: "Yesterday", earlier: "A few days ago" },
  quest: (day) => `${day} you helped me feel better!`,
  badge: (name) => `We earned the ${name} badge together!`,
  chapter: (n) => `Our story reached chapter ${n}!`,
  streak: (n) => `${n} days of care — I remember every one!`,
};
let memoryLines = []; // template lines built from the latest bond_events

/** WIB calendar date ("YYYY-MM-DD") of an ISO timestamp, or null. */
function wibDateString(iso) {
  try {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

/** "Today" / "Yesterday" / "A few days ago" (locale copy) for an event
 *  timestamp, counted in WIB calendar days like the server's streak. */
function relativeDayWIB(iso) {
  const now = wibNow();
  const eventDate = wibDateString(iso);
  if (!now || !eventDate) return null;
  const diffDays = Math.round((Date.parse(now.date) - Date.parse(eventDate)) / 86_400_000);
  const day = PM().memories?.day ?? MEMORIES_FALLBACK.day;
  if (diffDays <= 0) return day.today ?? MEMORIES_FALLBACK.day.today;
  if (diffDays === 1) return day.yesterday ?? MEMORIES_FALLBACK.day.yesterday;
  return day.earlier ?? MEMORIES_FALLBACK.day.earlier;
}

/** Template line for one bond_events row, or null when no template fits
 *  (LEVEL_UP rows and unparsable reasons are simply skipped). */
function memoryLineFor(row) {
  if (!row || row.type !== "XP_AWARDED") return null;
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const reason = String(data.reason ?? "");
  const M = PM().memories ?? {};
  if (reason.startsWith("badge:")) {
    // Localized badge display name (strings.js `badges`, id names verbatim
    // from BADGE_COPY_ID) — prettifyKey stays the unknown-key fallback.
    const badgeKey = reason.slice("badge:".length);
    const name = PM().badges?.[badgeKey] ?? prettifyKey(badgeKey);
    return (M.badge ?? MEMORIES_FALLBACK.badge)(name);
  }
  if (reason.startsWith("chapter:")) {
    const digits = reason.replace(/\D+/g, "");
    if (!digits) return null;
    return (M.chapter ?? MEMORIES_FALLBACK.chapter)(Number.parseInt(digits, 10));
  }
  if (reason.startsWith("streak-milestone:")) {
    const digits = reason.replace(/\D+/g, "");
    if (!digits) return null;
    return (M.streak ?? MEMORIES_FALLBACK.streak)(Number.parseInt(digits, 10));
  }
  // Everything else (bare quest keys, lucky bonuses, daily/mood/growth
  // awards) reads as shared care — the relative-day helper line.
  const day = relativeDayWIB(row.occurred_at);
  if (!day) return null;
  return (M.quest ?? MEMORIES_FALLBACK.quest)(day);
}

function noteMemoryRows(rows) {
  memoryLines = (Array.isArray(rows) ? rows : []).map(memoryLineFor).filter(Boolean);
}

/** At most one memory per hour, into an IDLE bubble only. Storage failure ⇒
 *  stay silent (once-per-hour cannot be guaranteed without it). */
function maybeShowMemory() {
  if (memoryLines.length === 0) return;
  if (careMood !== "Happy" || sleepShown) return; // Happy + awake only
  if (petRestoreTimer !== null || petSavedBubble !== null) return; // bubble busy
  if (hatchPendingOrActive() || tourActive) return; // never talk over the hatching intro or the tour
  let last = null;
  try {
    last = window.localStorage.getItem(MEMORY_AT_KEY);
  } catch {
    return;
  }
  const now = Date.now();
  const lastAt = Number(last);
  if (Number.isFinite(lastAt) && lastAt > 0 && now - lastAt < MEMORY_INTERVAL_MS) return;
  try {
    window.localStorage.setItem(MEMORY_AT_KEY, String(now));
  } catch {
    return;
  }
  const line = chooseFreshDialogue(memoryLines);
  if (!line) return;
  showTransientBubble(line, MEMORY_BUBBLE_MS);
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
  // Night guard (spec §6.2): inside the sleep window light diffs are normal
  // day/night physics — never celebrate light (nor treat 0 as a problem).
  if (next.light >= 30 && prevSensors.light < 30 && !isNightWIB()) {
    echoChip("light", "#env-light", PM().echo?.lightOn ?? ECHO_FALLBACK.lightOn);
  }
  if (next.temperature != null) prevSensors.temperature = next.temperature;
  if (next.humidity != null) prevSensors.humidity = next.humidity;
  if (next.light != null) prevSensors.light = next.light;
}

// ── Sensor HUD stat-tile gauge + comfort range (2026-08-09 spec) ────────
// The 10-segment comfort gauge and the explicit "Ideal min–max" line are
// both sourced from the ACTIVE crop profile's real thresholds via the
// existing /api/crop-profile endpoint — never hand-typed numbers. When the
// endpoint is unavailable `cropProfile` stays null: the range line hides and
// the gauge falls back to a neutral, band-less bar (still plotting the real
// reading's position on a plain scale).

let cropProfile = null; // toDeviceCropProfile() shape from /api/crop-profile, or null
let cropProfileFetchedOnce = false;
let lastReading = null; // latest raw sensor row, replayed once the profile lands

/** Hand the live crop's thresholds to the cheat store. Defensive throughout:
 *  the device profile shape is whatever /api/crop-profile returned, and a
 *  missing branch just leaves the store's strawberry defaults in place. */
function pushCheatBands(profile) {
  if (!window.PMCheat?.setBands || !profile) return;
  window.PMCheat.setBands({
    temp: {
      recMin: profile.temperature?.recommended?.min,
      recMax: profile.temperature?.recommended?.max,
      overheatEnter: profile.temperature?.overheating?.enterAtOrAbove,
      coldEnter: profile.temperature?.cold?.enterAtOrBelow,
    },
    humidity: {
      recMin: profile.airHumidity?.recommended?.min,
      recMax: profile.airHumidity?.recommended?.max,
      dryEnter: profile.airHumidity?.dryAir?.enterBelow,
      humidEnter: profile.airHumidity?.humidAir?.enterAbove,
    },
    ph: { recMin: profile.soilPh?.recommended?.min, recMax: profile.soilPh?.recommended?.max },
    light: { min: profile.light?.minimumPercentDuringLightingHours },
  });
}

async function refreshCropProfile() {
  try {
    const res = await fetch(`/api/crop-profile?plantId=${encodeURIComponent(PLANT_ID)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.profile) {
        cropProfile = data.profile;
        // Point the sandbox's care-action targets at this crop, so "put it in
        // the sun" overheats a strawberry and a cayenne at their own numbers.
        pushCheatBands(cropProfile);
      }
      // A non-ok body (404 unknown plant, 503 no supabase) is left as-is:
      // keep whatever the last known-good profile was rather than blanking
      // the range lines over a transient hiccup.
    }
  } catch {
    // Network hiccup — keep the last known-good profile (or null on the
    // very first attempt, which correctly hides the range line).
  } finally {
    if (!cropProfileFetchedOnce) {
      cropProfileFetchedOnce = true;
      // Repaint immediately once the FIRST fetch settles so the range line
      // doesn't wait for the next 15s poll tick to appear.
      if (lastReading) renderSensors(lastReading);
    }
  }
}

const GAUGE_SEGMENTS = 10;
// Neutral (profile-unavailable) position-only scales — no comfort claim.
const GAUGE_NEUTRAL_DOMAIN = {
  temp: { min: 10, max: 40 },
  hum: { min: 0, max: 100 },
  light: { min: 0, max: 100 },
  ph: { min: 0, max: 14 },
};

/** Alert decision per tile: the fetched crop profile's band when loaded
 *  (the SAME band the gauge highlights, so tile status and gauge can never
 *  disagree), the legacy VITAL_* constants only as the profile-null
 *  fallback. Alert sides mirror mood semantics: temp = too hot, humidity =
 *  too dry, pH = outside either side. */
/** Designer condition badge for a vital that has drifted out of its comfort
 *  band (assets/moods). Icons name the DIRECTION — too hot vs too cold, too
 *  wet vs too dry — so a child reads which way to correct without decoding
 *  numbers. Returns "" while a reading sits in range. */
function vitalConditionBadge(kind, value) {
  const band = gaugeDomainAndBand(kind, cropProfile).band;
  if (!band) return "";
  if (kind === "temp") return value > band.max ? "mood-02-overheating" : value < band.min ? "mood-11-too-cold" : "";
  if (kind === "hum") return value > band.max ? "mood-09-too-wet" : value < band.min ? "mood-08-thirsty" : "";
  if (kind === "light") return value > band.max ? "mood-10-too-bright" : "";
  if (kind === "ph") return value < band.min ? "mood-05-soil-acidic" : value > band.max ? "mood-06-soil-alkaline" : "";
  return "";
}

/** Paint (or clear) the condition badge on one vital tile. Idempotent: the
 *  element is created once and reused, and a missing badge file simply
 *  leaves the tile as it was — the text status is the real signal. */
function renderVitalBadge(card, kind, value) {
  if (!card) return;
  const key = vitalConditionBadge(kind, value);
  let badge = card.querySelector(".env-condition-badge");
  if (!key) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("img");
    badge.className = "env-condition-badge";
    badge.alt = "";
    badge.setAttribute("aria-hidden", "true");
    badge.addEventListener("error", () => badge.remove(), { once: true });
    card.appendChild(badge);
  }
  const src = `/farm/assets/moods/4x/${key}.png`;
  if (!badge.src.endsWith(src)) badge.src = src;
}

function vitalAlert(kind, value) {
  const band = gaugeDomainAndBand(kind, cropProfile).band;
  if (kind === "temp") return band ? value > band.max : value > VITAL_TEMP_HOT;
  if (kind === "hum") return band ? value < band.min : value < VITAL_HUM_DRY;
  if (kind === "ph") return band ? value < band.min || value > band.max : value < VITAL_PH_MIN || value > VITAL_PH_MAX;
  return false;
}

/** Gauge domain (full scale) + comfort band for one vital, from the active
 *  crop profile. Domain fields (tolerated / 0–100 / 0–14) are real profile
 *  shape, not invented; the band is the profile's recommended/comfortable
 *  range — the same numbers the range line prints. Returns `band: null`
 *  when no profile is loaded (neutral gauge). */
function gaugeDomainAndBand(kind, profile) {
  if (!profile) return { domain: GAUGE_NEUTRAL_DOMAIN[kind], band: null };
  if (kind === "temp") {
    return {
      domain: { min: profile.temperature.tolerated.min, max: profile.temperature.tolerated.max },
      band: { min: profile.temperature.recommended.min, max: profile.temperature.recommended.max },
    };
  }
  if (kind === "hum") {
    return { domain: { min: 0, max: 100 }, band: { min: profile.airHumidity.recommended.min, max: profile.airHumidity.recommended.max } };
  }
  if (kind === "light") {
    return { domain: { min: 0, max: 100 }, band: { min: profile.light.minimumPercentDuringLightingHours, max: 100 } };
  }
  return { domain: { min: 0, max: 14 }, band: { min: profile.soilPh.recommended.min, max: profile.soilPh.recommended.max } };
}

/** Builds the 10 segment cells + the position marker once per gauge element
 *  (idempotent — a re-render only updates classes/position, never rebuilds
 *  the DOM). */
function ensureGaugeSegments(gauge) {
  if (gauge.childElementCount > 0) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < GAUGE_SEGMENTS; i++) {
    const seg = document.createElement("span");
    seg.className = "env-gauge-seg";
    frag.appendChild(seg);
  }
  const marker = document.createElement("b");
  marker.className = "env-gauge-marker";
  marker.hidden = true;
  frag.appendChild(marker);
  gauge.appendChild(frag);
}

/** Paints one tile's 10-segment gauge: highlights the comfort band's cells
 *  (none when `profile` is null) and positions the marker at `value`'s real
 *  position on the domain. */
function renderGauge(kind, value, profile) {
  const gauge = $(`.env-gauge[data-gauge="${kind}"]`);
  if (!gauge) return;
  ensureGaugeSegments(gauge);
  const { domain, band } = gaugeDomainAndBand(kind, profile);
  const span = domain.max - domain.min || 1;
  let bandStart = -1;
  let bandEnd = -1;
  if (band) {
    bandStart = Math.max(0, Math.min(GAUGE_SEGMENTS - 1, Math.floor(((band.min - domain.min) / span) * GAUGE_SEGMENTS)));
    bandEnd = Math.max(0, Math.min(GAUGE_SEGMENTS - 1, Math.ceil(((band.max - domain.min) / span) * GAUGE_SEGMENTS) - 1));
  }
  gauge.querySelectorAll(".env-gauge-seg").forEach((seg, i) => {
    seg.classList.toggle("in-band", band != null && i >= bandStart && i <= bandEnd);
  });
  gauge.classList.toggle("no-band", band == null);
  const marker = gauge.querySelector(".env-gauge-marker");
  if (!marker) return;
  if (Number.isFinite(value)) {
    marker.style.left = `${Math.max(0, Math.min(100, ((value - domain.min) / span) * 100))}%`;
    marker.hidden = false;
  } else {
    marker.hidden = true;
  }
}

// (Text diet: the explicit "Ideal 18–28°C" range line is gone — the gauge's
// highlighted band, fed by the same crop profile, already shows the ideal
// zone without another line of numbers per tile.)

const STALE_READING_MS = 10 * 60_000; // 10 minutes (spec: staleness honesty)

/** "HH:MM" in WIB (the sensor's own clock), or null if Intl/timezone data
 *  is unavailable — the staleness line then simply stays absent. */
function wibTimeLabel(date) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("hour")}:${get("minute")}`;
  } catch {
    return null;
  }
}

/** Returns the localized "last/terakhir HH:MM" line when `recordedAt` is
 *  older than 10 minutes, else null (fresh — no staleness line). */
function staleLabel(recordedAt) {
  if (!recordedAt) return null;
  const ts = Date.parse(recordedAt);
  if (!Number.isFinite(ts) || Date.now() - ts < STALE_READING_MS) return null;
  const time = wibTimeLabel(new Date(ts));
  return time ? `${t("env.last")} ${time}` : null;
}

// Honest sensor-waiting state (strings.js "sensorWait" twin): shown when
// the backend IS configured but the sensor query returns no row — a fresh
// install whose device has never sent anything. English fallback matches
// the HATCH_FALLBACK pattern.
const SENSOR_WAIT_FALLBACK = {
  status: "waiting…",
  note: "My sensors are still waking up — the numbers will appear here on their own once the device is connected.",
};

/** Gentle waiting state instead of silent "--" dashes: each .env-status
 *  says a short localized "waiting…" and one child-friendly line under the
 *  board explains that values will appear on their own. Display-only and
 *  timer-free: renderSensors hides the note and overwrites every status
 *  the moment a real reading lands. */
function renderSensorsWaiting() {
  if (lastReading != null) return; // real data already painted the tiles
  const W = PM().sensorWait ?? {};
  const status = W.status ?? SENSOR_WAIT_FALLBACK.status;
  for (const label of document.querySelectorAll("#env-strip .env-status")) {
    label.textContent = status;
  }
  const note = $("#env-waiting-note");
  if (note) {
    note.textContent = W.note ?? SENSOR_WAIT_FALLBACK.note;
    note.hidden = false;
  }
  renderCareFocus("waiting");
}

/** Environment strip (#env-strip): 2×2 game-HUD stat tiles (4×1 on the
 *  ≥801px desktop rail) — big real reading, 10-segment comfort gauge, and
 *  staleness honesty. The status vocabulary is deliberately tiny (text
 *  diet): exactly two states per axis — id "Aman" / "Perlu dicek", en "OK"
 *  / "Check" — plus the light tile's honest night case. Detail lives in
 *  Plant Status (/monitoring). */
function renderSensors(reading) {
  lastReading = reading; // replayed by refreshCropProfile() once ranges land
  // A real reading replaces the waiting state (renderSensorsWaiting): the
  // note hides here, and any tile still showing the waiting word falls back
  // to the neutral "--" — the per-field guards below only touch fields the
  // device reports, so without this reset a never-reported field (e.g. a
  // probe with no soil pH) would stay frozen on "waiting…" forever.
  const waitingNote = $("#env-waiting-note");
  if (waitingNote) waitingNote.hidden = true;
  const waitingStatus = PM().sensorWait?.status ?? SENSOR_WAIT_FALLBACK.status;
  for (const label of document.querySelectorAll("#env-strip .env-status")) {
    if (label.textContent === waitingStatus || label.textContent === SENSOR_WAIT_FALLBACK.status) {
      label.textContent = "--";
    }
  }
  const staleText = staleLabel(reading?.recorded_at);
  const statusOk = t("env.ok");
  const statusCheck = t("env.check");
  const updateHud = (kind, value, status, alert) => {
    const card = $(`[data-vital="${kind}"]`);
    if (!card) return;
    // Read the marker before and after so the movement trail can reuse
    // renderGauge's own domain maths instead of repeating it.
    const marker = card.querySelector(".env-gauge-marker");
    const beforeLeft = marker && !marker.hidden ? Number.parseFloat(marker.style.left) : NaN;
    renderGauge(kind, value, cropProfile);
    const afterLeft = marker ? Number.parseFloat(marker.style.left) : NaN;
    emphasiseVital(kind, value, beforeLeft, afterLeft);
    card.classList.toggle("is-alert", alert);
    card.classList.toggle("is-stale", staleText != null);
    renderVitalBadge(card, kind, value);
    const label = card.querySelector(".env-status");
    if (label) label.textContent = staleText ?? status;
  };
  const temperature = Number(reading?.temperature);
  if (reading?.temperature != null && Number.isFinite(temperature)) {
    setText("#env-temp", `${temperature.toFixed(1)}°C`);
    lastVitals.temperature = temperature; // pressable vitals (T19)
    // Heat shimmer (living world, item 5): body.env-hot mirrors the SAME
    // >32°C threshold the pressable vitals + mood engine use. Pure state —
    // silent, no copy, removed as soon as readings return to range.
    document.body?.classList.toggle("env-hot", temperature > VITAL_TEMP_HOT);
    const tempHot = vitalAlert("temp", temperature);
    updateHud("temp", temperature, tempHot ? statusCheck : statusOk, tempHot);
  }

  const humidity = Number(reading?.humidity);
  if (reading?.humidity != null && Number.isFinite(humidity)) {
    setText("#env-hum", `${Math.round(humidity)}%`);
    lastVitals.humidity = humidity;
    const humDry = vitalAlert("hum", humidity);
    updateHud("hum", humidity, humDry ? statusCheck : statusOk, humDry);
  }

  const soilPh = Number(reading?.soil_ph);
  if (reading?.soil_ph != null && Number.isFinite(soilPh)) {
    setText("#env-ph", `pH ${soilPh.toFixed(1)}`);
    lastVitals.soilPh = soilPh;
    const phOff = vitalAlert("ph", soilPh);
    updateHud("ph", soilPh, phOff ? statusCheck : statusOk, phOff);
  }

  const light = Number(reading?.light);
  if (reading?.light != null && Number.isFinite(light) && light >= 0 && light <= 100) {
    lastVitals.light = light;
    // Night (spec §6.2): light=0 inside the 18:00–06:00 WIB window is
    // normal, not a problem — present it as "Night 🌙", never as "Dark".
    setText(
      "#env-light",
      isNightWIB() && light < 30 ? (PM().sleep?.nightLabel ?? SLEEP_FALLBACK.nightLabel) : `${light}%`,
    );
    updateHud("light", light, isNightWIB() && light < 30 ? (appLocale === "id" ? "Malam ✓" : "Night ✓") : light < 30 ? statusCheck : statusOk, !isNightWIB() && light < 30);
  }

  // (Text diet: the widget's old indoor-reading line is gone — it merely
  // duplicated the SUHU/UDARA tiles right below.)

  // Reconcile a possibly older plants.current_state with the newest sensor
  // card alerts after all four cards have been evaluated.
  applyMoodPulse(careMood);

  // Causal echo (Task 11): diff-driven chips for real sensor improvements.
  causalEcho({
    temperature: reading?.temperature != null && Number.isFinite(temperature) ? temperature : null,
    humidity: reading?.humidity != null && Number.isFinite(humidity) ? humidity : null,
    light: reading?.light != null && Number.isFinite(light) && light >= 0 && light <= 100 ? light : null,
  });
  // Sensor availability may arrive before or after the quest query. Repaint
  // from the last quest snapshot so the focus card never stays on "connect"
  // once real values are visible.
  renderQuestSlot(lastQuestRows);
}

/** Forecast → the designer's drawing plus the emoji it replaced, kept as the
 *  fallback. Branch order matters and is unchanged: BMKG says "Cerah Berawan"
 *  for partly cloudy, so the cloud test has to run before the sunny one or
 *  every partly-cloudy hour would claim clear skies.
 *
 *  The sun-behind-cloud drawing serves both "berawan" and the catch-all — the
 *  set has no separate overcast piece, and 🌤️, the emoji the catch-all used,
 *  pictured exactly that. */
function weatherArt(description) {
  const normalized = String(description ?? "").toLowerCase();
  if (normalized.includes("petir") || normalized.includes("thunder")) return { src: "/icons/weather-thunder.png", emoji: "⛈️" };
  if (normalized.includes("hujan") || normalized.includes("rain")) return { src: "/icons/weather-rain.png", emoji: "🌧️" };
  if (normalized.includes("kabut") || normalized.includes("mist") || normalized.includes("fog")) return { src: "/icons/weather-fog.png", emoji: "🌫️" };
  if (normalized.includes("berawan") || normalized.includes("cloud")) return { src: "/icons/weather-cloud.png", emoji: "☁️" };
  if (normalized.includes("cerah") || normalized.includes("sunny") || normalized.includes("clear")) return { src: "/icons/weather-sunny.png", emoji: "☀️" };
  return { src: "/icons/weather-cloud.png", emoji: "🌤️" };
}

function weatherIcon(description) {
  return weatherArt(description).emoji;
}

/** Weather widget, text-diet edition: icon + temperature + one short
 *  description line. Provenance (BMKG credit, forecast timestamp) and the
 *  indoor duplicate line moved out — /monitoring keeps the full detail.
 *  The stale class still tints the widget when the forecast is old. */
function renderWeather(context) {
  const widget = $(".weather-widget");
  if (!context?.ok) {
    setText(".weather-text .desc", t("weather.unavailable"));
    widget?.classList.add("weather-stale");
    return;
  }
  const description = appLocale === "id"
    ? (context.forecast.descriptionId ?? context.forecast.descriptionEn)
    : (context.forecast.descriptionEn ?? context.forecast.descriptionId);
  setText(".weather-text .temp", `${Math.round(Number(context.forecast.temperatureC))}°C`);
  // Jargon-free humidity: "kelembapan 78%" instead of "78% RH".
  const outdoorHumidity = Number(context.forecast.humidityPct);
  const humidityNote = Number.isFinite(outdoorHumidity)
    ? (appLocale === "id" ? `kelembapan ${Math.round(outdoorHumidity)}%` : `humidity ${Math.round(outdoorHumidity)}%`)
    : null;
  setText(".weather-text .desc", humidityNote ? `${description} · ${humidityNote}` : description);
  const icon = $(".weather-icon");
  if (icon) {
    // The src comes from weatherArt's fixed table — `description` only picks
    // the branch and never reaches innerHTML. alt="" because the forecast text
    // beside it already names the weather.
    const art = weatherArt(description);
    icon.innerHTML = `<img class="pm-inline-art" src="${art.src}" alt="">`;
  }
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

// ── Hatching intro (spec §6.3, one-time) ────────────────────────────────
// First visit only (PMSeen "hatch" — migrated from the legacy pm_hatched
// flag by seen.js): pot trembles → Jamkachu pops
// out (confetti + fanfare + name card) → personality/rename card → finale
// highlighting the contextual care button and the current quest slot.
// ENTIRELY presentation: no writes, no XP. Text-diet pass: the four
// per-sensor cards were cut — the first-day tour's step 1 spotlights the
// same sensor tiles moments later, so nothing is lost, just less reading
// between the player and the fun. Every step is tap-to-advance with a 5s
// auto-advance; Skip stays visible. Reduced motion: the same cards, no
// shake/pop/confetti. Runs after the first render settles — with Supabase
// unconfigured too (default happy character); the flag is set either way.

const HATCH_SEEN_ID = "hatch";
const HATCH_STEP_MS = 5000;
const HATCH_SETTLE_MS = 800;
const HATCH_FALLBACK = {
  skip: "Skip",
  rumble: "Rumble rumble… something is stirring in the pot!",
  hello: "Nice to meet you!",
  personality: "I'm a sunshine-loving little plant — cozy air, bright days, and lots of hanging out with you!",
  rename: "You can change my name in Settings ⚙️",
  finale: "This button always shows what I need!",
};
let hatchActive = false;
// Coach engine (pmCoach below — the first-day tour and every future coach
// card run through it): quiets the same systems hatchActive quiets — every
// suppression gate checks both flags.
let tourActive = false;

/** True while the intro is running OR still owed to this browser — used by
 *  the memory rotation so a bubble never talks over the hatching. A broken
 *  seen-store fails closed (pmSeenFlag reports seen ⇒ never pending). */
function hatchPendingOrActive() {
  return hatchActive || !pmSeenFlag(HATCH_SEEN_ID);
}

/** Schedule the one-time intro after the first render settles. Unreadable
 *  storage ⇒ skip (pmSeenFlag fails closed): without a working flag we
 *  could not keep it one-time. */
function scheduleHatch(plantName) {
  const seen = pmSeenFlag(HATCH_SEEN_ID);
  if (seen || hatchActive) {
    // Hatched on an earlier visit (possibly before the tour existed) — the
    // first-day tour may still be owed. scheduleTour re-checks its own flag.
    scheduleTour();
    return;
  }
  setTimeout(() => runHatchIntro(plantName), HATCH_SETTLE_MS);
}

function runHatchIntro(plantName) {
  if (hatchActive || !document.body) return;
  hatchActive = true;
  // One-time either way (spec §6.3) — seen-flag FIRST (PMSeen "hatch"), so
  // a mid-sequence reload can never replay the intro.
  pmMarkSeen(HATCH_SEEN_ID);
  const H = PM().hatch ?? {};
  const F = HATCH_FALLBACK;
  const name = typeof plantName === "string" && plantName.trim() ? plantName.trim() : "Jamkachu";
  const reduce = prefersReducedMotion();

  const layer = document.createElement("div");
  layer.id = "hatch-layer";
  const card = document.createElement("div");
  card.className = "hatch-card";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "pixel-btn hatch-skip";
  skip.textContent = H.skip ?? F.skip;
  layer.appendChild(card);
  layer.appendChild(skip);
  document.body.appendChild(layer);

  const wrapper = $(".mascot-wrapper");
  const svg = $(".mascot-svg");
  const container = $(".mascot-container");

  /** Card body: optional pixel title + any number of body lines. */
  const setCard = (title, lines) => {
    card.innerHTML = "";
    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "hatch-card-title";
      titleEl.textContent = title;
      card.appendChild(titleEl);
    }
    for (const line of lines ?? []) {
      const lineEl = document.createElement("div");
      lineEl.className = "hatch-card-line";
      lineEl.textContent = line;
      card.appendChild(lineEl);
    }
  };
  const steps = [
    () => {
      // (1) Pot trembles, plant hidden — rumble + "whoosh" cue.
      svg?.classList.add("hatch-pre");
      container?.classList.add("hatch-hidden");
      if (!reduce) wrapper?.classList.add("hatch-shake");
      window.PMSfx?.play("whoosh");
      setCard(null, [H.rumble ?? F.rumble]);
    },
    () => {
      // (2) Jamkachu pops up: scale-in + confetti + fanfare + name card.
      svg?.classList.remove("hatch-pre");
      container?.classList.remove("hatch-hidden");
      wrapper?.classList.remove("hatch-shake");
      window.PMSfx?.play("fanfare");
      window.PMSfx?.buzz(20);
      const rect = mascotRect();
      spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 26);
      if (wrapper && !reduce) {
        wrapper.style.transformOrigin = "50% 90%";
        animateSafe(
          wrapper,
          [
            { transform: "scale(0.2)", opacity: 0 },
            { transform: "scale(1.12)", opacity: 1, offset: 0.7 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: 600, easing: "steps(6, end)" },
        );
      }
      card.innerHTML = "";
      const big = document.createElement("div");
      big.className = "hatch-card-title hatch-name";
      big.textContent = `${name.toUpperCase()}!`;
      const sub = document.createElement("div");
      sub.className = "hatch-card-line";
      sub.textContent = H.hello ?? F.hello;
      card.appendChild(big);
      card.appendChild(sub);
    },
    // (3) Personality + "rename me in Settings" care hint card.
    () => setCard(null, [H.personality ?? F.personality, H.rename ?? F.rename]),
    () => {
      // (4) Finale: highlight the care button + pulse the quest slot.
      layer.classList.add("hatch-final");
      $("#care-action")?.classList.add("hatch-highlight");
      $("#current-quest")?.classList.add("hatch-highlight");
      window.PMSfx?.play("blip");
      setCard(null, [H.finale ?? F.finale]);
    },
  ];

  let index = -1;
  let stepTimer = null;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (stepTimer !== null) clearTimeout(stepTimer);
    hatchActive = false;
    layer.remove();
    // Undo every stage class the sequence may have left behind.
    svg?.classList.remove("hatch-pre");
    container?.classList.remove("hatch-hidden");
    wrapper?.classList.remove("hatch-shake");
    $("#care-action")?.classList.remove("hatch-highlight");
    $("#current-quest")?.classList.remove("hatch-highlight");
    // Brand-new players roll straight into the first-day tour: the hatch
    // seen-flag was written up front, so hatchPendingOrActive() no longer
    // blocks it.
    scheduleTour();
  };
  const advance = () => {
    if (ended) return;
    index++;
    if (index >= steps.length) {
      finish();
      return;
    }
    try {
      steps[index]();
    } catch {}
    if (stepTimer !== null) clearTimeout(stepTimer);
    stepTimer = setTimeout(advance, HATCH_STEP_MS);
  };
  layer.addEventListener("pointerdown", (event) => {
    if (event.target === skip || skip.contains(event.target)) {
      finish();
      return;
    }
    window.PMSfx?.play("blip");
    advance();
  });
  advance();
}

// ── Coach engine (pmCoach) — dim + spotlight + emoji + ONE sentence ─────
// Generalized from the first-day tour so every coach (the tour today,
// future "dare.*"/"coach.*" cards) shares one host. Card schema:
//   cards = [{ target: cssSelector|null, emoji, text,
//              dare?: { label, event } }]
// Rules (kid-guide plan): a light dim with the shared .hatch-highlight
// spotlight on each card's target, one big emoji, ONE short sentence (a
// "\n" splits an honesty add-on onto its own line), and the FINAL card
// carries an action dare — a real button with a verb label. Completing
// the dare celebrates COSMETICALLY through the existing celebration queue
// (confetti + fanfare only — zero rewards, zero game writes), marks the
// coach seen (PMSeen), and dispatches the dare's window event so the host
// page can act (e.g. open the sticker book). Skip stays visible;
// tap-to-advance + 5s auto-advance, except dare cards, which wait for the
// kid (tapping through still works). Reuses the hatch card chrome and the
// shared tourActive quiet flag, so everything the hatch/tour quieted
// stays quiet for every coach.

const COACH_STEP_MS = 5000;
// Let the dare confetti read before the dare's event opens any UI.
const COACH_DARE_EVENT_DELAY_MS = 650;

function pmCoach(id, cards) {
  if (tourActive || hatchActive || !document.body) return false;
  const deck = (Array.isArray(cards) ? cards : []).filter(
    (entry) => entry && typeof entry.text === "string" && entry.text.trim(),
  );
  if (deck.length === 0) return false;
  tourActive = true;
  const reduce = prefersReducedMotion();

  const layer = document.createElement("div");
  layer.className = "coach-layer";
  const card = document.createElement("div");
  card.className = "hatch-card coach-card";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "pixel-btn hatch-skip";
  skip.textContent = PM().tour?.skip ?? TOUR_FALLBACK.skip;
  layer.appendChild(card);
  layer.appendChild(skip);
  document.body.appendChild(layer);

  const clearSpotlights = () => {
    for (const el of document.querySelectorAll(".hatch-highlight")) el.classList.remove("hatch-highlight");
  };
  /** Move the .hatch-highlight spotlight onto this card's target (if any). */
  const spotlight = (selector) => {
    clearSpotlights();
    if (!selector) return;
    const el = $(selector);
    el?.classList.add("hatch-highlight");
    try {
      el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    } catch {}
  };

  let stepTimer = null;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (stepTimer !== null) clearTimeout(stepTimer);
    tourActive = false;
    layer.remove();
    // Undo every spotlight the sequence may have left behind.
    clearSpotlights();
    // Seen either way (Skip included) — a coach never nags twice.
    pmMarkSeen(id);
  };

  /** Action dare completed: celebrate cosmetically through the existing
   *  celebration queue (nothing is granted — this is charm, not payout),
   *  then hand the dare's event to the page. */
  const completeDare = (entry) => {
    if (ended) return;
    const anchor = (entry.target ? $(entry.target) : null) ?? card;
    const rect = anchor.getBoundingClientRect();
    finish();
    fxEnqueue(
      2,
      (done) => {
        window.PMSfx?.play("fanfare");
        spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);
        setTimeout(done, 900);
      },
      1200,
      { kind: "coach" },
    );
    if (entry.dare?.event) {
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent(entry.dare.event));
        } catch {}
      }, COACH_DARE_EVENT_DELAY_MS);
    }
  };

  /** One card: big emoji + one short sentence (+ the dare button, which is
   *  the single interactive island inside the pointer-events:none card). */
  const renderCard = (entry) => {
    card.innerHTML = "";
    if (entry.emoji) {
      const emojiEl = document.createElement("div");
      emojiEl.className = "coach-emoji";
      emojiEl.setAttribute("aria-hidden", "true");
      emojiEl.textContent = entry.emoji;
      card.appendChild(emojiEl);
    }
    for (const line of String(entry.text).split("\n")) {
      const lineEl = document.createElement("div");
      lineEl.className = "hatch-card-line";
      lineEl.textContent = line;
      card.appendChild(lineEl);
    }
    if (entry.dare?.label) {
      const dareBtn = document.createElement("button");
      dareBtn.type = "button";
      dareBtn.className = "pixel-btn coach-dare";
      dareBtn.textContent = entry.dare.label;
      dareBtn.addEventListener("pointerdown", () => completeDare(entry));
      // Keyboard activation: click with detail 0 means Enter/Space.
      dareBtn.addEventListener("click", (event) => {
        if (event.detail === 0) completeDare(entry);
      });
      card.appendChild(dareBtn);
    }
  };

  let index = -1;
  const advance = () => {
    if (ended) return;
    index++;
    if (index >= deck.length) {
      finish();
      return;
    }
    const entry = deck[index];
    try {
      spotlight(entry.target ?? null);
      renderCard(entry);
    } catch {}
    // The final dare card drops the dim so the dare target pops (CSS).
    layer.classList.toggle("coach-final", Boolean(entry.dare));
    if (stepTimer !== null) clearTimeout(stepTimer);
    // Dare cards never auto-advance — the whole point is the kid's tap.
    stepTimer = entry.dare ? null : setTimeout(advance, COACH_STEP_MS);
  };
  layer.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".coach-dare")) return; // the dare button handles itself
    if (target && (target === skip || skip.contains(target))) {
      finish();
      return;
    }
    window.PMSfx?.play("blip");
    advance();
  });
  advance();
  return true;
}

// ── First-day tour (pmCoach consumer, display-only, one-time) ───────────
// Closes the gap after the hatch intro: five coach cards pointing at the
// REAL interface — senses HUD, contextual care button, daily quiz chip,
// the quest link, and Grandpa's sticker-book handoff (the action dare).
// ENTIRELY presentation: no network, nothing granted — only seen-flags.
// Runs once, gated by PMSeen "tour" (write-first like the hatch intro,
// migrated from the legacy pm_tour_seen_v1 flag by seen.js): right after
// the hatch intro's finish() for brand-new players, or on page load for
// players who hatched before this update — never while the hatch intro is
// pending or active.

const TOUR_SEEN_ID = "tour";
const TOUR_SETTLE_MS = 900;
const TOUR_FALLBACK = {
  skip: "Skip",
  senses: {
    line: "These four tiles are my real senses — they feel my room for real!",
    waiting: "My senses haven't felt anything yet — the tiles will fill in on their own once my device is connected.",
  },
  care: { line: "This button always shows what I need — and it changes with my mood!" },
  quiz: { line: "Learn and earn here every day — a fresh farm case is waiting!" },
  quest: { line: "When my senses feel a change, a mission appears here!" },
  grandpa: { line: "Lost? Tap me — or fill my sticker book here →", dare: "Open my sticker book!" },
};

/** Schedule the one-time tour after the page settles. Never while the
 *  hatch intro is pending or active — the hatch finish() re-schedules.
 *  Unreadable storage ⇒ stay silent (pmSeenFlag fails closed): without
 *  the flag we could not keep the tour one-time. */
function scheduleTour() {
  if (hatchPendingOrActive()) return;
  if (pmSeenFlag(TOUR_SEEN_ID) || tourActive) return;
  setTimeout(runFirstDayTour, TOUR_SETTLE_MS);
}

function runFirstDayTour() {
  if (tourActive || hatchActive || !document.body) return;
  // The one-time guarantee lives HERE, not at the scheduler call sites:
  // scheduleHatch can legitimately run twice in one load (main() plus its
  // .catch fallback), queueing two timers that both passed scheduleTour's
  // flag check. Re-reading the flag makes the second firing a no-op.
  if (pmSeenFlag(TOUR_SEEN_ID)) return;
  // Write-first, before the first card can render: a mid-tour reload can
  // never replay the tour. The guide-seen flag rides along — the final
  // card points the player at the ? FAB, so the sticker-book modal must
  // not auto-open on a later visit.
  pmMarkSeen(TOUR_SEEN_ID);
  pmMarkSeen("guide.farm");
  const T = PM().tour ?? {};
  const F = TOUR_FALLBACK;
  const senses = T.senses ?? {};
  // Honesty add-on (card 1): if no reading has ever arrived (lastReading
  // unset), say so on its own line instead of pretending dashes are data.
  const sensesLine = senses.line ?? F.senses.line;
  const sensesText = lastReading == null ? `${sensesLine}\n${senses.waiting ?? F.senses.waiting}` : sensesLine;
  const grandpa = T.grandpa ?? {};
  pmCoach(TOUR_SEEN_ID, [
    { target: "#env-strip", emoji: "👀", text: sensesText },
    { target: "#daily-quiz-open", emoji: "🧠", text: T.quiz?.line ?? F.quiz.line },
    { target: "#current-quest", emoji: "🔥", text: T.quest?.line ?? F.quest.line },
    // Final card (kid-guide Task 5): Grandpa waves — the handoff to the
    // sticker book, the ONE replayable help home. The dare's event is
    // caught next to the farm-guide wiring above (pm-open-guide).
    {
      target: "#farm-guide-open",
      emoji: "👨‍🌾",
      text: grandpa.line ?? F.grandpa.line,
      dare: { label: grandpa.dare ?? F.grandpa.dare, event: "pm-open-guide" },
    },
  ]);
}

/** Build the Supabase client. Prefers the vendored UMD bundle (loaded via a
 *  <script> tag in index.html before this module, exposing
 *  window.supabase.createClient synchronously) so the page never depends on
 *  a CDN at runtime. Only falls back to the esm.sh dynamic import if that
 *  script tag is somehow missing, and even that is wrapped in try/catch so
 *  a CDN/network failure can never throw out of main() unhandled — it just
 *  returns null and the caller takes the same offline path as a failed
 *  config fetch. */
async function loadSupabaseClient(url, key) {
  try {
    if (typeof window.supabase?.createClient === "function") {
      return window.supabase.createClient(url, key, supabaseClientOptions);
    }
  } catch {
    // Fall through to the CDN fallback below.
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    return createClient(url, key, supabaseClientOptions);
  } catch {
    return null;
  }
}

// No Supabase (no env config, config fetch failure, or a null client) means
// no plant/bond/companion/sensor rows will ever arrive — so this paints the
// SAME presentable defaults renderPlant/renderBond/renderCompanion would
// paint from a real Happy row, instead of leaving the static markup's
// dev-style "--" placeholders on screen forever. Every offline early-return
// in main() (and the defense-in-depth catch at the bottom of this file)
// calls this exactly once, right before scheduling the hatch intro.
function renderOfflineHome() {
  // Mood word + face + care button/sleep (spec §6) — the one Jamkachu is
  // shown offline is Happy, never a stale "--".
  setMascotMood("Happy");
  renderHp("Happy"); // "HP --" → "HP 100%", same table renderPlant reads
  const bubble = $(".speech-bubble");
  // sleepShown was just derived by setMascotMood → updateCareUi; a night
  // visit already owns the bubble with the sleep line, never stomp it.
  if (bubble && !sleepShown) bubble.innerHTML = moodBubble(MOODS.Happy);
  // XP/streak/seeds badges: no real numbers exist offline, so hide them
  // instead of leaving the static "-- XP" / "-- Days" markup defaults up
  // forever (mirrors renderBond's zero-streak hide; .badge[hidden] now
  // actually hides — see style.css).
  for (const cls of ["coin", "streak", "seeds"]) {
    const badge = $(`.badge.${cls}`);
    if (badge) badge.hidden = true;
  }
  // Companion stage line: the same localized "<STAGE> · STAGE n/N" text
  // renderCompanion paints for a real row, seeded with the ladder's first
  // rung instead of the raw "COMPANION · SEED" markup default. Safe to call
  // this early — prevCompanionStage is still null, so the evolution
  // ceremony's rank-increase check can never fire off a fabricated state.
  renderCompanion({ stage: "Seed" });
  // Sensor tiles: the same honest localized "waiting…" state a configured-
  // but-empty backend shows (renderSensorsWaiting), never raw "--".
  renderSensorsWaiting();
  // Bond-level label: the fresh-start default, never the "Lv.--" markup.
  const levelEl = $(".username");
  if (levelEl) levelEl.textContent = `${t("bond")} Lv.1`;
}

// ── Classroom cheat sandbox (public/farm/cheat.js) ──────────────────────
// When the sandbox is active, main() skips EVERY Supabase read/write and
// realtime subscription (below) so nothing here can touch real data or
// hardware. The sandbox drives the existing display functions (renderBond,
// renderSensors, setMascotMood) with localStorage-only values, and a docked
// editor lets the presenter change status + sensors and see the mascot react
// instantly. Deactivating (cheat.js banner "Exit") reloads back to normal.

const CHEAT_LABELS = {
  id: { panelTitle: "KONTROL DEMO", collapse: "Sembunyikan kontrol", expand: "Tampilkan kontrol", drag: "Seret untuk memindahkan panel", statusTitle: "STATUS JAMKACHU", vitalsTitle: "GARDEN VITALS", actionsTitle: "RAWAT TANAMAN", heldTitle: "Tekan & tahan", oneShotTitle: "Sekali tekan", evolveTitle: "Evolusi", evolveBtn: "▶ Putar upacara", evolveHint: "Memutar upacara evolusi tahap berikutnya. Hanya tampilan — tahap asli tidak berubah.", held: "Ditahan sampai kamu menekan lawannya.", slow: "beberapa hari", slowNote: "Suhu & cahaya seketika, kelembapan hitungan menit — pH tanah butuh berhari-hari.", byValue: "atur lewat angka", level: "Level", xp: "XP", xpMin: "XP minimum untuk level ini", xpMax: "XP maksimum untuk level ini", days: "Hari", seeds: "Benih", temp: "Suhu (°C)", hum: "Kelembapan (%)", light: "Cahaya (%)", ph: "pH Tanah", hint: "Rawat tanamannya → Jamkachu langsung bereaksi. Data asli tidak berubah." },
  en: { panelTitle: "DEMO CONTROLS", collapse: "Hide controls", expand: "Show controls", drag: "Drag to move this panel", statusTitle: "JAMKACHU STATUS", vitalsTitle: "GARDEN VITALS", actionsTitle: "CARE ACTIONS", heldTitle: "Press & hold", oneShotTitle: "One-time actions", evolveTitle: "Evolution", evolveBtn: "▶ Play ceremony", evolveHint: "Plays the next stage's evolution ceremony. Presentation only — the real stage is unchanged.", held: "Held until you press its opposite.", slow: "days later", slowNote: "Temperature & light move at once, humidity within minutes — soil pH takes days.", byValue: "edit by value", level: "Level", xp: "XP", xpMin: "Lowest XP for this level", xpMax: "Highest XP for this level", days: "Days", seeds: "Seeds", temp: "Temp (°C)", hum: "Humidity (%)", light: "Light (%)", ph: "Soil pH", hint: "Care for the plant → Jamkachu reacts instantly. Real data stays untouched." },
};

/** Physically possible range per sensor — mirror of SENSOR_LIMITS in
 *  src/types/raw-sensors.ts, which is what /api/sensor-readings accepts from
 *  the real hardware. A farm-shell script cannot import it, so a test pins the
 *  two together. The sandbox edits the same four numbers by hand, and a demo
 *  must not put a reading on screen that the real path would have rejected:
 *  humidity and light are percentages, pH is the 0–14 scale. */
const CHEAT_VITAL_LIMITS = {
  temperature: { min: -40, max: 100 },
  humidity: { min: 0, max: 100 },
  light: { min: 0, max: 100 },
  soilPh: { min: 0, max: 14 },
};

/** The XP band a bond level owns. levelForXp is floor(xp / XP_PER_LEVEL) + 1
 *  (src/types/game.ts, mirrored by award_xp() in SQL), so Lv.L covers
 *  [(L-1)·30, L·30 − 1]. Level and XP are separate fields in the sandbox
 *  store; keeping the editor inside this band is what stops the panel from
 *  producing a state the real game could never reach — Lv.4 with 0 XP, where
 *  the header says Lv.4 but the XP bar (totalXp % 30) disagrees. */
function cheatXpBounds(level) {
  const safe = Math.min(MAX_BOND_LEVEL, Math.max(1, Math.floor(Number(level)) || 1));
  const min = (safe - 1) * XP_PER_LEVEL;
  // The top level is the exception: it owns everything from its floor upward,
  // because past the cap XP keeps banking while the level holds.
  if (safe >= MAX_BOND_LEVEL) return { min, max: min + XP_PER_LEVEL * 20 };
  return { min, max: min + XP_PER_LEVEL - 1 };
}

/** Mood the sandbox shows for a sensor set — mirrors determinePlantMood's
 *  priority (heat→cold→dry→humid→dark→soil) without hysteresis, so a demo
 *  value maps to one predictable face. Reads the live crop profile when the
 *  /api/crop-profile fetch has landed, else strawberry-ish fallbacks. */
function cheatMoodFor(v, p) {
  const t = p?.temperature ?? {};
  const a = p?.airHumidity ?? {};
  const ph = p?.soilPh?.recommended ?? { min: 5.5, max: 6.5 };
  const lightMin = Number(p?.light?.minimumPercentDuringLightingHours ?? 30);
  const hotAt = Number(t.overheating?.enterAtOrAbove ?? 28);
  const coldAt = Number(t.cold?.enterAtOrBelow ?? 14);
  const dryBelow = Number(a.dryAir?.enterBelow ?? 40);
  const humidAbove = Number(a.humidAir?.enterAbove ?? 60);
  if (v.temperature >= hotAt) return "Overheating";
  if (v.temperature <= coldAt) return "TooCold";
  if (v.humidity < dryBelow) return "DryAir";
  if (v.humidity > humidAbove) return "HumidAir";
  if (v.light < lightMin) return "Sleepy";
  if (v.soilPh < Number(ph.min)) return "SoilAcidic";
  if (v.soilPh > Number(ph.max)) return "SoilAlkaline";
  return "Happy";
}

/** Repaint the whole home from the sandbox: status card (reusing renderBond,
 *  so level-up / XP count-up FX still fire), sensor cards (renderSensors), and
 *  the mascot mood derived from the sandbox sensors. */
function applyCheatFarm() {
  const s = window.PMCheat && window.PMCheat.getState();
  if (!s) return;
  renderBond(
    { total_xp: s.status.totalXp, bond_level: s.status.level, current_streak: s.status.days, seeds: s.status.seeds },
    "JAMKACHU",
  );
  renderSensors({
    temperature: s.vitals.temperature,
    humidity: s.vitals.humidity,
    soil_ph: s.vitals.soilPh,
    light: s.vitals.light,
    recorded_at: null,
  });
  const mood = cheatMoodFor(s.vitals, cropProfile);
  if (typeof window.setMascotMood === "function") {
    window.setMascotMood(mood);
  }
  // The bubble has to move with the face. Without this it kept whatever line
  // the pre-sandbox page had fetched from /api/mood-message — which the demo
  // branch never calls again — so Jamkachu could show an Overheating face over
  // "I'm feeling so healthy!", in whichever locale that stale fetch used.
  // moodBubble reads the local strings table, so it also follows appLocale.
  // Same sleepShown guard as renderOfflineHome: a night visit owns the bubble.
  // trialNoticeUntil is the third claim on it: a trial notice ("Today is Day
  // 3!") must survive the repaints the drift tick fires several times a
  // second, or the one line the whole day-counter feature exists to show
  // would be gone before it could be read.
  const bubble = $(".speech-bubble");
  if (bubble && !sleepShown && Date.now() >= trialNoticeUntil) {
    bubble.innerHTML = moodBubble(MOODS[mood] ?? MOODS.Happy);
  }
  // A held toggle moves the readings four times a second; the panel has to
  // follow, or the buttons and the numbers behind them go stale mid-demo.
  repaintCheatActions(null);
}

/** Render one kind of care action from cheat.js's single list. Held toggles
 *  carry .is-held; the slow (soil pH) ones carry the time badge that keeps the
 *  demo honest about pH taking days rather than seconds. */
function cheatActionButtons(kind) {
  const api = window.PMCheat;
  if (!api || !Array.isArray(api.ACTIONS)) return "";
  const L = CHEAT_LABELS[appLocale] || CHEAT_LABELS.en;
  const held = api.getActions ? api.getActions() : {};
  return api.ACTIONS.filter((a) => a.kind === kind).map((a) => {
    const on = a.kind === "toggle" && a.slot && held[a.slot] === a.id;
    const label = appLocale === "id" ? a.id_label : a.en_label;
    return `<button type="button" class="pm-cheat-action${on ? " is-held" : ""}" data-cheat-action="${a.id}"` +
      (a.kind === "toggle" ? ` aria-pressed="${on ? "true" : "false"}" title="${L.held}"` : "") +
      `><span aria-hidden="true">${a.emoji}</span><span>${label}</span>` +
      (a.slow ? `<em>⏳ ${L.slow}</em>` : "") +
      `</button>`;
  }).join("");
}

/** Push the store's current state back onto the panel: which toggles are held,
 *  and the by-value fields, which the toggle tick is moving underneath them.
 *  Never touches the field being typed into. */
function repaintCheatActions(panel) {
  const root = panel || document.getElementById("pm-cheat-panel");
  const api = window.PMCheat;
  if (!root || !api) return;
  const held = api.getActions ? api.getActions() : {};
  const byId = new Map((api.ACTIONS || []).map((a) => [a.id, a]));
  root.querySelectorAll("[data-cheat-action]").forEach((btn) => {
    const action = byId.get(btn.getAttribute("data-cheat-action"));
    if (!action || action.kind !== "toggle" || !action.slot) return;
    const on = held[action.slot] === action.id;
    btn.classList.toggle("is-held", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  root.querySelectorAll('.pm-cheat-byvalue-body input[data-cheat]').forEach((input) => {
    if (input === document.activeElement) return;
    const key = input.getAttribute("data-cheat");
    const value = api.get(`vitals.${key}`, null);
    if (value != null) input.value = String(value);
  });
}

/**
 * Dock the panel just right of Jamkachu, at the inner edge of the character
 * column — so a press and the Garden Vitals tile it moves sit side by side.
 * Parked on the far left, the presenter changed something here and the number
 * that answered was a whole screen away.
 *
 * Measured rather than a CSS constant because the character column is a grid
 * track that resizes with the window (see farmerGround for the same reasoning).
 * On a stage too narrow to hold the panel without covering the plant, this
 * leaves the stylesheet's left dock alone.
 */
const CHEAT_PANEL_POS_KEY = "plantmoji_cheat_panel_pos_v1";
/** Set once the presenter has dragged the panel (or a saved drag was
 *  restored). From then on the auto-dock below stops moving it — a window you
 *  placed by hand that jumps back on the next resize is not a window. */
let cheatPanelMoved = false;

/** Writes an absolute viewport position, clamped so no part of the panel can
 *  end up off-screen and out of reach. The stylesheet docks it with
 *  bottom+left, so `bottom` is released here: leaving it set would make the
 *  panel grow upward from wherever it was dropped instead of downward. */
function placeCheatPanel(panel, left, top) {
  const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
  panel.style.left = `${Math.round(Math.min(Math.max(0, left), maxLeft))}px`;
  panel.style.top = `${Math.round(Math.min(Math.max(0, top), maxTop))}px`;
  panel.style.bottom = "auto";
}

/** Drag the panel by its header. Pointer events (not mouse) so pen and touch
 *  work the same way, with capture on the handle so a fast drag that outruns
 *  the cursor does not drop the panel mid-move. */
function makeCheatPanelDraggable(panel) {
  const handle = panel.querySelector(".pm-cheat-head");
  if (!handle) return;

  try {
    const saved = JSON.parse(localStorage.getItem(CHEAT_PANEL_POS_KEY) || "null");
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      cheatPanelMoved = true;
      placeCheatPanel(panel, saved.left, saved.top);
    }
  } catch { /* unreadable storage just means the default dock */ }

  let startX = 0, startY = 0, originLeft = 0, originTop = 0, dragging = false;

  handle.addEventListener("pointerdown", (event) => {
    // The collapse button lives inside the handle and is not a drag surface.
    if (event.target.closest("button")) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = panel.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    startX = event.clientX;
    startY = event.clientY;
    dragging = true;
    // Pin the box to where it currently sits before the first move, so the
    // switch from bottom-anchored to top-anchored is invisible.
    placeCheatPanel(panel, originLeft, originTop);
    panel.classList.add("is-dragging");
    try { handle.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    placeCheatPanel(panel, originLeft + (event.clientX - startX), originTop + (event.clientY - startY));
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    cheatPanelMoved = true;
    panel.classList.remove("is-dragging");
    try { handle.releasePointerCapture(event.pointerId); } catch {}
    const rect = panel.getBoundingClientRect();
    try {
      localStorage.setItem(CHEAT_PANEL_POS_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    } catch { /* the position is a convenience, not state worth failing over */ }
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // A window narrowed after the drag could leave the panel outside the
  // viewport; re-clamping keeps its header reachable.
  window.addEventListener("resize", () => {
    if (!cheatPanelMoved) return;
    const rect = panel.getBoundingClientRect();
    placeCheatPanel(panel, rect.left, rect.top);
  });
}

function positionCheatPanel() {
  const panel = document.getElementById("pm-cheat-panel");
  const stage = $(".mascot-stage");
  if (!panel || !stage) return;
  // Hand placement wins over the automatic dock.
  if (cheatPanelMoved) return;
  const rect = stage.getBoundingClientRect();
  const width = panel.offsetWidth || 268;
  // Room for the panel plus the plant it must not sit on top of.
  if (rect.width < width + 250) {
    panel.style.removeProperty("left");
    return;
  }
  // Trial mode parks in the empty strip LEFT of the mascot column instead of
  // the presenter's right dock. Cheat mode's dock puts the panel over the
  // speech bubble and over Jamkachu, which a presenter simply drags away from;
  // a student will not, and in trial mode the bubble is where the whole game
  // is narrated. The mascot column is full top to bottom, so the strip beside
  // it is the only placement that covers neither. Falls back to the right dock
  // when the window is too narrow for the strip to exist.
  if (isTrialMode()) {
    const column = $(".mascot-container");
    // The strip runs from the SIDEBAR's edge, not the stage's: the stage is
    // inset from it, and the stylesheet's own default dock (left: 268px)
    // already parks in that margin. Both edges are measured rather than
    // assumed — the sidebar and the character column both resize with the
    // window — and the panel is centred in what is left, so neither gap ends
    // up a hairline.
    const sidebar = $(".sidebar");
    if (column && sidebar) {
      const stripLeft = Math.round(sidebar.getBoundingClientRect().right);
      const stripRight = Math.round(column.getBoundingClientRect().left);
      if (stripRight - stripLeft >= width + 24) {
        panel.style.left = `${Math.round(stripLeft + (stripRight - stripLeft - width) / 2)}px`;
        return;
      }
    }
  }
  panel.style.left = `${Math.round(rect.right - width - 12)}px`;
}

function buildCheatPanel() {
  if (document.getElementById("pm-cheat-panel")) return;
  const s = window.PMCheat && window.PMCheat.getState();
  if (!s) return;
  const L = CHEAT_LABELS[appLocale] || CHEAT_LABELS.en;
  // Trial mode gets the care buttons and nothing else: the status fields and
  // the by-value sensor boxes ARE cheat mode, and handing them to a student
  // before the gate would delete the game the gate exists to teach.
  if (isTrialMode()) {
    buildTrialPanel(s, L);
    return;
  }
  const panel = document.createElement("section");
  panel.id = "pm-cheat-panel";
  panel.setAttribute("aria-label", "Cheat controls");
  const field = (key, label, value, step, min, max) =>
    `<label class="pm-cheat-field"><span>${label}</span><input type="number" data-cheat="${key}" value="${value}" step="${step}"${min != null ? ` min="${min}"` : ""}${max != null ? ` max="${max}"` : ""}></label>`;
  /** Same row, with the min/max and the hover hint taken from the sensor's
   *  physical range instead of being repeated at the call site. */
  const vitalField = (key, label, value, step) => {
    const limit = CHEAT_VITAL_LIMITS[key];
    return `<label class="pm-cheat-field"><span>${label}</span><input type="number" data-cheat="${key}" value="${value}" step="${step}" min="${limit.min}" max="${limit.max}" title="${limit.min} – ${limit.max}"></label>`;
  };
  panel.innerHTML =
    // Collapse control: the panel is docked over the sky beside the mascot, but
    // a presenter on a short screen still needs a way to clear it off the
    // stage mid-demo without leaving the sandbox.
    `<header class="pm-cheat-head" title="${L.drag}"><strong>🎛️ ${L.panelTitle}<small>${L.drag}</small></strong>` +
    `<button type="button" data-cheat-collapse aria-expanded="true" aria-label="${L.collapse}" title="${L.collapse}">−</button></header>` +
    `<div class="pm-cheat-body">` +
    `<div class="pm-cheat-group"><h3>🎛️ ${L.statusTitle}</h3>` +
    `<div class="pm-cheat-level"><span>${L.level}</span><button type="button" data-cheat-level="-1">−</button><output data-cheat-out="level">${s.status.level}</output><button type="button" data-cheat-level="1">+</button></div>` +
    // XP mirrors the level row's shape — where that reads [−][value][+], this
    // reads [min][value][max], so the band the current level allows is visible
    // in the same place the buttons sit one row above.
    `<div class="pm-cheat-xp"><span>${L.xp}</span>` +
    `<output class="pm-cheat-bound" data-cheat-out="xpMin" title="${L.xpMin}" aria-label="${L.xpMin}"></output>` +
    `<input type="number" data-cheat="totalXp" value="${s.status.totalXp}" step="1">` +
    `<output class="pm-cheat-bound" data-cheat-out="xpMax" title="${L.xpMax}" aria-label="${L.xpMax}"></output></div>` +
    field("days", L.days, s.status.days, 1, 0) +
    field("seeds", L.seeds, s.status.seeds, 1, 0) +
    // The ceremony lost its only trigger when presentation mode was deleted
    // (5167133 removed demo.js, which bound hotkey E to PMFx.evolve). It sits
    // beside Level because the level row is what the ladder climbs, and it is
    // a button rather than a number because the ceremony is a performance:
    // pressing it walks one rung and plays that rung's theme.
    `<div class="pm-cheat-evolve"><span>${L.evolveTitle}</span>` +
    `<button type="button" data-cheat-evolve title="${L.evolveHint}">${L.evolveBtn}</button></div>` +
    `</div>` +
    // Care actions come before the raw numbers, because "put it in the sun" is
    // the lesson and 34 is just a number. cheat.js owns the list so this panel
    // and the Monitoring one can never drift apart.
    // The designer's watering can heads the physical-care list — misting,
    // rinsing, shading, venting. Deliberately NOT used anywhere that means
    // "the plant is thirsty": this game's whole point is that dry AIR is not
    // dry soil, and a watering can next to that lesson would undo it.
    `<div class="pm-cheat-group"><h3><img class="pm-cheat-heading-icon" src="/icons/watering-can.png" alt="" width="14" height="14"> ${L.actionsTitle}</h3>` +
    `<div class="pm-cheat-action-set"><h4>${L.heldTitle}</h4><div class="pm-cheat-actions">${cheatActionButtons("toggle")}</div></div>` +
    `<div class="pm-cheat-action-set"><h4>${L.oneShotTitle}</h4><div class="pm-cheat-actions">${cheatActionButtons("delta")}</div></div>` +
    `<p class="pm-cheat-hint">${L.slowNote}</p>` +
    `</div>` +
    `<p class="pm-cheat-hint">${L.hint}</p>` +
    // Exact figures still reachable, just folded away.
    `<div class="pm-cheat-byvalue">` +
    `<button type="button" data-cheat-byvalue aria-expanded="false">▸ ${L.byValue}</button>` +
    `<div class="pm-cheat-byvalue-body" hidden>` +
    // Ranges come from CHEAT_VITAL_LIMITS, never hand-typed here, so the
    // spinner, the tooltip and the clamp below can never disagree.
    vitalField("temperature", L.temp, s.vitals.temperature, 0.1) +
    vitalField("humidity", L.hum, s.vitals.humidity, 1) +
    vitalField("light", L.light, s.vitals.light, 1) +
    vitalField("soilPh", L.ph, s.vitals.soilPh, 0.1) +
    `</div></div>` +
    `</div>`;
  document.body.appendChild(panel);

  // Care actions: the store owns the physics, this only forwards the press and
  // repaints the held state (its own change event brings the new values back).
  panel.querySelectorAll("[data-cheat-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.PMCheat?.press(btn.getAttribute("data-cheat-action"));
      repaintCheatActions(panel);
    });
  });

  // Pure presentation: PMFx.evolve walks its own preview cursor and queues the
  // T5 sequence. It writes nothing — not to the sandbox, not to Supabase — so
  // the real ladder position is whatever the next data render says it is.
  panel.querySelector("[data-cheat-evolve]")?.addEventListener("click", () => {
    window.PMFx?.evolve();
  });

  const byValueBtn = panel.querySelector("[data-cheat-byvalue]");
  const byValueBody = panel.querySelector(".pm-cheat-byvalue-body");
  byValueBtn?.addEventListener("click", () => {
    const open = byValueBody.hasAttribute("hidden");
    if (open) byValueBody.removeAttribute("hidden");
    else byValueBody.setAttribute("hidden", "");
    byValueBtn.setAttribute("aria-expanded", open ? "true" : "false");
    const L2 = CHEAT_LABELS[appLocale] || CHEAT_LABELS.en;
    byValueBtn.textContent = `${open ? "▾" : "▸"} ${L2.byValue}`;
  });

  makeCheatPanelDraggable(panel);

  const collapseBtn = panel.querySelector("[data-cheat-collapse]");
  collapseBtn?.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("is-collapsed");
    collapseBtn.textContent = collapsed ? "+" : "−";
    collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const label = collapsed ? L.expand : L.collapse;
    collapseBtn.setAttribute("aria-label", label);
    collapseBtn.setAttribute("title", label);
    positionCheatPanel(); // collapsing changes the width it docks by
  });

  const xpInput = panel.querySelector('input[data-cheat="totalXp"]');
  const xpMinOut = panel.querySelector('[data-cheat-out="xpMin"]');
  const xpMaxOut = panel.querySelector('[data-cheat-out="xpMax"]');

  /** Point the XP field at the band `level` owns and pull `xp` inside it.
   *  Repaints the two bound readouts and the input's own min/max (so the
   *  spinner and browser validation agree with what is shown). */
  function retuneXpToLevel(level, xp) {
    const { min, max } = cheatXpBounds(level);
    const clamped = Math.min(max, Math.max(min, Math.round(Number(xp)) || 0));
    if (xpMinOut) xpMinOut.textContent = String(min);
    if (xpMaxOut) xpMaxOut.textContent = String(max);
    if (xpInput) {
      xpInput.min = String(min);
      xpInput.max = String(max);
    }
    return clamped;
  }

  const clampXp = (xp) => retuneXpToLevel(Number(window.PMCheat.get("status.level", 1)) || 1, xp);

  // Paint the initial band, and pull a seeded XP inside it (activation clones
  // real progress, which is already consistent, but the store is editable).
  const seededXp = clampXp(s.status.totalXp);
  if (xpInput) xpInput.value = String(seededXp);
  if (seededXp !== s.status.totalXp) window.PMCheat.set({ status: { totalXp: seededXp } });

  const STATUS_KEYS = { totalXp: 1, days: 1, seeds: 1 };
  panel.querySelectorAll("input[data-cheat]").forEach((input) => {
    const key = input.getAttribute("data-cheat");
    input.addEventListener("input", () => {
      const num = Number(input.value);
      if (!Number.isFinite(num)) return;
      if (key === "totalXp") {
        // Clamp what the sandbox stores, but leave the half-typed text alone:
        // rewriting the field on every keystroke makes 105 unreachable at
        // Lv.4, whose band starts at 90 — the first "1" would snap to it.
        window.PMCheat.set({ status: { totalXp: clampXp(num) } });
      } else if (key in STATUS_KEYS) {
        window.PMCheat.set({ status: { [key]: num } });
      } else {
        // Sensors are held to the range real hardware readings are validated
        // against — 200% humidity or pH 20 is not a demo value, it's nonsense
        // on screen. Same non-destructive clamp as the XP field above.
        const limit = CHEAT_VITAL_LIMITS[key];
        const value = limit ? Math.min(limit.max, Math.max(limit.min, num)) : num;
        window.PMCheat.set({ vitals: { [key]: value } });
      }
      applyCheatFarm();
    });
    if (key === "totalXp") {
      // Editing done (blur / Enter / spinner): settle the field onto the value
      // the sandbox actually holds, so an out-of-band entry visibly corrects.
      input.addEventListener("change", () => {
        input.value = String(Number(window.PMCheat.get("status.totalXp", 0)) || 0);
      });
    } else if (CHEAT_VITAL_LIMITS[key]) {
      input.addEventListener("change", () => {
        input.value = String(window.PMCheat.get(`vitals.${key}`, 0));
      });
    }
  });
  panel.querySelectorAll("button[data-cheat-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.getAttribute("data-cheat-level")) || 0;
      const cur = Number(window.PMCheat.get("status.level", 1)) || 1;
      // Clamped at both ends: the sandbox must not show a level the real game
      // cannot reach, or a presenter steps past the cap on stage and the
      // sprite runs out of bands.
      const next = Math.min(MAX_BOND_LEVEL, Math.max(1, cur + delta));
      // The level owns the band, so stepping it carries XP along at the SAME
      // progress within the level — Lv.2 at 12/30 becomes Lv.3 at 12/30, not a
      // snap back to the floor that would undo the bar mid-demo.
      const within = (Number(window.PMCheat.get("status.totalXp", 0)) || 0) % XP_PER_LEVEL;
      const nextXp = retuneXpToLevel(next, cheatXpBounds(next).min + Math.max(0, within));
      window.PMCheat.set({ status: { level: next, totalXp: nextXp } });
      if (xpInput) xpInput.value = String(nextXp);
      const out = panel.querySelector('[data-cheat-out="level"]');
      if (out) out.textContent = String(next);
      applyCheatFarm();
    });
  });
}

/**
 * The trial-mode care panel: the same buttons the presenter sandbox uses,
 * rendered from cheat.js's single ACTIONS list, with every number-editing
 * control removed.
 *
 * Same id and same chrome as the cheat panel on purpose — the docking, drag,
 * collapse and repaint code all key off `#pm-cheat-panel`, and a student who
 * later unlocks cheat mode should find the controls where they already were.
 */
function buildTrialPanel(s, L) {
  const T = TRIAL_LABELS[appLocale] || TRIAL_LABELS.en;
  const panel = document.createElement("section");
  panel.id = "pm-cheat-panel";
  panel.dataset.mode = "trial";
  panel.setAttribute("aria-label", T.panelTitle);
  panel.innerHTML =
    `<header class="pm-cheat-head"><strong>🎮 ${T.panelTitle}</strong>` +
    `<button type="button" data-cheat-collapse aria-expanded="true" aria-label="${L.collapse}" title="${L.collapse}">−</button></header>` +
    `<div class="pm-cheat-body">` +
    `<div class="pm-cheat-group"><h3><img class="pm-cheat-heading-icon" src="/icons/watering-can.png" alt="" width="14" height="14"> ${L.actionsTitle}</h3>` +
    `<div class="pm-cheat-actions">${cheatActionButtons("toggle")}</div>` +
    `<div class="pm-cheat-actions">${cheatActionButtons("delta")}</div>` +
    // The cheat panel's slowNote paragraph is dropped here: the "⏳ days later"
    // badge is on the buttons it describes, and in trial mode pressing one
    // visibly skips three days, which teaches it harder than a sentence. Every
    // line removed is height, and height is what pushes this panel up into the
    // speech bubble the whole game is narrated in.
    `</div>` +
    `<p class="pm-cheat-hint">${T.hint}</p>` +
    `</div>`;
  document.body.appendChild(panel);

  panel.querySelectorAll("[data-cheat-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.PMCheat?.press(btn.getAttribute("data-cheat-action"));
      repaintCheatActions(panel);
    });
  });

  makeCheatPanelDraggable(panel);

  const collapseBtn = panel.querySelector("[data-cheat-collapse]");
  collapseBtn?.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("is-collapsed");
    collapseBtn.textContent = collapsed ? "+" : "−";
    collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const label = collapsed ? L.expand : L.collapse;
    collapseBtn.setAttribute("aria-label", label);
    collapseBtn.setAttribute("title", label);
    positionCheatPanel();
  });
}

const TRIAL_LABELS = {
  id: {
    panelTitle: "RAWAT JAMKACHU",
    hint: "Tekan tombol perawatan → Jamkachu bereaksi. Ini kebun latihan; data asli tidak berubah.",
    // Used only by the catch-up path, when the gate was crossed on another
    // route and its event carried its text away with it. Takes the level from
    // the engine rather than repeating it, so moving the gate cannot leave
    // this line quietly announcing the old one.
    gate: (level) => `Lv.${level} tercapai — Mode Curang terbuka! 🎉`,
  },
  en: {
    panelTitle: "CARE FOR JAMKACHU",
    hint: "Press a care button → Jamkachu reacts. This is a practice garden; real data stays untouched.",
    gate: (level) => `Lv.${level} reached — Cheat Mode is open! 🎉`,
  },
};

function initCheatFarm() {
  buildCheatPanel();
  positionCheatPanel();
  // The character column is a grid track, so its right edge moves with the
  // window; re-dock on resize rather than freezing a first-paint measurement.
  window.addEventListener("resize", positionCheatPanel);
  // Apply now and again after the hatch reveal so the mascot exists.
  applyCheatFarm();
  setTimeout(applyCheatFarm, 400);
  setTimeout(applyCheatFarm, 1600);
  if (window.PMCheat) window.PMCheat.onChange(applyCheatFarm);
  if (isTrialMode()) initTrialFarm();
}

// ── Trial mode presentation (public/farm/trial.js drives the rules) ──────
// The engine never touches the DOM; it announces what happened and this half
// decides how Jamkachu says it. Everything below is display only.

/** Until this timestamp, the speech bubble belongs to a trial notice and the
 *  ordinary mood line must not overwrite it (see applyCheatFarm). */
let trialNoticeUntil = 0;

function isTrialMode() {
  return !!(window.PMCheat && window.PMCheat.isActive() && window.PMCheat.getMode?.() === "trial");
}

/** Timer that returns the bubble and the mood cloud after a notice has had
 *  its moment, plus the line the notice interrupted. */
let trialCloudTimer = null;
let trialBubbleBefore = null;

/** Put one line in Jamkachu's bubble and hold it there for `holdMs`.
 *
 *  The mood thought-cloud is parked for the duration. It floats over the
 *  bubble's right end, and these lines are the longest the bubble ever shows —
 *  "3 days passed… Today is Day 6!" ran straight underneath it and lost its
 *  own ending. Hiding the cloud costs nothing: the notice says what happened,
 *  Jamkachu's face still carries the mood, and the cloud is back in a few
 *  seconds. */
function trialSay(text, holdMs, tone) {
  const bubble = $(".speech-bubble");
  if (!bubble) return;
  const hold = Math.max(0, Number(holdMs) || 0);
  // Remember what the bubble said, but only on the FIRST notice of a run of
  // them — otherwise notice #2 would "restore" notice #1 and the line would
  // stick forever.
  if (trialCloudTimer === null) trialBubbleBefore = bubble.innerHTML;
  trialNoticeUntil = Date.now() + hold;
  bubble.innerHTML = `<span class="pm-trial-line${tone ? ` is-${tone}` : ""}">${text}</span>`;
  document.body.setAttribute("data-trial-notice", "on");
  if (trialCloudTimer) clearTimeout(trialCloudTimer);
  trialCloudTimer = setTimeout(() => {
    document.body.removeAttribute("data-trial-notice");
    trialCloudTimer = null;
    // Put the interrupted line back explicitly rather than leaning on
    // applyCheatFarm: at night sleepShown owns the bubble and that repaint
    // skips it entirely, which left the notice on screen for good — clipped by
    // the mood cloud the moment it came back.
    if (trialBubbleBefore != null) bubble.innerHTML = trialBubbleBefore;
    trialBubbleBefore = null;
    applyCheatFarm();
  }, hold);
}

/** Name the buttons that would fix the current hazard. The engine sends action
 *  ids; the labels come from cheat.js's single ACTIONS list so the hint can
 *  never name a button that is not on screen. */
function trialHintText(lead, actionIds) {
  const all = window.PMCheat?.ACTIONS ?? [];
  // One button, not a menu. The bubble is narrow, a stuck student needs a
  // single thing to do, and the second-best answer is still on the panel for
  // them to find on their own.
  const action = (actionIds ?? []).map((id) => all.find((a) => a.id === id)).find(Boolean);
  if (!action) return lead;
  return `${lead} ${action.emoji} ${appLocale === "id" ? action.id_label : action.en_label}`;
}

function initTrialFarm() {
  window.addEventListener("pmtrial:hazard", (e) => {
    const d = e.detail ?? {};
    trialSay(d.text ?? "", d.holdMs, "hazard");
    // The readings just jumped; repaint immediately rather than waiting for
    // the next change event so the face and the numbers move together.
    applyCheatFarm();
    window.PMSfx?.play("error"); // the one "something is wrong" cue in the kit
  });

  window.addEventListener("pmtrial:hint", (e) => {
    const d = e.detail ?? {};
    trialSay(trialHintText(d.lead ?? "", d.actions), d.holdMs, "hint");
  });

  window.addEventListener("pmtrial:resolved", (e) => {
    const d = e.detail ?? {};
    trialSay(d.text ?? "", d.holdMs, "good");
    window.PMSfx?.play("bonus");
  });

  window.addEventListener("pmtrial:day", (e) => {
    const d = e.detail ?? {};
    // The day line is the loudest thing the bubble ever says: without it the
    // calendar is a digit in a corner and no one notices time passing at all.
    trialSay(d.text ?? "", d.holdMs, "day");
    flashDayChange();
    window.PMSfx?.play("whoosh");
  });

  window.addEventListener("pmtrial:gate", (e) => {
    const d = e.detail ?? {};
    showTrialGate(d.text ?? "");
    window.PMSfx?.play("chapter"); // the kit's biggest moment, for its biggest moment
  });

  // The engine runs on every route, but only this page can draw the card — so
  // a gate crossed while the student was reading Collection or Shop would fire
  // its event into nothing and the run would lose the moment it was built
  // toward, along with the button that opens cheat mode. Catch it on arrival.
  const trialLabels = TRIAL_LABELS[appLocale] || TRIAL_LABELS.en;
  if (window.PMCheat?.get("trial.gateReached") && !window.PMCheat?.get("trial.gateSeen")) {
    showTrialGate(trialLabels.gate(window.PMTrial?.GATE_LEVEL ?? ""));
    window.PMSfx?.play("chapter");
  }
}

/** A quick wash of light across the whole farm when the in-game day turns, so
 *  the change is felt and not only read. Skipped under reduced motion, where
 *  the bubble line alone carries the news. */
function flashDayChange() {
  if (!document.body) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const flash = document.createElement("div");
  flash.className = "pm-trial-dayflash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1200);
}

/**
 * The gate card: the peak of the whole trial run.
 *
 * Two ways out, because both are legitimate: keep playing, or take the cheat
 * wheel. (See TRIAL_GATE_LEVEL for why Lv.6, and for the sprite-band redraw
 * that has since decoupled the gate from a growth change.)
 */
function showTrialGate(text) {
  if (document.getElementById("pm-trial-gate")) return;
  // Mark it seen the moment it is actually drawn, so the deferred catch-up in
  // initTrialFarm shows it once and never greets the student with it again.
  window.PMCheat?.set({ trial: { gateSeen: true } });
  const id = appLocale === "id";
  const card = document.createElement("div");
  card.id = "pm-trial-gate";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-live", "polite");
  card.innerHTML =
    `<div class="pm-trial-gate-card">` +
    `<strong>${text}</strong>` +
    `<p>${id
      ? "Kamu sudah paham cara merawat Jamkachu. Sekarang semua kendali terbuka."
      : "You know how to care for Jamkachu now. Every control is open to you."}</p>` +
    `<div class="pm-trial-gate-actions">` +
    `<button type="button" data-trial-gate="stay">${id ? "🌱 Lanjut merawat" : "🌱 Keep growing"}</button>` +
    `<button type="button" data-trial-gate="cheat">${id ? "🎛️ Buka Mode Curang" : "🎛️ Open Cheat Mode"}</button>` +
    `</div></div>`;
  document.body.appendChild(card);
  card.querySelector('[data-trial-gate="stay"]')?.addEventListener("click", () => card.remove());
  card.querySelector('[data-trial-gate="cheat"]')?.addEventListener("click", () => {
    window.PMTrial?.switchToCheat();
    // Full reload, same reasoning as the settings toggle: main() reads the
    // mode once at bootstrap, so a client-side repaint would leave the panel
    // still wearing its trial face.
    try { window.location.reload(); } catch {}
  });
}

// Boot-resilience timeouts (flaky school networks stall instead of cleanly
// failing, which a plain fetch/await never notices): every network call
// this module makes on the critical boot path gets a hard cap so a stall
// can never hang main() forever and leave renderOfflineHome() unreached.
// Hard cap for the config fetch itself, plus short backoff delays for up to
// two retries — a network STALL (never resolves, never rejects) is what
// actually strands main() forever on flaky Wi-Fi; a clean fetch failure was
// already caught below.
const CONFIG_FETCH_TIMEOUT_MS = 6_000;
const CONFIG_RETRY_DELAYS_MS = [750, 1_500];
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

/** Every request the Supabase client issues (queries + realtime handshakes)
 *  routes through this so a stalled request against the project's origin
 *  rejects instead of hanging, same rationale as CONFIG_FETCH_TIMEOUT_MS
 *  above. Shared by both createClient call sites in loadSupabaseClient
 *  (defined earlier in this file — referenced here only at call time,
 *  after main() has run this whole module top to bottom). */
const supabaseClientOptions = {
  global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) }),
  },
};
// How long to wait before the ONE retry of a stalled/thrown first refresh()
// inside main() (below) — separate from the 15s poll's in-flight guard.
const FIRST_REFRESH_RETRY_DELAY_MS = 2_000;
// visibilitychange catch-up (below): only worth an extra refresh if the
// last successful one is older than this — avoids a redundant refresh on
// every tab-switch when the 15s poll is already current.
const VISIBILITY_STALE_REFRESH_MS = 20_000;

/** Rejects with a timeout error if `promise` doesn't settle within `ms`.
 *  Used for the <head> preconnect script's already-in-flight config fetch
 *  (window.__pmConfigPromise), which was started with a plain fetch() and
 *  so has no AbortSignal to cancel directly — racing it here still keeps it
 *  inside the same boot budget every other attempt respects. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Fetch /api/public-config with a hard timeout and up to two short-backoff
 *  retries (750ms, 1500ms). The first attempt reuses the index.html <head>
 *  script's already-in-flight request (window.__pmConfigPromise) when
 *  present — the whole point of starting that fetch before ~341KB of
 *  classic scripts even parse — racing it against the same timeout; every
 *  other attempt fetches directly with an AbortSignal. */
async function fetchPublicConfig() {
  let lastError;
  for (let attempt = 0; attempt < 1 + CONFIG_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG_RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const response =
        attempt === 0 && window.__pmConfigPromise
          ? await withTimeout(window.__pmConfigPromise, CONFIG_FETCH_TIMEOUT_MS)
          : await fetch("/api/public-config", { signal: AbortSignal.timeout(CONFIG_FETCH_TIMEOUT_MS) });
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  refreshWeather();
  setInterval(refreshWeather, 30 * 60_000);
  // Classroom cheat sandbox: skip ALL Supabase reads/writes + realtime so
  // nothing touches real data or hardware; the sandbox drives the screen.
  if (window.PMCheat && window.PMCheat.isActive()) {
    window.__pmSupabaseConfigured = false;
    refreshCropProfile();
    scheduleHatch(null);
    initCheatFarm();
    return;
  }
  let config;
  try {
    config = await fetchPublicConfig();
  } catch {
    window.__pmSupabaseConfigured = false; // demo.js QA overlay reads this
    renderOfflineHome(); // no dev "--" leaks while offline
    scheduleHatch(null); // hatching still runs offline (default character)
    return;
  }
  if (!config?.url || !config?.key) {
    window.__pmSupabaseConfigured = false; // demo.js QA overlay reads this
    renderOfflineHome(); // no dev "--" leaks while offline
    scheduleHatch(null); // hatching still runs offline (default character)
    return;
  }

  const supabase = await loadSupabaseClient(config.url, config.key);
  if (!supabase) {
    // Vendored bundle missing AND the CDN fallback failed: same graceful
    // offline path as an unreachable/misconfigured backend — the page still
    // renders its defaults and the hatching intro still runs.
    window.__pmSupabaseConfigured = false; // demo.js QA overlay reads this
    renderOfflineHome(); // no dev "--" leaks while offline
    scheduleHatch(null); // hatching still runs offline (default character)
    return;
  }
  window.__pmSupabaseConfigured = true;

  let plantName = null;
  // In-flight guard (15s poll + realtime reconnect + visibility catch-up all
  // call the SAME refresh()): a flaky network can make one refresh overrun
  // its own 15s cadence, and without this a slow tick and the next timer
  // fire would race each other against the DOM. Also doubles as the "last
  // successful refresh" clock the visibilitychange catch-up below reads.
  let refreshInFlight = false;
  let lastRefreshAt = 0;
  // First SUBSCRIBED after page load is the normal boot handshake (the
  // initial refresh() below already painted); only a LATER SUBSCRIBED —
  // i.e. a reconnect after a drop — should trigger the gap-closing refresh.
  let realtimeEverSubscribed = false;

  const refresh = async () => {
    if (refreshInFlight) return; // skip this tick — the previous refresh hasn't settled yet
    refreshInFlight = true;
    try {
      await runRefresh();
      lastRefreshAt = Date.now();
    } finally {
      refreshInFlight = false;
    }
  };

  const runRefresh = async () => {
    // Crop-profile ranges (sensor HUD stat tiles): fire-and-forget, cached
    // in `cropProfile`, refreshed on this SAME 15s poll cadence as the
    // sensor reading below — never awaited, so a slow/failed fetch can
    // never delay the rest of the render.
    refreshCropProfile();
    const [plantRes, bondRes, sensorRes, questRes, eventsRes, companionRes, shopRes] = await Promise.all([
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
      // Jamkachu memories (spec §6.5): recent reward history for the idle
      // bubble templates. Failure (missing table, RLS, network) is silently
      // tolerated — the extra catch keeps Promise.all alive.
      supabase
        .from("bond_events")
        .select("type, data, occurred_at")
        .eq("plant_id", PLANT_ID)
        .in("type", ["XP_AWARDED", "LEVEL_UP"])
        .order("occurred_at", { ascending: false })
        .limit(6)
        .then((res) => res)
        .catch(() => ({ data: null })),
      // Companion state incl. milestone16 progress counters (+ cycle for the
      // ceremony's once-per-stage key) and the milestone20 cosmetic skin_key.
      // Enumerated unknown columns reject via PostgREST, so the chain steps
      // down one migration at a time: full (m20 skin) → counters-only (m16,
      // skin_key absent → jamkachu) → the legacy three-column select — old
      // databases keep rendering (the progress line just hides). skin_key is
      // therefore only ever requested in the tolerant first step.
      supabase
        .from("companion_state")
        .select("stage, form_key, cycle, updated_at, care_count, affinity_count, day_count, skin_key")
        .eq("plant_id", PLANT_ID)
        .maybeSingle()
        .then((res) =>
          res?.error
            ? supabase
                .from("companion_state")
                .select("stage, form_key, cycle, updated_at, care_count, affinity_count, day_count")
                .eq("plant_id", PLANT_ID)
                .maybeSingle()
                .then((m16) =>
                  m16?.error
                    ? supabase
                        .from("companion_state")
                        .select("stage, form_key, updated_at")
                        .eq("plant_id", PLANT_ID)
                        .maybeSingle()
                        .then((legacy) => (legacy?.error ? { data: null } : legacy))
                        .catch(() => ({ data: null }))
                    : m16,
                )
                .catch(() => ({ data: null }))
            : res,
        )
        .catch(() => ({ data: null })),
      // Shop purchases (milestone18): failure-tolerant like companionRes —
      // a missing milestone18 migration must never break the page.
      supabase.from("shop_purchases").select("item_key, category, equipped").eq("plant_id", PLANT_ID).then((res) => res).catch(() => ({ data: null })),
    ]);
    if (bondRes.data) renderBond(bondRes.data, plantName ?? plantRes.data?.name);
    if (plantRes.data) {
      plantName = plantRes.data.name;
      renderPlant(plantRes.data);
    }
    if (sensorRes.data) renderSensors(sensorRes.data);
    // Configured DB, zero rows (maybeSingle: data null, error null) — say
    // honestly that the sensors haven't sent anything yet. Query errors
    // keep the previous display instead of a misleading "waiting".
    else if (!sensorRes.error) renderSensorsWaiting();
    if (questRes.data) trackQuests(questRes.data);
    if (Array.isArray(eventsRes?.data)) noteMemoryRows(eventsRes.data);
    if (companionRes?.data) renderCompanion(companionRes.data);
    if (Array.isArray(shopRes?.data)) renderShopPurchases(shopRes.data);
    maybeShowMemory(); // hour-gated; only into an idle Happy bubble
  };

  try {
    await refresh();
  } catch {
    // The first refresh stalled/threw outright (not a normal per-query
    // error — those resolve into {error} fields and never reach here): most
    // classroom Wi-Fi drops are a transient blip, so give it ONE retry after
    // a short delay before letting main().catch fall back to the offline
    // defaults.
    await new Promise((resolve) => setTimeout(resolve, FIRST_REFRESH_RETRY_DELAY_MS));
    await refresh();
  }
  firstOnlinePaint = true; // real data is on screen — the catch may not stomp it
  // Hatching intro (spec §6.3): once, after the first real render settles.
  scheduleHatch(plantName);

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
      { event: "UPDATE", schema: "public", table: "companion_state", filter: `plant_id=eq.${PLANT_ID}` },
      (payload) => renderCompanion(payload.new),
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
    .subscribe((status) => {
      // Reconnecting after a drop (CHANNEL_ERROR/TIMED_OUT/CLOSED →
      // SUBSCRIBED again) can leave a gap the postgres_changes payloads
      // missed while disconnected — one refresh closes it. The FIRST
      // SUBSCRIBED (page boot) is not a reconnect: the initial refresh()
      // above already painted, so realtimeEverSubscribed skips it.
      if (status === "SUBSCRIBED") {
        if (realtimeEverSubscribed) refresh();
        realtimeEverSubscribed = true;
      }
    });

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

  // Live sensor readings (milestone21). Its own channel for the same reason
  // as the two below: until that migration runs, sensor_readings is not in the
  // supabase_realtime publication and the join errors — isolating it means the
  // page falls back to the 15s poll instead of losing plants/bond/quests too.
  //
  // The poll stays exactly as it was. It is the safety net: a dropped socket,
  // a project without the migration, or a reading that arrives while the tab
  // is hidden all still land within 15s. This only removes the wait when the
  // socket is healthy.
  try {
    supabase
      .channel(`farm-sensors-${PLANT_ID}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings", filter: `plant_id=eq.${PLANT_ID}` },
        (payload) => {
          // The sandbox owns the tiles while it is on; a real reading arriving
          // underneath must not overwrite the numbers being demonstrated.
          if (window.PMCheat?.isActive()) return;
          renderSensors(payload.new);
        },
      )
      .subscribe();
  } catch {
    // No live push — the 15s poll already covers this.
  }

  // Live Guardian fan-out is isolated because milestone19 is optional. A
  // missing table/realtime publication never affects plants or quests.
  try {
    supabase
      .channel(`farm-camera-${PLANT_ID}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "camera_events", filter: `plant_id=eq.${PLANT_ID}` },
        (payload) => onCameraEventInsert(payload.new),
      )
      .subscribe();
  } catch {
    // The camera device still reacts locally when persistence is unavailable.
  }

  // Shop purchases realtime (milestone18) — isolated channel, same rationale
  // as farm-events above: until the migration runs, this join errors and
  // must never touch the main channel. Any change re-fetches the full row
  // set (equip exclusivity is cross-row, so a single payload is not enough).
  try {
    supabase
      .channel(`farm-shop-${PLANT_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_purchases", filter: `plant_id=eq.${PLANT_ID}` },
        () => {
          supabase
            .from("shop_purchases")
            .select("item_key, category, equipped")
            .eq("plant_id", PLANT_ID)
            .then((res) => {
              if (Array.isArray(res.data)) renderShopPurchases(res.data);
            });
        },
      )
      .subscribe();
  } catch {
    // Purchases still land via the 15s refresh poll — never block the page.
  }

  // Polling fallback + sensor refresh (sensor_readings has no realtime).
  setInterval(refresh, 15_000);

  // Coming back to a backgrounded tab: if the last successful refresh is
  // stale enough that the 15s poll clearly missed ticks while hidden (a
  // throttled/suspended background tab, or a network drop during that
  // time), catch up immediately instead of waiting up to another 15s.
  // refresh()'s own in-flight guard still applies — this can never overlap
  // a poll that is already running.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastRefreshAt > VISIBILITY_STALE_REFRESH_MS) {
      refresh();
    }
  });

  // Lazy game tick so time-window quests complete while parked on this page.
  setInterval(() => {
    fetch("/api/game-tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: PLANT_ID }),
    }).catch(() => {});
  }, 60_000);
}

// Defense in depth: even with the layered fallbacks inside main() itself,
// no unhandled rejection here can ever strand the page mid-load — any
// escaped error still falls back to the same offline path (defaults render,
// hatching still runs) and gets logged instead of silently hanging.
// Safe here and nowhere earlier: every const applyNightUi reads now exists.
initFarmAppearance();

main().catch((error) => {
  // Real data already painted → only log; repainting offline defaults here
  // would mask a live distressed plant with a fabricated Happy home.
  if (firstOnlinePaint) {
    console.error("farm init failed after first paint:", error);
    return;
  }
  console.error("PlantMoji farm page failed to initialize", error);
  window.__pmSupabaseConfigured = false; // demo.js QA overlay reads this
  renderOfflineHome(); // same presentable defaults as every early-return path
  scheduleHatch(null); // hatching still runs offline (default character)
});
