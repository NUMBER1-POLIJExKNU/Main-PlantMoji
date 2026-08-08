// PlantMoji central UI string table (dopamine-UX plan, Task 4) — now
// locale-aware (en + Bahasa Indonesia).
//
// Plain synchronous script — NOT a module — so it can be loaded with a bare
// <script src="/farm/strings.js"> tag BEFORE live.js (and on React pages via
// the shared layout). It only assigns window.PM_STRINGS — already resolved to
// ONE locale's flat table, so the consumed shape is unchanged. Consumers must
// read it defensively (`window.PM_STRINGS || {}`) so a missing tag never
// breaks a page.
//
// Locale detection mirrors live.js initialLocale(): cookie "plantmoji_locale"
// first, then localStorage, defaulting to "id" whenever browser storage is
// readable (the farm page's product default). Only pure-stub environments
// with neither document nor localStorage (unit tests, odd embeds) fall back
// to "en" so the English contract assertions stay meaningful.
//
// Ethics note (spec §4): nothing in here promises XP for taps. Ritual and
// petting copy explicitly points students at REAL care, in both locales.
// "JAMKACHU" and "PLANT MOJI" are proper nouns and are never translated;
// demoTag stays "DEMO" everywhere.

(function () {
  const STRINGS = {
    en: {
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

      // Contextual care button (spec §6.1): ONE mood-driven safe action.
      // Both soil moods share the "Soil" entry (adults-only pH help). Every
      // why-card names the sensor that will verify the care — guidance is
      // honest, physical, and never watering imagery (no soil-moisture
      // sensor exists). Zero XP, like every tap.
      care: {
        Overheating: {
          label: "Move me to shade 🌳",
          why: "Find a cooler, shadier spot. The temperature sensor will feel the difference.",
        },
        DryAir: {
          label: "Move me away from drafts 🌬️",
          why: "Fans and AC dry my air. The humidity sensor will notice when it's cozier.",
        },
        Sleepy: {
          label: "Show me some light ☀️",
          why: "Open the curtains or move me near a window. The light sensor will see it.",
        },
        Soil: {
          label: "Check my soil with a teacher 🧑‍🏫",
          why: "Soil pH needs an adult's help. Never add anything to the pot by yourself.",
        },
        Happy: {
          label: "Pet me — or write my diary 📖",
          why: "I'm feeling great! Want to remember today? Write a line in my Growth Diary.",
        },
      },

      // Night sleep mode (spec §6.2): 18:00–06:00 WIB while the mood is
      // Happy. Problem moods always override sleep; light=0 at night is
      // presented as a normal "Night 🌙", never as a problem.
      sleep: {
        bubble: "I'm sleeping. See you tomorrow! 💤",
        why: "Shh… Jamkachu is resting. Plants sleep too — see you tomorrow!",
        nightLabel: "Night 🌙",
        button: "Good night 🌙",
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
        luckyStamp: "LUCKY! ×2",
      },

      // Banner tag shown while presenter/demo mode is active (Task 21) and on
      // the offline static fallback (spec §3 offline row).
      demoTag: "DEMO",
    },

    // Bahasa Indonesia — key-for-key mirror of the en tree (the contract test
    // enforces this). Mood/game vocabulary matches live.js COPY.id and the
    // collection page ("Misi", "Lencana", "Suasana", "Ikatan", "NAIK LEVEL!")
    // so the farm page never mixes two words for one concept.
    id: {
      moods: {
        Happy: "Senang",
        Overheating: "Kepanasan",
        DryAir: "Udara Kering",
        Sleepy: "Mengantuk",
        SoilAcidic: "Tanah Asam",
        SoilAlkaline: "Tanah Basa",
      },

      // Emoji are shared across locales — identical to en by design.
      moodEmoji: {
        Happy: "😊",
        Overheating: "🥵",
        DryAir: "😵",
        Sleepy: "😴",
        SoilAcidic: "🤢",
        SoilAlkaline: "😖",
      },

      reasons: {
        quest: "Misi selesai",
        lucky: "Hoki ×2!",
        badge: "Lencana baru",
        chapter: "Cerita terbuka",
        streak: "Bonus hari beruntun",
        mood: "Suasana baru ditemukan",
        daily: "Tantangan harian",
        growth: "Catatan pertumbuhan",
      },

      // The honesty ending is the load-bearing sentence: exact meaning of
      // "Real care = real XP. The sensors will notice."
      ritual: {
        water: "Cipratan ini cuma buat seru-seruan — yuk, siram tanaman aslinya! Perawatan nyata = XP nyata. Sensor akan tahu.",
        fertilize: "Kilaunya memang gratis — tapi nutrisi asli yang menyuburkan tanah sungguhan! Perawatan nyata = XP nyata. Sensor akan tahu.",
      },

      // Tombol perawatan kontekstual (spec §6.1) — the sensor-honesty framing
      // is load-bearing: every why-card names the sensor that will verify it.
      care: {
        Overheating: {
          label: "Pindahkan aku ke tempat teduh 🌳",
          why: "Cari tempat yang lebih sejuk dan teduh ya. Sensor suhu pasti merasakan bedanya.",
        },
        DryAir: {
          label: "Jauhkan aku dari angin 🌬️",
          why: "Kipas dan AC bikin udaraku kering. Sensor kelembapan akan tahu kalau udaranya sudah lebih nyaman.",
        },
        Sleepy: {
          label: "Tunjukkan aku cahaya ☀️",
          why: "Buka tirainya atau pindahkan aku ke dekat jendela. Sensor cahaya akan melihatnya.",
        },
        Soil: {
          label: "Periksa tanahku bersama guru 🧑‍🏫",
          why: "Urusan pH tanah butuh bantuan orang dewasa. Jangan pernah menambahkan apa pun ke pot sendirian ya.",
        },
        Happy: {
          label: "Elus aku — atau tulis buku harianku 📖",
          why: "Aku lagi senang banget! Mau menyimpan cerita hari ini? Tulis sebaris di Buku Harianku.",
        },
      },

      sleep: {
        bubble: "Aku sedang tidur. Sampai besok! 💤",
        why: "Ssst… Jamkachu sedang istirahat. Tanaman juga tidur — sampai besok ya!",
        nightLabel: "Malam 🌙",
        button: "Selamat malam 🌙",
      },

      streakKeeper: {
        active: (d) => `🔥 ${d} hari beruntun — Jamkachu pasti senang kalau kamu mampir hari ini.`,
        broken: "Semua kebiasaan baik dimulai dari hari pertama. Selamat datang lagi!",
        flame: (d) => `${d} hari beruntun! Rawat hari ini biar jadi ${d + 1}.`,
      },

      // Same wording as the /collection disclosure (collection-tabs.tsx).
      luckyOdds: "1 dari 8 misi menumbuhkan bonus keberuntungan!",

      petting: [
        "Hihi, geli tau!",
        "Jamkachu senang main bareng kamu!",
        "Tanganmu hangat banget!",
        "Elus lagi dong!",
        "Aku tumbuh kuat berkat kamu!",
      ],

      pettingYawn: "Nyamannya… Jamkachu mau tidur sebentar dulu ya. Zzz…",

      vitals: {
        tempHot: "Fiuh, gerah! Beri angin dong!",
        tempGood: "Suhunya pas banget!",
        humDry: "Udaranya terasa kering",
        humGood: "Udaranya enak banget!",
        lightDark: "Gelap banget di sini",
        lightGood: "Waktunya berjemur!",
        phGood: "Tanahnya terasa nyaman",
        phOff: "Rasa tanahku aneh — bisa cek pH-nya?",
      },

      echo: {
        humidityUp: (d) => `Udara +${d}% — Jamkachu bisa bernapas lega!`,
        tempComfy: "Sudah adem lagi",
        lightOn: "Matahari muncul!",
        verifying: "Sensor melihat perawatanmu — sedang memverifikasi…",
      },

      verifying: {
        checking: "Sensor sedang memeriksa…",
      },

      fx: {
        levelUpTitle: "NAIK LEVEL!",
        levelUpSub: (level) => `Ikatan Lv.${level} — perawatanmu membuahkan hasil`,
        questComplete: "🏆 Misi selesai!",
        xpGain: (delta) => `+${delta} XP`,
        streakUp: (days) => (days === 1 ? "+1 hari" : `+${days} hari`),
        luckyStamp: "BERUNTUNG! ×2",
      },

      // Presenter/demo tag is a product mark, not copy — stays "DEMO".
      demoTag: "DEMO",
    },
  };

  const isLocale = (value) => value === "en" || value === "id";

  // Cookie first, then localStorage — same precedence as live.js
  // initialLocale(). `readable` tracks whether ANY browser storage answered:
  // readable-and-empty means a real page → product default "id"; nothing
  // readable means a bare stub (tests, odd embeds) → "en".
  function detectLocale() {
    let readable = false;
    try {
      const cookie = window.document.cookie;
      if (typeof cookie === "string") {
        readable = true;
        const match = cookie.match(/(?:^|;\s*)plantmoji_locale=([^;\s]+)/);
        if (match && isLocale(match[1])) return match[1];
      }
    } catch {
      // No document (unit-test stub, worker-ish embed) — try localStorage.
    }
    try {
      if (window.localStorage) {
        const stored = window.localStorage.getItem("plantmoji_locale");
        readable = true;
        if (isLocale(stored)) return stored;
      }
    } catch {
      // localStorage blocked (privacy mode / sandboxed iframe) — fall through.
    }
    return readable ? "id" : "en";
  }

  window.PM_STRINGS = STRINGS[detectLocale()];
})();
