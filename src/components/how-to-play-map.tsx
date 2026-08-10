import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";

const LOOP = {
  en: [
    { icon: "◉", label: "SENSE", hint: "Read live values", href: "/monitoring" },
    { icon: "⌕", label: "UNDERSTAND", hint: "Find the cause", href: "/plants" },
    { icon: "✦", label: "ACT", hint: "Try one change", href: "/quests" },
    { icon: "✓", label: "VERIFY", hint: "Let sensors check", href: "/quests" },
    { icon: "+", label: "REWARD", hint: "Collect XP", href: "/collection" },
    { icon: "↑", label: "GROW", hint: "Save the memory", href: "/diary" },
  ],
  id: [
    { icon: "◉", label: "RASAKAN", hint: "Baca nilai langsung", href: "/monitoring" },
    { icon: "⌕", label: "PAHAMI", hint: "Cari penyebab", href: "/plants" },
    { icon: "✦", label: "BERTINDAK", hint: "Coba satu perubahan", href: "/quests" },
    { icon: "✓", label: "PERIKSA", hint: "Biarkan sensor memeriksa", href: "/quests" },
    { icon: "+", label: "HADIAH", hint: "Kumpulkan XP", href: "/collection" },
    { icon: "↑", label: "TUMBUH", hint: "Simpan kenangan", href: "/diary" },
  ],
} as const;

export default function HowToPlayMap({ locale }: { locale: AppLocale }) {
  return (
    <section className="pm-play-map" aria-labelledby="pm-play-map-title">
      <header>
        <span aria-hidden="true">🗺️</span>
        <div>
          <h2 id="pm-play-map-title">{locale === "id" ? "CARA BERMAIN" : "HOW TO PLAY"}</h2>
          <p>{locale === "id" ? "Pilih langkah untuk langsung mencobanya." : "Pick a step to try it now."}</p>
        </div>
      </header>
      <ol>
        {LOOP[locale].map((step, index) => (
          <li key={step.label}>
            <Link href={step.href} aria-label={`${index + 1}. ${step.label}: ${step.hint}`}>
              <b aria-hidden="true">{step.icon}</b>
              <span><strong>{step.label}</strong><small>{step.hint}</small></span>
              <i aria-hidden="true">{index < LOOP[locale].length - 1 ? "›" : "↻"}</i>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
