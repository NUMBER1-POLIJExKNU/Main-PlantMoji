import type { PlantMood } from "@/types/events";
import { COMPANION_STAGES } from "@/types/game";
import type { CompanionStage, PersonalityId } from "@/types/game";
import type { AppLocale } from "@/lib/i18n";

// Ten sensor-grounded observations × five matching asks per mood = exactly
// 50 distinct lines per mood, 300 total. Composition keeps the bank easy to
// review and prevents unsafe watering/fertiliser advice from creeping in.
const PARTS: Record<PlantMood, { observations: string[]; responses: string[] }> = {
  Happy: {
    observations: [
      "Everything feels comfortable", "My readings are in a cozy range", "I feel bright and steady", "This is a lovely growing moment", "My leaves feel ready for the day", "The room feels just right", "I am feeling calm and strong", "Today feels wonderfully balanced", "I can focus on growing", "All my sensors say I am comfortable",
    ],
    responses: ["thanks for checking on me!", "let’s keep caring together!", "I’m glad you stopped by!", "we make a great team!", "come back and say hi later!"],
  },
  Overheating: {
    observations: [
      "The temperature is above my comfortable range", "I am feeling too warm", "My sensor says the air is hot", "This heat is making me uncomfortable", "I need a break from this warmth", "The room has become too hot for me", "I am having a very warm moment", "My temperature reading needs attention", "It is hotter than I prefer", "I could use a cooler spot",
    ],
    responses: ["please help me find shade.", "could you move me away from heat?", "let’s check for a cooler place.", "please ask someone to help me cool down.", "can we lower the heat around me safely?"],
  },
  DryAir: {
    observations: [
      "The air humidity is below my comfortable range", "The air around me feels dry", "My humidity sensor is asking for attention", "This room air is drier than I prefer", "I am missing comfortable humidity", "The air needs a little humidity check", "My surroundings feel too dry", "The humidity reading is low", "I would feel better in gentler air", "The air is not in my cozy range",
    ],
    responses: ["could we check the room humidity?", "please help make the air less dry.", "let’s ask an adult about safe humidity.", "can we move to air that feels more comfortable?", "please check the air around me again soon."],
  },
  Sleepy: {
    observations: [
      "The light level is low", "It is too dim for my daytime growing", "My light sensor says it is dark", "I am getting sleepy in this low light", "The room is darker than I prefer", "I could use a brighter daytime spot", "My growing space feels dim", "There is not much light reaching me", "The low light is making me drowsy", "My sensor is looking for more light",
    ],
    responses: ["could you find me a brighter safe spot?", "please check whether the light can reach me.", "let’s look for gentle daylight.", "can we brighten my daytime space?", "please help me check the light source."],
  },
  SoilAcidic: {
    observations: [
      "My soil pH is below the recommended range", "The pH sensor says my soil is too acidic", "My soil reading is on the sour side", "The soil balance needs an adult check", "My pH reading is lower than I prefer", "The sensor found acidic soil", "My roots need a careful pH review", "The soil is outside my comfortable pH range", "My pH result needs teacher attention", "The latest soil check reads too acidic",
    ],
    responses: ["please ask a teacher or adult about this acidic reading.", "can an adult check the low pH safely?", "let’s show this acidic result to a teacher.", "please do not add anything for low pH without adult help.", "an adult can decide the safe next step for acidic soil."],
  },
  SoilAlkaline: {
    observations: [
      "My soil pH is above the recommended range", "The pH sensor says my soil is too alkaline", "My soil reading is on the alkaline side", "The soil balance needs an adult check", "My pH reading is higher than I prefer", "The sensor found alkaline soil", "My roots need a careful pH review", "The soil is outside my comfortable pH range", "My pH result needs teacher attention", "The latest soil check reads too alkaline",
    ],
    responses: ["please ask a teacher or adult about this alkaline reading.", "can an adult check the high pH safely?", "let’s show this alkaline result to a teacher.", "please do not add anything for high pH without adult help.", "an adult can decide the safe next step for alkaline soil."],
  },
};

export const JAMKACHU_DIALOGUE: Record<PlantMood, string[]> = Object.fromEntries(
  Object.entries(PARTS).map(([mood, parts]) => [
    mood,
    parts.observations.flatMap((observation) => parts.responses.map((response) => `${observation} — ${response}`)),
  ]),
) as Record<PlantMood, string[]>;

