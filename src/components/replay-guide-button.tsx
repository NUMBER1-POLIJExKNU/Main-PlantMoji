"use client";
import type { AppLocale } from "@/lib/i18n";
export default function ReplayGuideButton({ locale }: { locale: AppLocale }) {
  return <button type="button" className="pm-panel mt-5 flex w-full items-center gap-3 text-left" onClick={() => window.dispatchEvent(new Event("plantmoji:open-guide"))}><span className="text-3xl" aria-hidden="true">🎮</span><span><strong className="block text-sm">{locale === "id" ? "Mainkan ulang Cara Bermain" : "Replay How to Play"}</strong><small>{locale === "id" ? "Pelajari sensor, suasana, misi, dan hadiah" : "Learn sensors, moods, missions, and rewards"}</small></span></button>;
}
