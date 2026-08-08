// PlantMoji central UI string table (dopamine-UX plan, Task 4).
//
// Plain synchronous script — NOT a module — so it can be loaded with a bare
// <script src="/farm/strings.js"> tag BEFORE live.js (and on React pages via
// the shared layout). It only assigns window.PM_STRINGS; consumers must read
// it defensively (`window.PM_STRINGS || {}`) so a missing tag never breaks a
// page. All copy is English (D7); this table is the future localization seam.
//
// Ethics note (spec §4): nothing in here promises XP for taps. Ritual and
// petting copy explicitly points students at REAL care.

window.PM_STRINGS = {
  // Mood words shown under the character name (#char-mood). Keys match the
  // backend plant state names; values are the human words from spec §2.1.
  moods: {
    Happy: "Happy",
    Overheating: "Overheating",
    DryAir: "Dry Air",
    Sleepy: "Sleepy",
    SoilAcidic: "Acidic",
    SoilAlkaline: "Alkaline",
  },

  // Emoji companions for the mood words (spec §2.1: 😊🥵😵😴🤢😖).
  moodEmoji: {
    Happy: "😊",
    Overheating: "🥵",
    DryAir: "😵",
    Sleepy: "😴",
    SoilAcidic: "🤢",
    SoilAlkaline: "😖",
  },

  // Reason-chip labels (Task 14): bond_events reason prefix → friendly label.
  reasons: {
    quest: "Quest complete",
    lucky: "Lucky ×2!",
    badge: "New badge",
    chapter: "Story unlocked",
    streak: "Streak bonus",
    mood: "New mood found",
    daily: "Daily challenge",
    growth: "Diary entry",
  },

  // Why-card chips for the care ritual buttons (Task 8). Zero XP — the copy
  // must always end by pointing at real, sensor-verified care.
  ritual: {
    water: "That splash is just for fun — go water the real plant! Real care = real XP. The sensors will notice.",
    fertilize: "Sparkles are free — real nutrients feed the real soil! Real care = real XP. The sensors will notice.",
  },

  // Streak keeper copy (Task 15). Warm, daytime-only, never guilt or
  // countdowns (spec §4.3).
  streakKeeper: {
    active: (d) => `🔥 ${d} days going — Jamkachu would love a visit today.`,
    broken: "Every streak starts at day one. Welcome back!",
    flame: (d) => `${d} days in a row! Care today makes ${d + 1}.`,
  },

  // Honest odds disclosure for the Lucky Sprout bonus (spec §3 / D2).
  luckyOdds: "1 in 8 quests sprouts a lucky bonus!",

  // Rotating personality lines for petting the mascot (Task 8). Five lines,
  // cycled in order; no counters, no achievements, zero XP.
  petting: [
    "Hehe, that tickles!",
    "Jamkachu likes hanging out with you!",
    "Your hands are so warm!",
    "More pets, please!",
    "Growing up strong, thanks to you!",
  ],

  // Satiation line: every 5th pet within 30s (in-fiction cooldown, Task 8).
  pettingYawn: "So cozy… Jamkachu needs a tiny nap now. Zzz…",

  // Threshold-true vital comments (Task 19). Boundaries mirror the mood
  // engine so a comment can never contradict the current mood:
  //   temp: > 32 hot · 18–28 good
  //   humidity: < 40 dry · >= 40 good
  //   light: 0 dark · 1 good (bright)
  //   soil pH: 6.0–7.0 good · outside that band = off
  vitals: {
    tempHot: "Phew, vent please!",
    tempGood: "Perfect temperature!",
    humDry: "Air feels dry",
    humGood: "The air feels lovely!",
    lightDark: "Pretty dark here",
    lightGood: "Sunbathing time!",
    phGood: "Soil feels great",
    phOff: "My soil tastes funny — mind checking the pH?",
  },

  // Causal-echo chips for real sensor diffs (Task 11).
  echo: {
    humidityUp: (d) => `Air +${d}% — Jamkachu breathes easy!`,
    tempComfy: "Nice and cool again",
    lightOn: "Sunshine!",
    verifying: "Sensor saw your care — verifying…",
  },

  // Verifying-shimmer quest slot label (Task 12).
  verifying: {
    checking: "Sensor is checking…",
  },

  // Existing live.js FX copy, centralized here per Task 4 ("move them in").
  // live.js keeps hardcoded fallbacks behind `|| {}` guards.
  fx: {
    levelUpTitle: "LEVEL UP!",
    levelUpSub: (level) => `Bond Lv.${level} — your care is paying off`,
    questComplete: "🏆 Quest complete!",
    xpGain: (delta) => `+${delta} XP`,
    streakUp: (days) => (days === 1 ? "+1 day" : `+${days} days`),
  },

  // Banner tag shown while presenter/demo mode is active (Task 21) and on
  // the offline static fallback (spec §3 offline row).
  demoTag: "DEMO",
};