export const JAMKACHU_DIALOGUE_COUNT = Object.values(JAMKACHU_DIALOGUE).reduce((sum, lines) => sum + lines.length, 0);

export type DialogueTime = "morning" | "later";
// Derived from the 10-stage ladder source of truth — never a second literal.
const STAGES: readonly CompanionStage[] = COMPANION_STAGES;
const TIMES: DialogueTime[] = ["morning", "later"];

/** 6 moods × 10 companion stages × 2 time contexts × 10 observations = 1,200. */
export const JAMKACHU_CONTEXT_DIALOGUE: string[] = Object.entries(PARTS).flatMap(([mood, parts]) =>
  STAGES.flatMap((stage) => TIMES.flatMap((time) => parts.observations.map((observation, index) =>
    `${time === "morning" ? "Good morning" : "Here we are again"} — as a ${stage} companion, ${observation.toLowerCase()} (${mood} care ${index + 1}).`,
  ))),
);

export const JAMKACHU_EVENT_KINDS = ["quest", "recovery", "memory", "level", "badge", "evolution"] as const;
export type JamkachuEventKind = (typeof JAMKACHU_EVENT_KINDS)[number];
const EVENT_OPENERS = ["I noticed it", "What a moment", "We did that together", "I will remember this", "Our care paid off", "That made my leaves perk up", "Here is today’s good news", "Something special happened", "Our little story grew", "Team Jamkachu did it"];
const EVENT_ENDINGS = ["thank you for being here!", "let’s remember this one!", "our bond keeps growing!", "I’m proud of our teamwork!", "ready for the next caring moment?"];

/** 6 event families × 10 openings × 5 endings = 300 event reactions. */
export const JAMKACHU_EVENT_DIALOGUE: Record<JamkachuEventKind, string[]> = Object.fromEntries(
  JAMKACHU_EVENT_KINDS.map((kind) => [kind, EVENT_OPENERS.flatMap((opening) => EVENT_ENDINGS.map((ending) => `${opening}: ${kind} milestone — ${ending}`))]),
) as Record<JamkachuEventKind, string[]>;

export const JAMKACHU_TOTAL_DIALOGUE_COUNT = JAMKACHU_DIALOGUE_COUNT + JAMKACHU_CONTEXT_DIALOGUE.length + Object.values(JAMKACHU_EVENT_DIALOGUE).flat().length;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

export function dialogueForMood(mood: PlantMood, seed: string): string {
  const lines = JAMKACHU_DIALOGUE[mood];
  return lines[hash(`${mood}|${seed}`) % lines.length];
}

export function dialogueCandidates(mood: PlantMood, stage: CompanionStage, time: DialogueTime, seed: string, count = 24): string[] {
  const base = JAMKACHU_DIALOGUE[mood];
  const observations = PARTS[mood].observations;
  const contextual = observations.map((observation, index) => `${time === "morning" ? "Good morning" : "Here we are again"} — as a ${stage} companion, ${observation.toLowerCase()} (${mood} care ${index + 1}).`);
  const pool = [...base, ...contextual];
  const start = hash(`${mood}|${stage}|${time}|${seed}`) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[(start + index * 17) % pool.length]);
}

const VOICE_OPENERS: Record<AppLocale, Record<PersonalityId, string[]>> = {
  id: {
    cute: ["Hehe,", "Hihi,", "Peluk daun dulu—", "Aku senang kamu datang!", "Teman baikku,"],
    calm: ["Aku perhatikan:", "Pelan-pelan saja.", "Kondisiku sekarang:", "Mari kita cek.", "Satu langkah kecil:"],
    funny: ["Berita dari pot!", "Plot twist:", "Daunku protes nih—", "Waduh, drama tanaman!", "Laporan si hijau:"],
    energetic: ["Ayo, ayo!", "Tim Jamkachu!", "Semangat daun!", "Kita bisa!", "Siap bergerak!"],
    shy: ["Ehm…", "Kalau tidak merepotkan…", "Aku mau bilang sedikit…", "Um, teman…", "Boleh minta bantuan kecil?"],
  },
  en: {
    cute: ["Hehe,", "Leaf hug first—", "Yay, you’re here!", "My favorite human,", "Tiny sprout report:"],
    calm: ["I noticed:", "One calm step:", "My condition now:", "Let’s check together.", "No rush:"],
    funny: ["News from the pot!", "Plot twist:", "My leaves filed a complaint—", "Plant drama alert!", "Green report:"],
    energetic: ["Let’s go!", "Team Jamkachu!", "Leaf power!", "We’ve got this!", "Ready, set, grow!"],
    shy: ["Um…", "If it’s not too much trouble…", "I wanted to say…", "Hey, friend…", "Could I ask a tiny favor?"],
  },
};

