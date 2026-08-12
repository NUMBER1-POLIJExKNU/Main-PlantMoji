// The app's destinations, named once.
//
// Two surfaces picture the same place: the sidebar rail
// (components/reno-app-shell.tsx) and the header of the board it opens
// (components/page-header.tsx). They each kept a private list, so the rail
// showed the designer's drawn icon while the board showed an unrelated emoji
// for the same destination — Quests was a drawn scroll in the rail and a 🎯 on
// the page, Crop Explorer a map and a 🌱, Monitoring a dish and a 📈, and
// Collection managed two different emoji for itself. Anything that has to
// picture a destination reads it from here now, and tests/nav-destinations
// pins every route's header to the entry it belongs to.
//
// `art` is the designer's icon (public/icons, exported from images/icons);
// `icon` is the emoji it replaced and is kept as the fallback for any entry
// whose drawing is still missing — every destination has one now. The static
// farm shell renders the same set from public/farm/index.html, so a file added
// here belongs there too.

export interface NavDestination {
  key: string;
  href: string;
  /** Shown only where `art` is null — the designer hasn't drawn this one yet. */
  icon: string;
  art: string | null;
  id: string;
  en: string;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { key: "home", href: "/", icon: "🌱", art: "/icons/my-garden.png", id: "Kebun Saya", en: "My Garden" },
  { key: "quests", href: "/quests", icon: "💚", art: "/icons/quests.png", id: "Misi", en: "Quests" },
  { key: "plants", href: "/plants", icon: "🗺️", art: "/icons/crop-explorer.png", id: "Eksplor Tanaman", en: "Crop Explorer" },
  { key: "camera", href: "/camera", icon: "📷", art: "/icons/camera-ai.png", id: "Kamera AI", en: "Camera AI" },
  { key: "diary", href: "/diary", icon: "📖", art: "/icons/growth-diary.png", id: "Diari Tumbuh", en: "Growth Diary" },
  { key: "collection", href: "/collection", icon: "💎", art: "/icons/collection.png", id: "Koleksi", en: "Collection" },
  { key: "shop", href: "/shop", icon: "🛒", art: "/icons/shop.png", id: "Toko", en: "Shop" },
];

export const NAV_TOOLS: readonly NavDestination[] = [
  { key: "status", href: "/monitoring", icon: "📡", art: "/icons/monitoring.png", id: "Pemantauan", en: "Monitoring" },
  { key: "reports", href: "/reports", icon: "📜", art: "/icons/reports.png", id: "Laporan", en: "Reports" },
  { key: "settings", href: "/settings", icon: "🧰", art: "/icons/settings.png", id: "Pengaturan", en: "Settings" },
];

export const ALL_DESTINATIONS: readonly NavDestination[] = [...NAV_DESTINATIONS, ...NAV_TOOLS];

/** The entry for a destination key, or null when nothing claims that key. */
export function navDestination(key: string): NavDestination | null {
  return ALL_DESTINATIONS.find((entry) => entry.key === key) ?? null;
}
