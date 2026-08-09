import "server-only";

import { generateAiMessage } from "@/lib/ai";
import type { AdvisoryStatus, CropProfile, SensorSnapshot } from "@/lib/crop-profiles";
import type { EnvironmentAnalysis, EnvironmentParameter } from "@/lib/environment-analyzer";
import type { AppLocale } from "@/lib/i18n";
import type { ExplorerCrop } from "@/lib/jember-crop-catalog";
import type { PersonalityId } from "@/types/game";

export type EnvironmentAnalyzerResult = Record<"temperature" | "airHumidity" | "soilPh" | "light", AdvisoryStatus>;

/** Gemini receives decisions, never raw authority: every match/mismatch and
 * allowed recommendation below was already produced deterministically. */
export async function explainEnvironment(profile: CropProfile, snapshot: SensorSnapshot | null, result: EnvironmentAnalyzerResult, locale: AppLocale) {
  const fact = (label: string, value: string, status: AdvisoryStatus, recommendation: string) =>
    `${label}: ${value}; analyzer decision=${status}; allowed recommendation=${recommendation}.`;
  const summary = [
    fact("temperature", snapshot?.temperature == null ? "missing" : `${snapshot.temperature} C`, result.temperature, result.temperature === "High" ? "move away from heat or seek shade" : result.temperature === "Low" ? "check for a safely warmer location" : "keep observing"),
    fact("air humidity", snapshot?.humidity == null ? "missing" : `${snapshot.humidity}%`, result.airHumidity, result.airHumidity === "Low" ? "check room humidity; this does not mean watering soil" : "keep observing"),
    fact("soil pH", snapshot?.soilPh == null ? "missing" : String(snapshot.soilPh), result.soilPh, result.soilPh === "Optimal" ? "keep observing" : "ask a teacher or adult to inspect pH; give no chemical dose"),
    fact("relative light percentage", snapshot?.light == null ? "missing" : `${snapshot.light}%`, result.light, result.light === "Low" ? "check for a brighter safe daytime spot" : "keep observing"),
  ].join(" ");
  const fallback = locale === "id"
    ? `Penganalisis aturan menemukan: suhu ${result.temperature.toLowerCase()}, kelembapan udara ${result.airHumidity.toLowerCase()}, pH tanah ${result.soilPh.toLowerCase()}, dan cahaya ${result.light.toLowerCase()}. Ikuti panduan sensor yang ditandai dan minta bantuan orang dewasa untuk perubahan pH.`
    : `The deterministic analyzer found: temperature ${result.temperature.toLowerCase()}, air humidity ${result.airHumidity.toLowerCase()}, soil pH ${result.soilPh.toLowerCase()}, and light ${result.light.toLowerCase()}. Follow the highlighted sensor guidance and ask an adult for any pH adjustment.`;
  return (await generateAiMessage({ kind: "ENVIRONMENT_ANALYSIS", personality: "calm", plantName: profile.displayName, environmentSummary: summary, locale })) ?? fallback;
}

const PARAMETER_COPY: Record<AppLocale, Record<EnvironmentParameter, string>> = {
  id: { temperature: "Suhu", airHumidity: "Kelembapan udara", light: "Cahaya", soilPh: "pH tanah" },
  en: { temperature: "Temperature", airHumidity: "Air humidity", light: "Light", soilPh: "Soil pH" },
};

const MATCH_TONE: Record<PersonalityId, Record<AppLocale, (crop: string, matched: number, evaluated: number) => string>> = {
  cute: { id: (crop, matched, evaluated) => `Wah, tempat ini terasa cocok untuk referensi ${crop}! 🌱 Semua ${matched} dari ${evaluated} kondisi yang bisa kuukur sedang masuk rentang. Pertahankan dulu, lalu pindai lagi nanti karena lingkungan bisa berubah.`, en: (crop, matched, evaluated) => `Nice spot for ${crop}! 🌱 All ${matched} of ${evaluated} conditions I can measure are in range right now. Keep things steady and scan again later because the environment can change.` },
  calm: { id: (crop, matched, evaluated) => `${matched} dari ${evaluated} kondisi terukur cocok dengan referensi ${crop}. Pertahankan kondisi, lalu ukur kembali nanti untuk memastikan tetap stabil.`, en: (crop, matched, evaluated) => `${matched} of ${evaluated} measured conditions match the ${crop} reference. Keep conditions steady and measure again later to confirm they remain stable.` },
  funny: { id: (crop, matched, evaluated) => `Referensi ${crop} memberi tempat ini nilai “nyaman dulu!” 😄 ${matched} dari ${evaluated} kondisi cocok. Jangan ubah apa pun dulu—amati dan pindai lagi nanti.`, en: (crop, matched, evaluated) => `${crop} gives this spot a “cozy for now!” 😄 ${matched} of ${evaluated} conditions match. Change nothing yet—observe and scan again later.` },
  energetic: { id: (crop, matched, evaluated) => `Mantap! ${matched}/${evaluated} kondisi terukur cocok untuk referensi ${crop}! Jaga tetap stabil dan ayo cek lagi nanti!`, en: (crop, matched, evaluated) => `Great! ${matched}/${evaluated} measured conditions match the ${crop} reference! Keep them steady and let’s check again later!` },
  shy: { id: (crop, matched, evaluated) => `Um… sepertinya tempat ini cocok dengan referensi ${crop}. Semua ${matched} dari ${evaluated} kondisi terukur masuk rentang, jadi mungkin kita cukup mengamati dulu.`, en: (crop, matched, evaluated) => `Um… this spot seems to match the ${crop} reference. All ${matched} of ${evaluated} measured conditions are in range, so maybe we can just observe for now.` },
};

