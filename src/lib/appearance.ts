export const APP_THEME_COOKIE = "plantmoji_theme";
export const APP_SKIN_COOKIE = "plantmoji_skin";

export const APP_THEMES = ["auto", "day", "night"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const FARM_SKINS = [
  "jember-farm",
  "coffee-hills",
  "greenhouse",
  "tobacco-fields",
  "kakao-garden",
  "paddy-morning",
  "puger-coast",
  "argopuro-highlands",
] as const;
export type FarmSkin = (typeof FARM_SKINS)[number];

export interface FarmSkinDefinition {
  key: FarmSkin;
  icon: string;
  name: { id: string; en: string };
  description: { id: string; en: string };
  colors: readonly [string, string, string];
}

/** One source of truth for the appearance picker. Descriptions deliberately
 * say "inspired by": these are playful landscapes, not agronomy claims. */
export const FARM_SKIN_CATALOG: readonly FarmSkinDefinition[] = [
  { key: "jember-farm", icon: "🌱", name: { id: "Kebun Jember", en: "Jember Farm" }, description: { id: "Kebun belajar yang cerah dan ramah.", en: "A bright, friendly learning garden." }, colors: ["#a3e4ff", "#69c455", "#aa7e55"] },
  { key: "coffee-hills", icon: "☕", name: { id: "Bukit Kopi", en: "Coffee Hills" }, description: { id: "Terinspirasi perbukitan kopi Jember.", en: "Inspired by Jember's coffee-growing hills." }, colors: ["#b9e1d0", "#477348", "#6f4535"] },
  { key: "greenhouse", icon: "🏡", name: { id: "Rumah Kaca", en: "Greenhouse" }, description: { id: "Ruang tumbuh modern untuk bereksperimen.", en: "A modern growing space for experiments." }, colors: ["#d8f3ef", "#79c9a4", "#eaf9f4"] },
  { key: "tobacco-fields", icon: "🍃", name: { id: "Ladang Tembakau", en: "Tobacco Fields" }, description: { id: "Terinspirasi lanskap pertanian Jember.", en: "Inspired by Jember's agricultural landscape." }, colors: ["#f2d99b", "#96ad4d", "#a66e42"] },
  { key: "kakao-garden", icon: "🍫", name: { id: "Kebun Kakao", en: "Kakao Garden" }, description: { id: "Kebun teduh dengan warna buah kakao.", en: "A shaded garden with colorful cacao pods." }, colors: ["#b7ddc0", "#326447", "#d27635"] },
  { key: "paddy-morning", icon: "🌾", name: { id: "Pagi di Sawah", en: "Paddy Morning" }, description: { id: "Terinspirasi sawah dan pantulan pagi.", en: "Inspired by rice fields and morning reflections." }, colors: ["#bceafa", "#72bd79", "#64b8bd"] },
  { key: "puger-coast", icon: "🌊", name: { id: "Pesisir Puger", en: "Puger Coast" }, description: { id: "Angin laut dan cakrawala selatan Jember.", en: "Sea breeze and Jember's southern horizon." }, colors: ["#9adcf2", "#3d9fc2", "#e7c988"] },
  { key: "argopuro-highlands", icon: "⛰️", name: { id: "Dataran Tinggi Argopuro", en: "Argopuro Highlands" }, description: { id: "Pegunungan berlapis dan kabut sejuk.", en: "Layered mountains and cool drifting mist." }, colors: ["#cbd9d2", "#648b73", "#405e57"] },
] as const;

export function normalizeTheme(value: unknown): AppTheme {
  return APP_THEMES.includes(value as AppTheme) ? value as AppTheme : "auto";
}

export function normalizeFarmSkin(value: unknown): FarmSkin {
  return FARM_SKINS.includes(value as FarmSkin) ? value as FarmSkin : "jember-farm";
}

export function resolveTheme(theme: AppTheme, now = new Date()): "day" | "night" {
  if (theme !== "auto") return theme;
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", hour12: false, hourCycle: "h23", timeZone: "Asia/Jakarta",
  }).format(now));
  return hour >= 18 || hour < 6 ? "night" : "day";
}
