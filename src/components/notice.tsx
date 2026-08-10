// Shared setup/error state. It deliberately uses the same farm panel and page
// measure as healthy routes so a transient backend problem never appears to
// switch the user into a different application.

export interface NoticeProps {
  title: string;
  lines: string[];
}

export default function Notice({ title, lines }: NoticeProps) {
  const technical = /supabase|postgrest|migration|milestone\d+|\.sql|environment variable|schema|plant-01|docs\//i;
  const safeTitle = technical.test(title) ? "The garden is resting" : title;
  const safeLines = lines.some((line) => technical.test(line))
    ? ["PlantMoji could not load this garden right now.", "Please try again in a moment."]
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
        <a className="pm-btn pm-btn-primary mt-4" href="">Try again</a>
      </section>
    </main>
  );
}