const SIMPLE_MOOD_LINES: Record<AppLocale, Record<PlantMood, string[]>> = {
  id: {
    Happy: ["aku nyaman banget hari ini.", "semua terasa pas. Makasih, ya!", "daunku lagi happy.", "aku bisa tumbuh dengan tenang.", "hari ini potku terasa seperti rumah."],
    Overheating: ["panas banget! Ajak aku ke tempat teduh, yuk.", "aku hampir jadi keripik daun. Cari tempat sejuk, ya.", "suhunya ketinggian. Kita pindah dari panas, yuk.", "aku butuh sedikit teduh, teman.", "sensor suhu bilang aku kepanasan."],
    DryAir: ["udaranya kering. Jauhkan aku dari kipas atau AC, ya.", "daunku kangen udara yang lebih nyaman.", "kelembapan udaranya rendah—bukan berarti tanahku haus, ya.", "boleh cek udara di sekitarku?", "anginnya bikin udara terlalu kering buatku."],
    Sleepy: ["gelap nih. Carikan cahaya siang yang aman, yuk.", "aku belum bisa makan cahaya kalau segelap ini.", "sensor cahaya lagi bilang gelap.", "boleh buka jalan buat cahaya?", "aku butuh tempat yang sedikit lebih terang."],
    SoilAcidic: ["pH tanahku terlalu rendah. Panggil guru, ya.", "tanahku terlalu asam—jangan tambah bahan sendiri.", "boleh tunjukkan hasil pH ini ke orang dewasa?", "akarku butuh pemeriksaan pH yang aman.", "sensor pH minta bantuan guru."],
    SoilAlkaline: ["pH tanahku terlalu tinggi. Panggil guru, ya.", "tanahku terlalu basa—jangan tambah bahan sendiri.", "boleh tunjukkan hasil pH ini ke orang dewasa?", "akarku butuh pemeriksaan pH yang aman.", "sensor pH minta bantuan guru."],
  },
  en: {
    Happy: ["I feel wonderfully cozy today.", "everything feels just right. Thank you!", "my leaves are doing a happy dance.", "I can grow in peace.", "my pot feels like home today."],
    Overheating: ["so hot! Let’s find a shady spot.", "I’m nearly a leaf chip. Cooler place, please!", "the temperature is high. Let’s move away from heat.", "I need a little shade, friend.", "the temperature sensor says I’m too hot."],
    DryAir: ["the air is dry. Keep me away from fans or AC.", "my leaves miss gentler air.", "air humidity is low—this does not mean my soil is thirsty.", "could we check the air around me?", "the draft is making my air too dry."],
    Sleepy: ["it’s dark. Let’s find safe daytime light.", "I can’t snack on sunshine in the dark.", "the light sensor says it’s dim.", "could you make a path for the light?", "I need a slightly brighter spot."],
    SoilAcidic: ["my soil pH is low. Please call a teacher.", "my soil is too acidic—don’t add anything by yourself.", "could an adult check this pH result?", "my roots need a safe pH check.", "the pH sensor is asking for a teacher."],
    SoilAlkaline: ["my soil pH is high. Please call a teacher.", "my soil is too alkaline—don’t add anything by yourself.", "could an adult check this pH result?", "my roots need a safe pH check.", "the pH sensor is asking for a teacher."],
  },
};

/** 25 short, localized alternatives for each personality+mood pair. Sensor
 * truth and safe action stay fixed; personality changes only the voice. */
export function personalityDialogueCandidates(personality: PersonalityId, mood: PlantMood, locale: AppLocale, seed: string, count = 24) {
  const pool = VOICE_OPENERS[locale][personality].flatMap((opener) => SIMPLE_MOOD_LINES[locale][mood].map((line) => `${opener} ${line}`));
  const start = hash(`${personality}|${mood}|${locale}|${seed}`) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[(start + index * 7) % pool.length]);
}
