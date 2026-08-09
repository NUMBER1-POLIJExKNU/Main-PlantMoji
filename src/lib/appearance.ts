export const APP_THEME_COOKIE = "plantmoji_theme";
export const APP_SKIN_COOKIE = "plantmoji_skin";

export const APP_THEMES = ["auto", "day", "night"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const FARM_SKINS = ["jember-farm", "coffee-hills", "greenhouse"] as const;
export type FarmSkin = (typeof FARM_SKINS)[number];

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
