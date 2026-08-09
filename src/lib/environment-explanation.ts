import "server-only";

import { generateAiMessage } from "@/lib/ai";
import type { AdvisoryStatus, CropProfile, SensorSnapshot } from "@/lib/crop-profiles";
import type { EnvironmentAnalysis, EnvironmentParameter } from "@/lib/environment-analyzer";
import type { AppLocale } from "@/lib/i18n";
import type { ExplorerCrop } from "@/lib/jember-crop-catalog";

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
    fact("binary light", snapshot?.light == null ? "missing" : String(snapshot.light), result.light, result.light === "Low" ? "check for a brighter safe daytime spot" : "keep observing"),
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

export async function explainCropMismatch(crop: ExplorerCrop, analysis: EnvironmentAnalysis, locale: AppLocale) {
  const mismatch = analysis.largestMismatch;
  if (!mismatch) return locale === "id"
    ? `${analysis.matchedConditions} dari ${analysis.evaluatedConditions} kondisi terukur cocok. Pertahankan kondisi dan amati lagi nanti.`
    : `${analysis.matchedConditions} of ${analysis.evaluatedConditions} measured conditions match. Keep conditions steady and observe again later.`;
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
  const fallback = locale === "id"
    ? `${label} adalah perbedaan terbesar: ${condition.current} berada ${direction} rentang referensi ${range}. ${safeAction[mismatch.parameter].id}`
    : `${label} is the largest mismatch: ${condition.current} is ${direction} the reference range ${range}. ${safeAction[mismatch.parameter].en}`;
  const summary = `Crop=${crop.displayName}. Analyzer largest mismatch=${mismatch.parameter}, direction=${mismatch.direction}, current=${condition.current}, reference min=${condition.preferredMin}, reference max=${condition.preferredMax}. Allowed recommendation=${safeAction[mismatch.parameter][locale]}`;
  return (await generateAiMessage({ kind: "ENVIRONMENT_ANALYSIS", personality: "calm", plantName: crop.displayName, environmentSummary: summary, locale })) ?? fallback;
}
