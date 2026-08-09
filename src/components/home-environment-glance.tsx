import Link from "next/link";
import type { SensorSnapshot } from "@/lib/crop-profiles";
import type { AppLocale } from "@/lib/i18n";

const METRICS = [
  { key: "temperature", icon: "🌡️", id: "Suhu", en: "Temperature", suffix: "°C", tone: "heat" },
  { key: "humidity", icon: "💧", id: "Kelembapan", en: "Air humidity", suffix: "%", tone: "water" },
  { key: "soilPh", icon: "🧪", id: "pH tanah", en: "Soil pH", suffix: "", tone: "soil" },
  { key: "light", icon: "☀️", id: "Cahaya", en: "Light", suffix: "%", tone: "light" },
] as const;

export default function HomeEnvironmentGlance({ snapshot, locale }: { snapshot: SensorSnapshot | null; locale: AppLocale }) {
  return (
    <section className="pm-home-environment" aria-labelledby="home-environment-title">
      <div className="pm-home-environment-head">
        <div>
          <span className="pm-home-environment-kicker">{locale === "id" ? "SENSOR TERKINI" : "LATEST SENSORS"}</span>
          <h2 id="home-environment-title">{locale === "id" ? "Lingkungan kebunku" : "My garden environment"}</h2>
        </div>
        <Link href="/plants">{locale === "id" ? "Jelajahi →" : "Explore →"}</Link>
      </div>
      <div className="pm-home-environment-grid">
        {METRICS.map((metric) => {
          const value = snapshot?.[metric.key];
          return (
            <article key={metric.key} className={`pm-home-sensor pm-home-sensor-${metric.tone}`}>
              <span className="pm-home-sensor-icon" aria-hidden="true">{metric.icon}</span>
              <div><span>{locale === "id" ? metric.id : metric.en}</span><strong>{value == null ? "—" : `${value}${metric.suffix}`}</strong></div>
            </article>
          );
        })}
      </div>
      <p>{snapshot?.recordedAt
        ? `${locale === "id" ? "Pembacaan sensor nyata" : "Real sensor reading"} · ${snapshot.recordedAt}`
        : locale === "id" ? "Menunggu pembacaan sensor" : "Waiting for sensor reading"}</p>
    </section>
  );
}
