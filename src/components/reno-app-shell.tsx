"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOCALE_COOKIE, type AppLocale } from "@/lib/i18n";
import type { AppTheme, FarmSkin } from "@/lib/appearance";
import AppearanceControls from "@/components/appearance-controls";

// The static farm home and every React route share five game destinations,
// with operational views tucked into a small tool pocket. Keep
// public/farm/index.html in sync until the static home has been retired.
const NAV_ITEMS = [
  { key: "home", href: "/", icon: "🌱", id: "Kebun Saya", en: "My Garden" },
  { key: "quests", href: "/quests", icon: "💚", id: "Misi", en: "Quests" },
  { key: "plants", href: "/plants", icon: "🗺️", id: "Eksplor Tanaman", en: "Crop Explorer" },
  { key: "camera", href: "/camera", icon: "📷", id: "Kamera AI", en: "AI Camera" },
  { key: "diary", href: "/diary", icon: "📖", id: "Diari Tumbuh", en: "Growth Diary" },
  { key: "collection", href: "/collection", icon: "💎", id: "Koleksi", en: "Collection" },
  { key: "shop", href: "/shop", icon: "🛒", id: "Toko", en: "Shop" },
] as const;
const TOOL_ITEMS = [
  { key: "status", href: "/monitoring", icon: "📡", id: "Sensor", en: "Sensors" },
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

  return (
    <div className="reno-app-shell">
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
                  className={`reno-nav-item${active ? " active" : ""}`}
                  onClick={() => window.PMSfx?.play("tick")}
                >
                  <i>{item.icon}</i>
                  <span className="reno-nav-label">{label}</span>
                </Link>
              );
            })}
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
          {children}
        </div>
      </div>
    </div>
  );
}
