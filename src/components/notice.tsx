// Shared setup/error state. It deliberately uses the same farm panel and page
// measure as healthy routes so a transient backend problem never appears to
// switch the user into a different application.

export interface NoticeProps {
  title: string;
  lines: string[];
}

export default function Notice({ title, lines }: NoticeProps) {
  return (
    <main className="reno-notice-page">
      <section className="pm-panel reno-notice-card" role="status">
        <span className="text-5xl" role="img" aria-hidden="true">
          🌱
        </span>
        <p className="pm-page-eyebrow">PLANT MOJI</p>
        <h1 className="pm-heading">{title}</h1>
        <div className="reno-notice-lines">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
