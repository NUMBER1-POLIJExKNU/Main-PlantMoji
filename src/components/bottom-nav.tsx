"use client";

// Fixed bottom tab bar (handoff §33 navigation) — the app's Tamagotchi
// "shell". Every page renders this; content pages add pb-24 so the bar
// never covers the last card.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", emoji: "🌱", label: "Home" },
  { href: "/quests", emoji: "🎯", label: "Quests" },
  { href: "/collection", emoji: "📖", label: "Collection" },
  { href: "/reports", emoji: "📊", label: "Report" },
  { href: "/settings", emoji: "⚙️", label: "Settings" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? "text-green-700 dark:text-green-400"
                  : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              <span
                className={`text-xl leading-none ${active ? "" : "opacity-60 grayscale"}`}
                role="img"
                aria-hidden="true"
              >
                {tab.emoji}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
