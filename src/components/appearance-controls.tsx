"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import {
  FARM_SKIN_CATALOG,
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
  const pathname = usePathname();
  const [theme, setTheme] = useState(initialTheme);
  const [skin, setSkin] = useState(initialSkin);
  const [previewSkin, setPreviewSkin] = useState(initialSkin);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const pickerDialogRef = useRef<HTMLElement>(null);

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
  const saveSkin = (value: string) => {
    const next = normalizeFarmSkin(value);
    setSkin(next);
    window.localStorage.setItem(APP_SKIN_COOKIE, next);
    document.cookie = `${APP_SKIN_COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    applyAppearance(theme, next);
  };

  const preview = (value: FarmSkin) => {
    setPreviewSkin(value);
    applyAppearance(theme, value);
  };
  const openPicker = () => {
    setPreviewSkin(skin);
    setPickerOpen(true);
  };
  const cancelPicker = () => {
    applyAppearance(theme, skin);
    setPreviewSkin(skin);
    setPickerOpen(false);
  };
  const applyPicker = () => {
    saveSkin(previewSkin);
    setPickerOpen(false);
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const returnFocusTo = pickerTriggerRef.current;
    const focusTimer = window.setTimeout(() => pickerDialogRef.current?.querySelector<HTMLElement>("button,a[href]")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        applyAppearance(theme, skin);
        setPreviewSkin(skin);
        setPickerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(pickerDialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]") ?? []);
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      window.setTimeout(() => returnFocusTo?.focus(), 0);
    };
  }, [pickerOpen, skin, theme]);
  const selectedDefinition = FARM_SKIN_CATALOG.find((item) => item.key === skin) ?? FARM_SKIN_CATALOG[0];

  return (
    <div className={`reno-appearance-controls${pathname.startsWith("/settings") ? " is-settings" : ""}`} aria-label={locale === "id" ? "Tampilan" : "Appearance"}>
      <label><span>{locale === "id" ? "WAKTU" : "THEME"}</span><select value={theme} onChange={(event) => changeTheme(event.target.value)}>
        <option value="auto">{locale === "id" ? "Otomatis" : "Auto"}</option>
        <option value="day">{locale === "id" ? "Siang" : "Day"}</option>
        <option value="night">{locale === "id" ? "Malam" : "Night"}</option>
      </select></label>
      <div className="reno-skin-control">
        <span>{locale === "id" ? "LATAR" : "SKIN"}</span>
        <button type="button" className="reno-skin-open" onClick={openPicker} aria-haspopup="dialog" ref={pickerTriggerRef}>
          <span aria-hidden="true">{selectedDefinition.icon}</span>
          <span>{selectedDefinition.name[locale]}</span>
        </button>
      </div>
      {pickerOpen && (
        <div className="reno-skin-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelPicker(); }}>
          <section className="reno-skin-picker pm-panel" role="dialog" aria-modal="true" aria-labelledby="reno-skin-title" ref={pickerDialogRef}>
            <header className="reno-skin-picker-head">
              <div><p>{locale === "id" ? "DUNIAKU" : "MY WORLD"}</p><h2 id="reno-skin-title">{locale === "id" ? "Pilih latar Jember" : "Choose a Jember skin"}</h2></div>
              <button type="button" onClick={cancelPicker} aria-label={locale === "id" ? "Tutup" : "Close"}>×</button>
            </header>
            <p className="reno-skin-picker-help">{locale === "id" ? "Pilih kartu untuk melihat pratinjau. Simpan hanya saat kamu siap." : "Choose a card to preview it. Save only when you are ready."}</p>
            <div className="reno-skin-grid">
              {FARM_SKIN_CATALOG.map((item) => (
                <button key={item.key} type="button" className={`reno-skin-card${previewSkin === item.key ? " active" : ""}`} aria-pressed={previewSkin === item.key} onClick={() => preview(item.key)}>
                  <span className="reno-skin-preview" data-preview-skin={item.key} style={{ "--preview-sky": item.colors[0], "--preview-land": item.colors[1], "--preview-accent": item.colors[2] } as CSSProperties}><i>{item.icon}</i></span>
                  <span className="reno-skin-card-copy"><strong>{item.name[locale]}</strong><small>{item.description[locale]}</small></span>
                  {previewSkin === item.key && <b aria-hidden="true">✓</b>}
                </button>
              ))}
            </div>
            <footer className="reno-skin-actions">
              <button type="button" className="pm-btn" onClick={cancelPicker}>{locale === "id" ? "Batal" : "Cancel"}</button>
              <button type="button" className="pm-btn pm-btn-primary" onClick={applyPicker}>{locale === "id" ? "Pakai latar" : "Apply skin"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
