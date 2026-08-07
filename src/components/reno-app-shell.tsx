"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOCALE_COOKIE, NAV_COPY, type AppLocale } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", copyKey: "dashboard" },
  { href: "/plants", icon: "🌱", copyKey: "plants" },
  { href: "/reports", icon: "📈", copyKey: "monitoring" },
  { href: null, icon: "📷", copyKey: "camera" },
  { href: "/quests", icon: "📜", copyKey: "quests" },
  { href: "/collection", icon: "🏆", copyKey: "collection" },
  { href: null, icon: "🛒", copyKey: "shop" },
  { href: "/settings", icon: "⚙️", copyKey: "settings" },
] as const;

function changeAppLocale(nextLocale: AppLocale) {
  document.cookie = `${APP_LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
  window.localStorage.setItem(APP_LOCALE_COOKIE, nextLocale);
  window.location.reload();
}

export default function RenoAppShell({ children, locale }: { children: React.ReactNode; locale: AppLocale }) {
  const pathname = usePathname();
  const navCopy = NAV_COPY[locale];

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
          <Link href="/" className="reno-brand" aria-label="Plant Emoji dashboard">
            <Image
              src="/farm/assets/logo.png"
              alt="Plant Emoji logo"
              width={54}
              height={54}
              className="reno-logo"
              priority
            />
            <span>PLANT<br />EMOJI</span>
          </Link>

          <nav className="reno-nav-links" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const label = navCopy[item.copyKey];
              if (!item.href) {
                return (
                  <span key={item.copyKey} className="reno-nav-item reno-nav-disabled" aria-disabled="true">
                    <i>{item.icon}</i> {label}
                  </span>
                );
              }

              const active = pathname === item.href;
              return (
                <Link
                  key={item.copyKey}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`reno-nav-item${active ? " active" : ""}`}
                >
                  <i>{item.icon}</i> {label}
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

        <div className="reno-route-content">{children}</div>
      </div>
    </div>
  );
}
