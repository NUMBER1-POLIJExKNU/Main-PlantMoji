import "server-only";

import { cookies } from "next/headers";
import { APP_LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { APP_SKIN_COOKIE, APP_THEME_COOKIE, normalizeFarmSkin, normalizeTheme, resolveTheme } from "@/lib/appearance";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(APP_LOCALE_COOKIE)?.value);
}

export async function getRequestAppearance() {
  const cookieStore = await cookies();
  const theme = normalizeTheme(cookieStore.get(APP_THEME_COOKIE)?.value);
  const skin = normalizeFarmSkin(cookieStore.get(APP_SKIN_COOKIE)?.value);
  return { theme, resolvedTheme: resolveTheme(theme), skin };
}
