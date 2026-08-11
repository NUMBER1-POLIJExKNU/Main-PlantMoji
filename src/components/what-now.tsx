"use client";
import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";
import type { PlantMood } from "@/types/events";
export default function WhatNow({ locale, mood, questStatus }: { locale: AppLocale; mood: PlantMood; questStatus?: string | null }) {
  const verifying = questStatus === "VERIFYING"; const hasQuest = questStatus === "ACTIVE" || verifying;
  const advice = verifying ? (locale === "id" ? "Biarkan kondisi tetap stabil sampai sensor selesai memeriksa." : "Keep conditions steady while the sensor finishes checking.") : hasQuest ? (locale === "id" ? "Buka misi, lakukan satu perubahan nyata, lalu ukur lagi." : "Open the mission, make one real change, then measure again.") : mood === "Happy" ? (locale === "id" ? "Jamkachu nyaman. Coba jelajahi tanaman Jember." : "Jamkachu is comfortable. Explore which Jember crops fit here.") : (locale === "id" ? "Periksa suasana Jamkachu dan buka misi perawatan." : "Check Jamkachu’s mood and open the care mission.");
  const href = hasQuest || mood !== "Happy" ? "/quests" : "/plants";
  return <details className="pm-what-now" open><summary>❓ {locale === "id" ? "LANGKAH BERIKUTNYA" : "YOUR NEXT STEP"}</summary><p>{advice}</p><Link href={href}>{locale === "id" ? "MULAI SEKARANG" : "START NOW"} →</Link></details>;
}