export async function explainCropMismatch(crop: ExplorerCrop, analysis: EnvironmentAnalysis, locale: AppLocale, personality: PersonalityId = "calm") {
  const mismatch = analysis.largestMismatch;
  if (!mismatch) return MATCH_TONE[personality][locale](crop.displayName, analysis.matchedConditions, analysis.evaluatedConditions);
  const condition = analysis.conditions[mismatch.parameter];
  const label = PARAMETER_COPY[locale][mismatch.parameter];
  const direction = locale === "id"
    ? (mismatch.direction === "low" ? "di bawah" : "di atas")
    : (mismatch.direction === "low" ? "below" : "above");
  const safeAction: Record<EnvironmentParameter, Record<AppLocale, string>> = {
    temperature: { id: mismatch.direction === "high" ? "Coba tempat yang lebih teduh atau sejuk, lalu ukur lagi." : "Minta bantuan untuk mencari tempat yang sedikit lebih hangat, lalu ukur lagi.", en: mismatch.direction === "high" ? "Try a cooler or shaded place, then measure again." : "Ask for help finding a slightly warmer place, then measure again." },
    airHumidity: { id: "Periksa kelembapan udara ruangan; ini bukan perintah untuk menyiram tanah.", en: "Check room air humidity; this is not an instruction to water the soil." },
    light: { id: "Saat siang, coba tempat yang lebih terang dan aman, lalu periksa sensor lagi.", en: "During daytime, try a brighter safe place, then check the sensor again." },
    soilPh: { id: "Tunjukkan hasil ini kepada guru atau orang dewasa; jangan menambahkan bahan kimia sendiri.", en: "Show this result to a teacher or adult; do not add chemicals yourself." },
  };
  const range = `${condition.preferredMin ?? "?"}–${condition.preferredMax ?? "?"}`;
  const factualFallback = locale === "id"
    ? `${label} adalah perbedaan terbesar: ${condition.current} berada ${direction} rentang referensi ${range}. ${safeAction[mismatch.parameter].id}`
    : `${label} is the largest mismatch: ${condition.current} is ${direction} the reference range ${range}. ${safeAction[mismatch.parameter].en}`;
  const fallback = personality === "funny" ? (locale === "id" ? `Ups, ${crop.displayName} menemukan satu bagian yang belum nyaman. ${factualFallback}` : `Oops, ${crop.displayName} found one not-so-cozy clue. ${factualFallback}`)
    : personality === "energetic" ? (locale === "id" ? `Ayo perbaiki satu hal dulu! ${factualFallback}` : `Let’s improve one thing first! ${factualFallback}`)
    : personality === "cute" ? (locale === "id" ? `Boleh bantu aku mencoba tempat yang lebih cocok? 🌱 ${factualFallback}` : `Could you help me try a cozier spot? 🌱 ${factualFallback}`)
    : personality === "shy" ? (locale === "id" ? `Um… aku menemukan satu perbedaan. ${factualFallback}` : `Um… I found one difference. ${factualFallback}`)
    : factualFallback;
  const summary = `Crop=${crop.displayName}. Analyzer largest mismatch=${mismatch.parameter}, direction=${mismatch.direction}, current=${condition.current}, reference min=${condition.preferredMin}, reference max=${condition.preferredMax}. Allowed recommendation=${safeAction[mismatch.parameter][locale]}`;
  return (await generateAiMessage({ kind: "ENVIRONMENT_ANALYSIS", personality, plantName: crop.displayName, environmentSummary: summary, locale })) ?? fallback;
}
