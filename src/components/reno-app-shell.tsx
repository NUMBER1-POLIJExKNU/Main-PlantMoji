"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_LOCALE_COOKIE, type AppLocale } from "@/lib/i18n";
import type { AppTheme, FarmSkin } from "@/lib/appearance";
import AppearanceControls from "@/components/appearance-controls";
import AppGuide from "@/components/app-guide";
import BroadcastOverlay from "@/components/broadcast-overlay";
import LiveActivityBar from "@/components/live-activity-bar";
import NetworkStatus from "@/components/network-status";

// The static farm home and every React route share five game destinations,
// with operational views tucked into a small tool pocket. Keep
// public/farm/index.html in sync until the static home has been retired.
const NAV_ITEMS = [
  { key: "home", href: "/", icon: "🌱", id: "Kebun Saya", en: "My Garden" },
  { key: "quests", href: "/quests", icon: "💚", id: "Misi", en: "Quests" },
  { key: "plants", href: "/plants", icon: "🗺️", id: "Eksplor Tanaman", en: "Crop Explorer" },
  { key: "camera", href: "/camera", icon: "📷", id: "Kamera AI", en: "Camera AI" },
  { key: "diary", href: "/diary", icon: "📖", id: "Diari Tumbuh", en: "Growth Diary" },
  { key: "collection", href: "/collection", icon: "💎", id: "Koleksi", en: "Collection" },
  { key: "shop", href: "/shop", icon: "🛒", id: "Toko", en: "Shop" },
] as const;
const TOOL_ITEMS = [
  { key: "status", href: "/monitoring", icon: "📡", id: "Pemantauan", en: "Monitoring" },
  { key: "reports", href: "/reports", icon: "📜", id: "Laporan", en: "Reports" },
  { key: "settings", href: "/settings", icon: "🧰", id: "Pengaturan", en: "Settings" },
] as const;

function changeAppLocale(nextLocale: AppLocale) {
  document.cookie = `${APP_LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
  window.localStorage.setItem(APP_LOCALE_COOKIE, nextLocale);
  window.location.reload();
}

export default function RenoAppShell({ children, locale, initialTheme, initialSkin }: { children: React.ReactNode; locale: AppLocale; initialTheme: AppTheme; initialSkin: FarmSkin }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  // LiveActivityBar polls /api/sensor-history every 5s. That ops-telemetry
  // strip belongs on the home dashboard and the Monitoring tool, not on
  // every route (quests, camera, diary, etc.) — restricting where it
  // mounts also stops the 5s interval entirely on the other routes, since
  // its effect cleanup runs on unmount.
  const showLiveActivityBar = isHome || pathname.startsWith("/monitoring");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreSheetRef = useRef<HTMLElement>(null);
  const overflowItems = [...NAV_ITEMS.slice(5), ...TOOL_ITEMS];
  const moreActive = overflowItems.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo = moreButtonRef.current;
    const focusTimer = window.setTimeout(() => moreSheetRef.current?.querySelector<HTMLElement>("button,a[href]")?.focus(), 0);
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMoreOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(moreSheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]") ?? []);
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keepFocusInside);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keepFocusInside); window.setTimeout(() => returnFocusTo?.focus(), 0); };
  }, [moreOpen]);

  return (
    <div className="reno-app-shell">
      <NetworkStatus locale={locale} />
      <div className="reno-env-background" aria-hidden="true">
        <div className="reno-env-sun" />
        <div className="reno-env-cloud reno-env-cloud-1" />
        <div className="reno-env-cloud reno-env-cloud-2" />
        <div className="reno-env-cloud reno-env-cloud-3" />
        <div className="reno-env-particles" />
      </div>

      <div className="reno-app-layout">
        <aside className="reno-sidebar">
          <Link href="/" className="reno-brand" aria-label="PLANT MOJI home">
            <Image
              src="/farm/assets/logo.png"
              alt="PLANT MOJI logo"
              width={44}
              height={44}
              className="reno-logo"
              priority
            />
            <span>PLANT<br />MOJI</span>
          </Link>

          <nav className="reno-nav-links" aria-label="Main navigation">
            <span className="reno-nav-section-title">{locale === "id" ? "DUNIAKU" : "MY WORLD"}</span>
            {NAV_ITEMS.map((item) => {
              const label = locale === "id" ? item.id : item.en;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`reno-nav-item${["collection", "shop"].includes(item.key) ? " reno-nav-overflow" : ""}${active ? " active" : ""}`}
                  onClick={() => window.PMSfx?.play("tick")}
                >
                  <i>{item.icon}</i>
                  <span className="reno-nav-label">{label}</span>
                </Link>
              );
            })}
            <button ref={moreButtonRef} type="button" className={`reno-nav-item reno-more-button${moreActive ? " active" : ""}`} aria-expanded={moreOpen} aria-controls="reno-more-sheet" onClick={() => setMoreOpen((value) => !value)}>
              <i aria-hidden="true">•••</i><span className="reno-nav-label">{locale === "id" ? "Lainnya" : "More"}</span>
            </button>
            <div className="reno-nav-tool-pocket">
              <span className="reno-nav-section-title">{locale === "id" ? "ALAT" : "TOOLS"}</span>
              <div className="reno-nav-tool-grid">
                {TOOL_ITEMS.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return <Link key={item.key} href={item.href} title={locale === "id" ? item.id : item.en} aria-current={active ? "page" : undefined} className={`reno-nav-item reno-nav-tool${active ? " active" : ""}`} onClick={() => window.PMSfx?.play("tick")}><i>{item.icon}</i><span>{locale === "id" ? item.id : item.en}</span></Link>;
                })}
              </div>
            </div>
          </nav>

          {moreOpen && <div className="reno-more-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreOpen(false); }}>
            <section ref={moreSheetRef} id="reno-more-sheet" className="reno-more-sheet" role="dialog" aria-modal="true" aria-label={locale === "id" ? "Menu lainnya" : "More menu"}>
              <header><strong>{locale === "id" ? "TEMPAT LAIN" : "MORE PLACES"}</strong><button type="button" onClick={() => setMoreOpen(false)} aria-label={locale === "id" ? "Tutup" : "Close"}>×</button></header>
              <div>{overflowItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return <Link key={item.key} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={() => { setMoreOpen(false); window.PMSfx?.play("tick"); }}><i aria-hidden="true">{item.icon}</i><span>{locale === "id" ? item.id : item.en}</span><b aria-hidden="true">›</b></Link>;
              })}</div>
            </section>
          </div>}

          <div className="reno-locale-switch" role="group" aria-label="Language / Bahasa">
            {(["id", "en"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={locale === item}
                className={locale === item ? "active" : ""}
                onClick={() => changeAppLocale(item)}
              >
                {item === "id" ? "ID" : "EN"}
              </button>
            ))}
          </div>
          <AppearanceControls locale={locale} initialTheme={initialTheme} initialSkin={initialSkin} />
        </aside>

        <div className={`reno-route-content ${isHome ? "reno-route-home" : "reno-route-page"}`}>
          {showLiveActivityBar && <LiveActivityBar locale={locale} />}
          {children}
        </div>
      </div>
      <AppGuide locale={locale} />
      <BroadcastOverlay locale={locale} />
    </div>
  );
}
