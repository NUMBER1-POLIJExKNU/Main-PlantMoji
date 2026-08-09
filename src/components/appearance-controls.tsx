"use client";

import { useEffect, useState } from "react";
import {
  APP_SKIN_COOKIE,
  APP_THEME_COOKIE,
  normalizeFarmSkin,
  normalizeTheme,
  resolveTheme,
  type AppTheme,
  type FarmSkin,
} from "@/lib/appearance";
import type { AppLocale } from "@/lib/i18n";

const MAX_AGE = 31_536_000;

function applyAppearance(theme: AppTheme, skin: FarmSkin) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.themePreference = theme;
  root.dataset.theme = resolved;
  root.dataset.farmSkin = skin;
  root.classList.toggle("dark", resolved === "night");
}

export default function AppearanceControls({ locale, initialTheme, initialSkin }: {
  locale: AppLocale; initialTheme: AppTheme; initialSkin: FarmSkin;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [skin, setSkin] = useState(initialSkin);

  useEffect(() => {
    applyAppearance(theme, skin);
    const timer = theme === "auto" ? window.setInterval(() => applyAppearance(theme, skin), 60_000) : undefined;
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [theme, skin]);

  const changeTheme = (value: string) => {
    const next = normalizeTheme(value);
    setTheme(next);
    window.localStorage.setItem(APP_THEME_COOKIE, next);
    document.cookie = `${APP_THEME_COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    applyAppearance(next, skin);
  };
  const changeSkin = (value: string) => {
    const next = normalizeFarmSkin(value);
    setSkin(next);
    window.localStorage.setItem(APP_SKIN_COOKIE, next);
    document.cookie = `${APP_SKIN_COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    applyAppearance(theme, next);
  };

  return (
    <div className="reno-appearance-controls" aria-label={locale === "id" ? "Tampilan" : "Appearance"}>
      <label><span>{locale === "id" ? "WAKTU" : "THEME"}</span><select value={theme} onChange={(event) => changeTheme(event.target.value)}>
        <option value="auto">{locale === "id" ? "Otomatis" : "Auto"}</option>
        <option value="day">{locale === "id" ? "Siang" : "Day"}</option>
        <option value="night">{locale === "id" ? "Malam" : "Night"}</option>
      </select></label>
      <label><span>{locale === "id" ? "LATAR" : "SKIN"}</span><select value={skin} onChange={(event) => changeSkin(event.target.value)}>
        <option value="jember-farm">Jember Farm</option>
        <option value="coffee-hills">Coffee Hills</option>
        <option value="greenhouse">Greenhouse</option>
      </select></label>
    </div>
  );
}
