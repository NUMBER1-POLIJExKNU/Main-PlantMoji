// Shared setup/error state. It deliberately uses the same farm panel and page
// measure as healthy routes so a transient backend problem never appears to
// switch the user into a different application.

import type { AppLocale } from "@/lib/i18n";

export interface NoticeProps {
  title: string;
  lines: string[];
  locale?: AppLocale;
}

export default function Notice({ title, lines, locale = "en" }: NoticeProps) {
  const id = locale === "id";
  const technical = /supabase|postgrest|migration|milestone\d+|\.sql|environment variable|schema|plant-01|docs\//i;
  const safeTitle = technical.test(title) ? (id ? "Kebun sedang beristirahat" : "The garden is resting") : title;
  const safeLines = lines.some((line) => technical.test(line))
    ? (id ? ["PlantMoji belum bisa memuat kebun ini.", "Periksa koneksi, lalu coba lagi sebentar."] : ["PlantMoji could not load this garden right now.", "Check the connection, then try again in a moment."])
    : lines;
  return (
    <main className="reno-notice-page">
      <section className="pm-panel reno-notice-card" role="status">
        <span className="text-5xl" role="img" aria-hidden="true">
          🌱
        </span>
        <p className="pm-page-eyebrow">PLANT MOJI</p>
        <h1 className="pm-heading">{safeTitle}</h1>
        <div className="reno-notice-lines">
          {safeLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <a className="pm-btn pm-btn-primary mt-4" href="">{id ? "Coba lagi" : "Try again"}</a>
      </section>
    </main>
  );
}
