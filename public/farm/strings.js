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
        TooCold: "Too Cold",
        DryAir: "Dry Air",
        HumidAir: "Humid Air",
        Sleepy: "Sleepy",
        SoilAcidic: "Acidic",
        SoilAlkaline: "Alkaline",
      },

      // Emoji companions for the mood words (spec §2.1: 😊🥵😵😴🤢😖).
      moodEmoji: {
        Happy: "😊",
        Overheating: "🥵",
        TooCold: "🥶",
        DryAir: "😵",
        HumidAir: "💧",
        Sleepy: "😴",
        SoilAcidic: "🤢",
        SoilAlkaline: "😖",
      },

      // Speech-bubble templates for each mood — rendered via innerHTML (the
      // <br> is layout; live.js's moodBubble() adds the surrounding quotes).
      // live.js keeps a COPY-dictionary twin as the last-resort fallback.
      moodBubbles: {
        Happy: "I'm feeling so healthy!<br>Thanks for the care.",
        Overheating: "It's too hot...<br>please cool me down!",
        TooCold: "Brrr, it's too cold...<br>please warm me up!",
        DryAir: "The air feels so dry...<br>a little humidity, please?",
        HumidAir: "The air feels muggy...<br>a little airflow, please?",
        Sleepy: "It's so dark... I'm sleepy.<br>More light, please!",
        SoilAcidic: "My soil feels too acidic...<br>ask a teacher to check its pH!",
        SoilAlkaline: "My soil feels too alkaline...<br>ask a teacher to check its pH!",
      },

      // Quest display titles for the home "TODAY'S MISSION" slot and the
      // quest-complete banner. Keys mirror src/game/quests/quest-definitions
      // .ts; the id twin's names are copied VERBATIM from QUEST_COPY_ID
      // (src/lib/i18n.ts) so React pages and the farm home always use one
      // identical name per quest.
      questTitles: {
        KEEP_ME_HAPPY: "Keep Me Happy",
        STAY_COMFY: "Stay Comfy",
        COOL_ME_DOWN: "Cool Me Down",
        WARM_ME_UP: "Warm Me Up",
        GIVE_ME_MORE_LIGHT: "Give Me More Light",
        HUMIDIFY_MY_AIR: "Humidify My Air",
        DEHUMIDIFY_MY_AIR: "Dry My Air",
        BALANCE_SOIL_ACIDIC: "Balance My Soil",
        BALANCE_SOIL_ALKALINE: "Balance My Soil",
      },

      // Badge display names for Jamkachu's memory bubbles (spec §6.5) — en
      // names verbatim from BADGE_DEFINITIONS (src/game/badges), id names
      // verbatim from BADGE_COPY_ID (src/lib/i18n.ts). Unknown keys fall
      // back to live.js's prettifyKey.
      badges: {
        FIRST_RESCUE: "First Help",
        LIGHT_MASTER: "Light Helper",
        LEVEL_5_BOND: "Good Friends",
        COOL_KEEPER: "Cool Helper",
        PH_GUARDIAN: "Happy Soil",
        STREAK_7: "7-Day Care",
        HUMIDITY_HERO: "Air Helper",
        MOOD_SCHOLAR: "Mood Finder",
        CARE_VETERAN: "Quest Star",
        CHRONICLER: "Plant Writer",
        STREAK_30: "30-Day Care",
        LEVEL_10_BOND: "Best Friends",
      },

      // Companion stage display names, keyed by the backend stage name used
      // in live.js's `companion-<Stage>` classes. All 10 stages of the
      // evolution ladder (companion-ladder.js window.PM_LADDER, mirrored
      // from src/types/game.ts COMPANION_LADDER), in ladder order. Consumed
      // by renderCompanion's label and the transformation-FX ceremony
      // (evo.evolved below) to localize {stage}.
      companionStage: {
        Seed: "Seed",
        Sprout: "Sprout",
        Seedling: "Seedling",
        Bud: "Bud",
        Bloom: "Bloom",
        Fruit: "Fruit",
        Guardian: "Guardian",
        Elder: "Elder",
        Radiant: "Radiant",
        Legend: "Legend",
      },

      // Companion care-affinity form names (companion_state.form_key) for
      // the identity label under the mascot.
      companionForm: {
        cool: "Cool-headed",
        air: "Fresh-air",
        light: "Sun-chaser",
        soil: "Soil-wise",
        steady: "Steady",
        balanced: "Balanced",
      },

      // Leading word of the identity label: "COMPANION · Sprout · Steady".
      companionWord: "COMPANION",

      // Honest next-stage progress line under the label. Numbers come ONLY
      // from companion_state counters written by the backend sweep — live.js
      // hides the line entirely when the counters are missing (pre-
      // milestone16 DB) rather than guessing. Split into a `line` template
      // plus per-axis segment templates: renderCompanionNext only renders
      // the axes the next stage actually requires (ladder req > 0), so a
      // zero-requirement axis like Bud's days never shows as "days 2/0".
      // `affinity` counts distinct care types exercised (affinity_count).
      companionNext: {
        line: (stage, reqs) => `Next: ${stage} — ${reqs}`,
        care: (have, need) => `care ${have}/${need}`,
        affinity: (have, need) => `care types ${have}/${need}`,
        days: (have, need) => `days ${have}/${need}`,
      },

      // Shown instead of the progress line at the top stage (Legend).
      companionMax: "Fully grown — a legend of Jember!",

      // Short evolution announcement ({stage} is already localized via the
      // companionStage table above). Consumed by runEvolutionSequence as the
      // localized middle fallback for the ceremony line — it outranks the
      // hard-coded English EVO_FALLBACK when the evo table is missing.
      companionEvolved: (stage) => `Evolved into ${stage}!`,

      // Reason-chip labels (Task 14): bond_events reason prefix → friendly label.
      reasons: {
        quest: "Quest complete",
        lucky: "Bonus ×2",
        badge: "New badge",
        chapter: "Story unlocked",
        streak: "Streak bonus",
        mood: "New mood found",
        daily: "Daily challenge",
        growth: "Diary entry",
      },

      // Seed Shop (milestone18): farm HUD chip label. Balance itself comes
      // from bond_state.seeds — the farm layer never computes it.
      seedShop: {
        label: "Seeds",
      },

      // Wardrobe (milestone20): cosmetic Jember-crop companion skins,
      // unlocked by bond level, display-only — skins never grant or gate
      // anything. `lockedAt` renders the compact "Lv N" lock badge, `hint`
      // answers a tap on a locked skin (no urgency, no countdowns), and
      // `migrationMissing` is the gentle in-panel notice shown when the
      // milestone20 migration has not been applied yet.
      wardrobe: {
        title: "JAMKACHU'S WARDROBE",
        open: "Outfits",
        current: "Wearing",
        lockedAt: (level) => `Lv ${level}`,
        hint: (level) => `Unlocks at Bond Lv ${level} — keep caring and it's yours!`,
        migrationMissing: "The wardrobe isn't set up in this garden yet — Jamkachu keeps the classic look for now.",
      },

      // Camera Live Guardian (milestone19): farm-side reactions to
      // camera_events realtime rows. Presentation only — never rewards.
      cameraGuardian: {
        touchLine: "Hehe, that tickles! Someone touched my real leaves 🌿",
        pestWhy: "The watch camera thinks something might be on the real plant — just a hint, worth a look!",
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
        TooCold: {
          label: "Move me somewhere warmer 🧣",
          why: "Find a warmer spot away from cold drafts, open windows, and AC. The temperature sensor will feel the difference.",
        },
        DryAir: {
          label: "Move me away from fans & AC 🌬️",
          why: "Fans and AC can dry the air around my leaves. This is about air humidity, not watering my soil; the humidity sensor will check the change.",
        },
        HumidAir: {
          label: "Give me fresh airflow 🪟",
          why: "Open a window or improve airflow to clear the muggy air around my leaves. This is about air humidity, not watering my soil; the humidity sensor will check the change.",
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

      // Double-tap surprise hop (tactile interactions): one excited line.
      petSurprise: "Secret move: LEAF SPRING!",

      // Mood-aware comfort petting: when Jamkachu is NOT Happy, petting
      // answers with gratitude plus the real, sensor-backed fix. Only what
      // the mood engine already knows — and never watering/fertilizing
      // (no soil-moisture or nutrient sensor exists). Both soil moods
      // share the "Soil" family, like the care button.
      petComfort: {
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
      },

      // Body-part pokes: pot knock (+ Lv.2 sticker variant) and stem boop.
      poke: {
        pot: "Boom! Tiny pot drum! 🥁",
        potSticker: "Hey! That's my favorite sticker. 💚",
        stem: "Hihi, that's my tummy — it tickles!",
      },

      // Long-press lean-in: warm settle line on release.
      leanIn: "Mmm… staying close to you is my favorite.",

      // Night lullaby stroke (sleep mode): why-card after one slow gentle
      // stroke. Jamkachu stays asleep — the card explains, never celebrates.
      lullaby: {
        why: "Your slow, gentle stroke felt like a lullaby 🎵 Jamkachu is sleeping even more soundly.",
      },

      // Farmer grandpa NPC (living world): warm, folksy guidance chosen by
      // the CURRENT mood — two variants per problem mood so he never repeats
      // verbatim, plus rotating farming wisdom while Happy. STRICTLY
      // sensor-grounded: only what the mood engine already knows, and NEVER
      // watering or fertilizing (no such sensors exist). Both soil moods
      // share the "Soil" family, like the care button. Zero XP, always.
      farmer: {
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
        idle: {
          companion: [
            "A quiet garden is still a busy place, my young friend. Leaves do plenty of work without making a fuss.",
            "Hoho… no need to hurry. Plants are very good teachers of patience.",
            "You noticed our little friend today. That alone is a fine start.",
            "Let’s give the plant a calm moment, then ask the sensors how things are going.",
            "Every careful look teaches us something, even when nothing needs changing.",
          ],
          wisdom: [
            "Good gardeners change one small thing at a time, then watch what happens.",
            "A sensor is a clue, not a command. We look, think, and check again together.",
            "Air humidity tells us about the air around the leaves—not how wet the soil is.",
            "Soil pH deserves careful hands. Ask a teacher or local farmer before changing it.",
          ],
        },
      },

      // Threshold-true vital comments (Task 19). Boundaries mirror the mood
      // engine so a comment can never contradict the current mood:
      //   temp: > 32 hot · 18–28 good
      //   humidity: < 40 dry · >= 45 good (the hysteresis band stays silent)
      //   light: 0 dark · 1 good (bright) · 0 at night = gentle night line
      //   soil pH: 6.0–7.0 good · outside that band = off
      vitals: {
        tempHot: "Phew, vent please!",
        tempGood: "Perfect temperature!",
        humDry: "Air feels dry",
        humGood: "The air feels lovely!",
        lightDark: "Pretty dark here",
        lightGood: "Sunbathing time!",
        lightNight: "Night 🌙 — it's supposed to be dark now. Sweet dreams!",
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

      // Hatching intro (spec §6.3): one-time first-visit sequence, pure
      // presentation — no XP, no writes; the seen-flag lives in localStorage.
      // Text-diet pass: the four per-sensor cards were cut — the first-day
      // tour's step 1 spotlights the same tiles right afterwards.
      hatch: {
        skip: "Skip",
        rumble: "Rumble rumble… something is stirring in the pot!",
        hello: "Nice to meet you!",
        personality: "I'm a sunshine-loving little plant — cozy air, bright days, and lots of hanging out with you!",
        rename: "You can change my name in Settings ⚙️",
        finale: "This button always shows what I need!",
      },

      // First-day tour (display-only follow-up to the hatch intro, hosted
      // by live.js's pmCoach engine): five coach cards — emoji + ONE short
      // sentence each, no titles — pointing at the REAL interface: senses
      // HUD, care button, daily quiz chip, quest link, and Grandpa's
      // sticker-book handoff (`grandpa`, whose `dare` is the action-button
      // verb label). Pure presentation, no writes/XP; the seen-flag lives
      // in the unified pm_seen_v3 store (PMSeen "tour"). `senses.waiting`
      // is the honest extra line for card 1 when no reading has ever
      // arrived. Kid-copy rule: always "senses", never "sensors".
      tour: {
        skip: "Skip",
        senses: {
          line: "These four tiles are my real senses — they feel my room for real!",
          waiting: "My senses haven't felt anything yet — the tiles will fill in on their own once my device is connected.",
        },
        care: {
          line: "This button always shows what I need — and it changes with my mood!",
        },
        quiz: {
          line: "Learn and earn here every day — a fresh farm case is waiting!",
        },
        quest: {
          line: "When my senses feel a change, a mission appears here!",
        },
        grandpa: {
          line: "Lost? Tap me — or fill my sticker book here →",
          dare: "Open my sticker book!",
        },
      },

      // Honest sensor-waiting state: shown on the env tiles when the garden
      // IS connected but no sensor reading has ever arrived. Vanishes the
      // moment renderSensors paints real data — no timers involved.
      sensorWait: {
        status: "waiting…",
        note: "My sensors are still waking up — the numbers will appear here on their own once the device is connected.",
      },

      // Level decorations (spec §6.4): names for the pure-presentation
      // keepsakes each bond level leaves behind, plus the T3 reveal chip.
      decor: {
        reveal: (name) => `New decoration: ${name}!`,
        sticker: "Pot heart sticker",
        flag: "Pot flag",
        room: "Warmer room glow",
        goldpot: "Golden pot",
        bffToken: "Best Friend 💛",
      },

      // Jamkachu memories (spec §6.5): template sentences built from recent
      // bond_events, rotated into the idle speech bubble. No AI calls.
      memories: {
        day: { today: "Today", yesterday: "Yesterday", earlier: "A few days ago" },
        quest: (day) => `${day} you helped me feel better!`,
        badge: (name) => `We earned the ${name} badge together!`,
        chapter: (n) => `Our story reached chapter ${n}!`,
        streak: (n) => `${n} days of care — I remember every one!`,
      },

      // Chapter Gate (plan T17, T5 peak): kicker label + one dialogue line.
      chapterGate: {
        label: (n) => `Chapter ${n}`,
        dialogue: "Our story grows, leaf by leaf. Thanks for growing with me!",
      },

      // Six Jember chapter titles — copied EXACTLY from
      // src/game/story/story-definitions.ts (the contract test pins them;
      // never edit one side alone).
      chapterTitles: {
        1: "First Meeting in Jember",
        2: "Roots in Volcanic Soil",
        3: "Trust, Rain or Shine",
        4: "Through Heat and Gray Skies",
        5: "Full Bloom, Carnival Bright",
        6: "Harvest of Wisdom",
      },

      // Existing live.js FX copy, centralized here per Task 4 ("move them in").
      // live.js keeps hardcoded fallbacks behind `|| {}` guards.
      fx: {
        levelUpTitle: "LEVEL UP!",
        levelUpSub: (level) => `Bond Lv.${level} — your care is paying off`,
        questComplete: "🏆 Quest complete!",
        xpGain: (delta) => `+${delta} XP`,
        streakUp: (days) => (days === 1 ? "+1 day" : `+${days} days`),
        luckyStamp: "BONUS ×2",
      },

      // Evolution ceremony dialog (Pokémon-Style Transformation FX plan,
      // Task 2). {name} is the plant's display name; {stage} is a localized
      // stage name passed in from the companionStage table above — do not
      // re-declare stage names here. Consumed by live.js's evolution
      // sequencer (Task 4) and level-up re-stage (Task 5).
      evo: {
        noticing: (name) => `What? ${name} is changing…!`,
        evolved: (name, stage) => `Congratulations! ${name} grew into ${stage}!`,
        tapToContinue: "Tap to continue",
        // Banner for the last stage of the whole growth arc: days of sensor
        // care and completed quests, expressed as an earned final form.
        finalForm: "FINAL FORM",
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
        TooCold: "Kedinginan",
        DryAir: "Udara Kering",
        HumidAir: "Udara Lembap",
        Sleepy: "Mengantuk",
        SoilAcidic: "Tanah Asam",
        SoilAlkaline: "Tanah Basa",
      },

      // Emoji are shared across locales — identical to en by design.
      moodEmoji: {
        Happy: "😊",
        Overheating: "🥵",
        TooCold: "🥶",
        DryAir: "😵",
        HumidAir: "💧",
        Sleepy: "😴",
        SoilAcidic: "🤢",
        SoilAlkaline: "😖",
      },

      // Templat gelembung bicara per suasana — dirender lewat innerHTML
      // (<br> bagian dari tata letak; tanda kutipnya ditambahkan oleh
      // moodBubble() di live.js).
      moodBubbles: {
        Happy: "Aku merasa sehat banget!<br>Terima kasih sudah merawatku.",
        Overheating: "Aku kepanasan...<br>bantu sejukkan aku, ya!",
        TooCold: "Brrr, aku kedinginan...<br>bantu hangatkan aku, ya!",
        DryAir: "Udaranya kering...<br>boleh bantu lembapkan sedikit?",
        HumidAir: "Udaranya pengap...<br>boleh beri aliran udara?",
        Sleepy: "Gelap sekali... aku mengantuk.<br>Boleh tambah cahaya?",
        SoilAcidic: "Tanahku terasa terlalu asam...<br>ajak guru cek pH-nya, ya!",
        SoilAlkaline: "Tanahku terasa terlalu basa...<br>ajak guru cek pH-nya, ya!",
      },

      // Judul misi — nama id disalin PERSIS dari QUEST_COPY_ID
      // (src/lib/i18n.ts) supaya halaman React dan kebun memakai satu nama
      // yang sama untuk setiap misi.
      questTitles: {
        KEEP_ME_HAPPY: "Jaga Aku Tetap Sehat",
        STAY_COMFY: "Tetap Nyaman",
        COOL_ME_DOWN: "Sejukkan Aku",
        WARM_ME_UP: "Hangatkan Aku",
        GIVE_ME_MORE_LIGHT: "Beri Aku Cahaya",
        HUMIDIFY_MY_AIR: "Lembapkan Udaraku",
        DEHUMIDIFY_MY_AIR: "Keringkan Udaraku",
        BALANCE_SOIL_ACIDIC: "Seimbangkan Tanahku",
        BALANCE_SOIL_ALKALINE: "Seimbangkan Tanahku",
      },

      // Nama lencana untuk gelembung kenangan Jamkachu — disalin PERSIS
      // dari BADGE_COPY_ID (src/lib/i18n.ts).
      badges: {
        FIRST_RESCUE: "Pertolongan Pertama",
        LIGHT_MASTER: "Pembantu Cahaya",
        LEVEL_5_BOND: "Sahabat Baik",
        COOL_KEEPER: "Pembantu Sejuk",
        PH_GUARDIAN: "Tanah Sehat",
        STREAK_7: "Rawat 7 Hari",
        HUMIDITY_HERO: "Pembantu Udara",
        MOOD_SCHOLAR: "Penemu Suasana",
        CARE_VETERAN: "Bintang Misi",
        CHRONICLER: "Penulis Tanaman",
        STREAK_30: "Rawat 30 Hari",
        LEVEL_10_BOND: "Sahabat Terbaik",
      },

      // Nama tahap pertumbuhan companion — lihat catatan companionStage di
      // pohon en di atas (10 tahap tangga evolusi, urutan mengikuti
      // window.PM_LADDER di companion-ladder.js).
      companionStage: {
        Seed: "Benih",
        Sprout: "Kecambah",
        Seedling: "Semai",
        Bud: "Kuncup",
        Bloom: "Mekar",
        Fruit: "Berbuah",
        Guardian: "Penjaga",
        Elder: "Tetua",
        Radiant: "Bercahaya",
        Legend: "Legenda",
      },

      // Nama bentuk kepribadian perawatan (companion_state.form_key).
      companionForm: {
        cool: "Kepala dingin",
        air: "Udara segar",
        light: "Pengejar cahaya",
        soil: "Paham tanah",
        steady: "Tekun",
        balanced: "Seimbang",
      },

      // Kata pembuka label identitas: "SAHABAT · Kecambah · Tekun".
      companionWord: "SAHABAT",

      // Baris progres tahap berikutnya — angkanya HANYA dari penghitung
      // companion_state tulisan backend; live.js menyembunyikan barisnya
      // kalau penghitungnya belum ada (DB pra-milestone16), tidak menebak.
      // Dipecah menjadi templat `line` + segmen per sumbu: renderCompanionNext
      // hanya menampilkan sumbu yang benar-benar disyaratkan tahap berikutnya
      // (req tangga > 0), jadi sumbu bersyarat nol seperti hari untuk Kuncup
      // tidak pernah tampil sebagai "hari 2/0". `affinity` menghitung jenis
      // rawatan berbeda yang sudah dilakukan (affinity_count).
      companionNext: {
        line: (stage, reqs) => `Berikutnya: ${stage} — ${reqs}`,
        care: (have, need) => `rawatan ${have}/${need}`,
        affinity: (have, need) => `jenis rawatan ${have}/${need}`,
        days: (have, need) => `hari ${have}/${need}`,
      },

      // Pengganti baris progres di tahap puncak (Legenda).
      companionMax: "Tumbuh penuh — legenda Jember!",

      // Pengumuman evolusi singkat ({stage} sudah dilokalkan lewat tabel
      // companionStage di atas). Dipakai runEvolutionSequence sebagai
      // cadangan terlokalkan untuk baris upacara — diutamakan di atas
      // EVO_FALLBACK bahasa Inggris saat tabel evo tidak ada.
      companionEvolved: (stage) => `Berevolusi menjadi ${stage}!`,

      reasons: {
        quest: "Misi selesai",
        lucky: "Bonus ×2",
        badge: "Lencana baru",
        chapter: "Cerita terbuka",
        streak: "Bonus hari beruntun",
        mood: "Suasana baru ditemukan",
        daily: "Tantangan harian",
        growth: "Catatan pertumbuhan",
      },

      seedShop: {
        label: "Benih",
      },

      // Lemari kostum (milestone20): tampilan panen Jember kosmetik, terbuka
      // lewat level ikatan, murni tampilan — kostum tidak pernah memberi
      // atau mengunci apa pun. Kunci "Lv N" dan petunjuknya tanpa nada
      // buru-buru (spec §4.3).
      wardrobe: {
        title: "LEMARI KOSTUM JAMKACHU",
        open: "Kostum",
        current: "Dipakai",
        lockedAt: (level) => `Lv ${level}`,
        hint: (level) => `Terbuka di Ikatan Lv ${level} — terus rawat ya, nanti jadi milikmu!`,
        migrationMissing: "Lemari kostum belum siap di kebun ini — Jamkachu tetap tampil klasik dulu ya.",
      },

      // Camera Live Guardian (milestone19): reaksi kebun untuk baris
      // realtime camera_events. Hanya presentasi — tidak pernah hadiah.
      cameraGuardian: {
        touchLine: "Hihi, geli! Ada yang menyentuh daun asliku 🌿",
        pestWhy: "Kamera penjaga menduga ada sesuatu di tanaman asli — sekadar petunjuk, coba lihat ya!",
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
        TooCold: {
          label: "Pindahkan aku ke tempat lebih hangat 🧣",
          why: "Cari tempat yang lebih hangat, jauh dari angin dingin, jendela terbuka, dan AC. Sensor suhu pasti merasakan bedanya.",
        },
        DryAir: {
          label: "Jauhkan aku dari kipas & AC 🌬️",
          why: "Kipas dan AC bisa mengeringkan udara di sekitar daun. Ini tentang kelembapan udara, bukan menyiram tanah; sensor kelembapan akan memeriksa perubahannya.",
        },
        HumidAir: {
          label: "Beri aku aliran udara segar 🪟",
          why: "Buka jendela atau perbaiki aliran udara untuk mengurangi udara pengap di sekitar daun. Ini tentang kelembapan udara, bukan menyiram tanah; sensor kelembapan akan memeriksa perubahannya.",
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

      // Lompatan kaget ketuk-dua-kali: satu seruan gembira.
      petSurprise: "Jurus rahasia: LOMPAT DAUN!",

      // Elusan penenang saat mood tidak Senang — terima kasih + solusi nyata
      // yang didukung sensor. Tidak pernah menyiram/memupuk (sensornya
      // memang tidak ada). Kedua mood tanah berbagi keluarga "Soil".
      petComfort: {
        Overheating: [
          "Makasih… tapi tempat yang lebih sejuk dan teduh pasti lebih enak.",
          "Elusanmu membantu… tapi ruangan ini lagi panas banget.",
          "Fiuh… tempat yang teduh pasti nyaman deh.",
          "Enak sih… tapi kata sensor suhu masih panas nih.",
          "Sedikit lebih adem, aku pasti ceria lagi.",
        ],
        TooCold: [
          "Makasih… tapi tempat yang lebih hangat pasti lebih enak.",
          "Tanganmu hangat… tapi ruangan ini lagi dingin banget.",
          "Brrr… tempat yang lebih hangat pasti nyaman deh.",
          "Enak sih… tapi kata sensor suhu masih dingin nih.",
          "Sedikit lebih hangat, aku pasti ceria lagi.",
        ],
        DryAir: [
          "Enak… tapi udaranya masih terasa kering nih.",
          "Makasih… jauh dari kipas dan angin, udaraku jadi lebih nyaman.",
          "Baik banget… udara yang lebih lembap pasti lebih menyenangkan lagi.",
          "Kata sensor kelembapan, udaranya masih kering banget.",
          "Tempat yang tenang tanpa angin pasti terasa lebih enak.",
        ],
        HumidAir: [
          "Enak… tapi udaranya masih terasa pengap nih.",
          "Makasih… sedikit aliran udara segar bikin udaraku lebih nyaman.",
          "Baik banget… udara yang lebih kering dan segar pasti lebih enak lagi.",
          "Kata sensor kelembapan, udaranya masih lembap banget.",
          "Jendela terbuka atau angin lembut pasti terasa lebih enak.",
        ],
        Sleepy: [
          "Makasih… sedikit cahaya pasti bikin aku segar lagi.",
          "Nyaman sih… tapi di sini lagi gelap banget.",
          "Tanganmu hangat… jendela yang terang pasti asyik banget.",
          "Kata sensor cahaya, sekarang lagi gelap nih.",
          "Sedikit cahaya siang, aku langsung semangat deh.",
        ],
        Soil: [
          "Makasih… tapi tanahku masih terasa agak aneh.",
          "Itu membantu… bisa ajak guru mengecek pH tanahku bareng?",
          "Kata sensor pH, tanahku belum pas nih.",
          "Urusan tanah butuh orang dewasa — jangan pernah menambahkan apa pun ke potku sendirian ya.",
          "Elusanmu manis… tapi tanahku perlu dicek orang dewasa.",
        ],
      },

      // Colekan bagian tubuh: ketuk pot (+ varian stiker Lv.2) dan colek batang.
      poke: {
        pot: "Tok tok — itu rumahku!",
        potSticker: "Tok tok! Hati-hati sama stiker hatiku ya!",
        stem: "Hihi, itu perutku — geli tau!",
      },

      // Sandaran tekan-lama: satu kalimat hangat saat dilepas.
      leanIn: "Hmm… dekat-dekat sama kamu itu favoritku.",

      // Usapan nina bobo malam: kartu penjelasan setelah satu usapan pelan.
      lullaby: {
        why: "Usapan pelanmu terasa seperti nina bobo 🎵 Tidur Jamkachu jadi makin nyenyak.",
      },

      // Kakek petani (dunia hidup): nasihat hangat khas kakek sesuai mood
      // SAAT INI — dua variasi per mood bermasalah, plus petuah bertani saat
      // Senang. Selalu berpijak pada sensor: tidak pernah menyiram atau
      // memupuk (sensornya memang tidak ada). Kedua mood tanah berbagi
      // keluarga "Soil", sama seperti tombol perawatan. Tanpa XP, selalu.
      farmer: {
        Overheating: [
          "Hoho… ruangan ini gerah sekali. Tempat yang lebih teduh dan sejuk pasti enak buat si kecil.",
          "Wah, topi kakek saja terasa panas. Carikan temanmu tempat yang lebih adem, ya?",
        ],
        TooCold: [
          "Hoho… ruangan ini dingin sekali. Tempat yang lebih hangat pasti enak buat si kecil.",
          "Brr! Tulang tua kakek pun terasa dinginnya. Pindahkan temanmu ke tempat yang lebih hangat, ya?",
        ],
        DryAir: [
          "Hoho… udaranya kering sekali. Jauh dari kipas dan angin, pasti lebih nyaman.",
          "Kumis tua kakek juga terasa kering nih. Pojok yang lebih tenang pasti membantu, ya?",
        ],
        HumidAir: [
          "Hoho… udaranya berat dan lembap. Sedikit aliran udara segar pasti membantu, ya?",
          "Kumis tua kakek juga terasa pengapnya. Bukakan jendela untuk si kecil, ya.",
        ],
        Sleepy: [
          "Hoho… gelap sekali di sini. Buka tirainya — tanaman suka pagi yang cerah.",
          "Sedikit sinar matahari itu ajaib. Geser potnya ke dekat jendela, ya?",
        ],
        Soil: [
          "Hoho… pH tanahnya kelihatan kurang pas. Cek bersama gurumu, ya?",
          "Urusan tanah itu urusan orang dewasa — jangan pernah menambahkan apa pun ke pot sendirian.",
        ],
        Happy: [
          "Hoho… tanaman terawat, petani kecilnya rajin. Kerja bagus!",
          "Kebun terbaik tumbuh dari kesabaran — dan kamu punya banyak.",
          "Selama puluhan tahun kakek bertani, perawatan seperti punyamu inilah yang bikin semuanya mekar.",
          "Dengarkan sensornya, petani kecil — mereka bicara mewakili tanaman.",
          "Tanaman yang senang tandanya temannya perhatian. Pertahankan, ya?",
        ],
        idle: {
          companion: [
            "Kebun yang tenang tetap sibuk, Nak. Daun bekerja tanpa banyak ribut.",
            "Hoho… tidak perlu terburu-buru. Tanaman pandai sekali mengajarkan kesabaran.",
            "Kamu sudah menyapa si kecil hari ini. Itu awal yang bagus, Nak.",
            "Kita beri tanaman waktu tenang, lalu tanyakan lagi kabarnya kepada sensor.",
            "Setiap pengamatan mengajarkan sesuatu, bahkan saat belum ada yang perlu diubah.",
          ],
          wisdom: [
            "Perawat kebun yang baik mengubah satu hal kecil, lalu memperhatikan hasilnya.",
            "Sensor itu petunjuk, bukan perintah. Kita lihat, pikirkan, lalu periksa lagi bersama.",
            "Kelembapan udara bercerita tentang udara di sekitar daun, bukan basahnya tanah.",
            "pH tanah perlu tangan yang hati-hati. Tanyakan kepada guru atau petani setempat sebelum mengubahnya.",
          ],
        },
      },

      vitals: {
        tempHot: "Fiuh, gerah! Beri angin dong!",
        tempGood: "Suhunya pas banget!",
        humDry: "Udaranya terasa kering",
        humGood: "Udaranya enak banget!",
        lightDark: "Gelap banget di sini",
        lightGood: "Waktunya berjemur!",
        lightNight: "Malam 🌙 — memang waktunya gelap kok. Selamat tidur ya!",
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

      // Intro penetasan (spec §6.3) — bahasa santai khas remaja, tetap
      // sopan. Empat kartu sensor dipangkas (diet teks): langkah 1 tur hari
      // pertama langsung menyorot kotak sensor yang sama.
      hatch: {
        skip: "Lewati",
        rumble: "Gruduk gruduk… ada yang bergerak di dalam pot!",
        hello: "Salam kenal ya!",
        personality: "Aku tanaman kecil penyuka matahari — udara nyaman, hari cerah, dan main bareng kamu!",
        rename: "Kamu bisa ganti namaku di Pengaturan ⚙️",
        finale: "Tombol ini selalu menunjukkan apa yang aku butuhkan!",
      },

      // Tur hari pertama (lanjutan intro penetasan, dijalankan mesin coach
      // pmCoach di live.js) — lihat catatan di pohon en: lima kartu, emoji
      // + SATU kalimat pendek, tanpa judul; kartu terakhir = kartu Kakek
      // dengan tombol tantangan (`grandpa.dare`). Aturan bahasa anak:
      // selalu "indra", jangan "sensor".
      tour: {
        skip: "Lewati",
        senses: {
          line: "Empat kotak ini indra asliku — mereka benar-benar merasakan kamarku!",
          waiting: "Indraku belum merasakan apa-apa — kotaknya akan terisi sendiri begitu perangkatnya terhubung.",
        },
        care: {
          line: "Tombol ini selalu menunjukkan yang kubutuhkan — dan berubah mengikuti suasana hatiku!",
        },
        quiz: {
          line: "Belajar dan dapat hadiah di sini setiap hari — ada kasus kebun baru menunggumu!",
        },
        quest: {
          line: "Saat indraku merasakan perubahan, misi muncul di sini!",
        },
        grandpa: {
          line: "Bingung? Ketuk aku, atau isi buku stikerku di sini →",
          dare: "Buka buku stikerku!",
        },
      },

      // Keadaan menunggu sensor yang jujur — lihat catatan di pohon en.
      sensorWait: {
        status: "menunggu…",
        note: "Sensorku masih bersiap-siap — angkanya akan muncul sendiri di sini begitu perangkatnya terhubung.",
      },

      // Dekorasi level (spec §6.4).
      decor: {
        reveal: (name) => `Dekorasi baru: ${name}!`,
        sticker: "Stiker hati di pot",
        flag: "Bendera kecil di pot",
        room: "Cahaya kamar lebih hangat",
        goldpot: "Pot emas",
        bffToken: "Sahabat 💛",
      },

      // Kenangan Jamkachu (spec §6.5).
      memories: {
        day: { today: "Hari ini", yesterday: "Kemarin", earlier: "Beberapa hari lalu" },
        quest: (day) => `${day} kamu bikin aku merasa lebih baik!`,
        badge: (name) => `Kita dapat lencana ${name} bareng-bareng!`,
        chapter: (n) => `Cerita kita sudah sampai bab ${n}!`,
        streak: (n) => `${n} hari merawatku — aku ingat semuanya!`,
      },

      // Gerbang Bab (plan T17).
      chapterGate: {
        label: (n) => `Bab ${n}`,
        dialogue: "Cerita kita tumbuh selembar demi selembar daun. Makasih sudah tumbuh bareng aku!",
      },

      // Terjemahan setia dari judul bab en (story-definitions.ts).
      chapterTitles: {
        1: "Pertemuan Pertama di Jember",
        2: "Berakar di Tanah Vulkanik",
        3: "Saling Percaya, Hujan maupun Cerah",
        4: "Melewati Panas dan Langit Kelabu",
        5: "Mekar Penuh Semeriah Karnaval",
        6: "Panen Kebijaksanaan",
      },

      fx: {
        levelUpTitle: "NAIK LEVEL!",
        levelUpSub: (level) => `Ikatan Lv.${level} — perawatanmu membuahkan hasil`,
        questComplete: "🏆 Misi selesai!",
        xpGain: (delta) => `+${delta} XP`,
        streakUp: (days) => (days === 1 ? "+1 hari" : `+${days} hari`),
        luckyStamp: "BONUS ×2",
      },

      // Dialog upacara evolusi (rencana Pokémon-Style Transformation FX,
      // Task 2). Lihat catatan {name}/{stage} di pohon en di atas.
      evo: {
        noticing: (name) => `Lho? ${name} mulai berubah…!`,
        evolved: (name, stage) => `Selamat! ${name} tumbuh menjadi ${stage}!`,
        tapToContinue: "Ketuk untuk lanjut",
        finalForm: "WUJUD AKHIR",
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
