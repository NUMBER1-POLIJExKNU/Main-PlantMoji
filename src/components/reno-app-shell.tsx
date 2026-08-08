"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOCALE_COOKIE, type AppLocale } from "@/lib/i18n";

// The static farm home and every React route use this same seven-destination
// information architecture. Keep public/farm/index.html in sync until the
// static home has been fully retired.
const NAV_ITEMS = [
  { key: "home", href: "/", icon: "🏠", id: "Beranda", en: "Home" },
  { key: "quests", href: "/quests", icon: "📜", id: "Misi", en: "Quests" },
  { key: "plants", href: "/plants", icon: "🌾", id: "Tanaman", en: "Plants" },
  { key: "status", href: "/monitoring", icon: "📈", id: "Dashboard", en: "Dashboard" },
  { key: "collection", href: "/collection", icon: "🏆", id: "Koleksi", en: "Collection" },
  { key: "reports", href: "/reports", icon: "📊", id: "Laporan", en: "Report" },
  { key: "settings", href: "/settings", icon: "⚙️", id: "Pengaturan", en: "Settings" },
] as const;

function changeAppLocale(nextLocale: AppLocale) {
  document.cookie = `${APP_LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
  window.localStorage.setItem(APP_LOCALE_COOKIE, nextLocale);
  window.location.reload();
}

export default function RenoAppShell({ children, locale }: { children: React.ReactNode; locale: AppLocale }) {
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
        </aside>

        <div className={`reno-route-content ${isHome ? "reno-route-home" : "reno-route-page"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
