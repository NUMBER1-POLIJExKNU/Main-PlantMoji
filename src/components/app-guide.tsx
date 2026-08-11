"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";
import { seen } from "@/lib/seen";
import CoachMark, { type CoachCard } from "@/components/coach-mark";

// The home tour's seen.ts id — the shared store's one-time migration maps
// the old per-feature localStorage flag onto this exact id (see LEGACY_KEYS
// in src/lib/seen.ts), so a player who already saw the pre-migration tour
// never sees it replay.
const GUIDE_ID = "guide.home";

const cardSets: Record<AppLocale, CoachCard[]> = {
  en: [
    { emoji: "🌱", title: "MEET JAMKACHU", text: "The real environment changes how Jamkachu feels.", target: ".pm-mascot", dare: { label: "Tap Jamkachu" } },
    { emoji: "📡", title: "READ THE SENSORS", text: "Temperature, air, soil pH, and light come from the plant area.", target: ".pm-home-environment", dare: { label: "Show the four readings" } },
    { emoji: "😊", title: "WATCH THE MOOD", text: "Jamkachu turns sensor clues into an expression you can understand.", target: ".pm-home-mood-badge", dare: { label: "Check the mood" } },
    { emoji: "🎯", title: "OPEN A MISSION", text: "Change the real environment. Buttons alone cannot finish a mission.", target: ".pm-home-quest", dare: { label: "Open today’s mission" } },
    { emoji: "⭐", title: "VERIFY AND GROW", text: "The sensor confirms recovery before XP and growth are awarded.", dare: { label: "Start playing" } },
  ],
  id: [
    { emoji: "🌱", title: "KENALI JAMKACHU", text: "Lingkungan asli mengubah perasaan Jamkachu.", target: ".pm-mascot", dare: { label: "Ketuk Jamkachu" } },
    { emoji: "📡", title: "BACA SENSOR", text: "Suhu, udara, pH tanah, dan cahaya berasal dari area tanaman.", target: ".pm-home-environment", dare: { label: "Lihat empat pengukuran" } },
    { emoji: "😊", title: "LIHAT SUASANA", text: "Jamkachu mengubah petunjuk sensor menjadi ekspresi yang mudah dipahami.", target: ".pm-home-mood-badge", dare: { label: "Periksa suasana" } },
    { emoji: "🎯", title: "BUKA MISI", text: "Ubah lingkungan asli. Tombol saja tidak bisa menyelesaikan misi.", target: ".pm-home-quest", dare: { label: "Buka misi hari ini" } },
    { emoji: "⭐", title: "VERIFIKASI & TUMBUH", text: "Sensor memastikan pemulihan sebelum XP dan pertumbuhan diberikan.", dare: { label: "Mulai bermain" } },
  ],
} as const;

const secondaryLabels: Record<AppLocale, { back: string; later: string; skip: string }> = {
  en: { back: "Back", later: "Later", skip: "Skip" },
  id: { back: "Kembali", later: "Nanti", skip: "Lewati" },
};

export default function AppGuide({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const cards = cardSets[locale];
  const labels = secondaryLabels[locale];

  const start = useCallback(() => {
    if (pathname !== "/") { router.push("/"); window.setTimeout(() => { setOpen(true); }, 250); return; }
    setOpen(true);
  }, [pathname, router]);

  // First visit to the home tab, once ever: same auto-open the flag-based
  // version had, just reading through the shared store instead.
  useEffect(() => {
    const shouldOpen = pathname === "/" && !seen(GUIDE_ID);
    const timer = shouldOpen ? window.setTimeout(() => setOpen(true), 0) : null;
    return () => { if (timer !== null) window.clearTimeout(timer); };
  }, [pathname]);

  // Replay path: any surface can re-open the tour by dispatching this event
  // (see replay-guide-button.tsx) — unchanged by the store migration.
  useEffect(() => {
    const listener = () => start();
    window.addEventListener("plantmoji:open-guide", listener);
    return () => window.removeEventListener("plantmoji:open-guide", listener);
  }, [start]);

  return <div className="app-guide-root">
    <button ref={guideButtonRef} type="button" className="pm-guide-button" aria-label={locale === "id" ? "Buka panduan" : "Open guide"} onClick={start}>?</button>
    {open && <CoachMark
      id={GUIDE_ID}
      cards={cards}
      onDone={() => setOpen(false)}
      backLabel={labels.back}
      laterLabel={labels.later}
      skipLabel={labels.skip}
      restoreFocusTo={() => guideButtonRef.current}
    />}
  </div>;
}
