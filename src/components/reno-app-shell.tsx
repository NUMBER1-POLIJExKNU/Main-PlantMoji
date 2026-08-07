"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/plants", icon: "🌱", label: "Plants" },
  { href: "/reports", icon: "📈", label: "Monitoring" },
  { href: null, icon: "📷", label: "Camera AI" },
  { href: "/quests", icon: "📜", label: "History" },
  { href: "/collection", icon: "🏆", label: "Achievements" },
  { href: null, icon: "🛒", label: "Shop" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
] as const;

export default function RenoAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
              if (!item.href) {
                return (
                  <span key={item.label} className="reno-nav-item reno-nav-disabled" aria-disabled="true">
                    <i>{item.icon}</i> {item.label}
                  </span>
                );
              }

              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`reno-nav-item${active ? " active" : ""}`}
                >
                  <i>{item.icon}</i> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="reno-route-content">{children}</div>
      </div>
    </div>
  );
}
