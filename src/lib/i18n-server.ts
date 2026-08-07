import "server-only";

import { cookies } from "next/headers";
import { APP_LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(APP_LOCALE_COOKIE)?.value);
}
