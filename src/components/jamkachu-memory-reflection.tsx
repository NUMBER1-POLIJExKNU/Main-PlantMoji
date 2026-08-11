"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import { selectFeaturedMemory, type JamkachuMemory } from "@/lib/jamkachu-memory";

interface SnapshotPreview { url: string; date: string; stage: string }

export default function JamkachuMemoryReflection({ memories, locale, snapshot }: { memories: JamkachuMemory[]; locale: AppLocale; snapshot?: SnapshotPreview }) {
  const featured = useMemo(() => selectFeaturedMemory(memories), [memories]);
  const [selectedId, setSelectedId] = useState(featured?.id ?? null);
  const [reflection, setReflection] = useState(featured?.fallback ?? (locale === "id" ? "Kenangan kita dimulai dari sini. Aku tidak sabar menantikan waktu yang akan kita lalui bersama." : "Our memories begin here. I cannot wait for all the moments we will share together."));
  const [thinking, setThinking] = useState(false);
  const cache = useRef(new Map<string, string>());
  const selected = memories.find((memory) => memory.id === selectedId) ?? featured;

  useEffect(() => {
    if (!selected) return;
    const key = `${selected.id}|${locale}`;
    const cached = cache.current.get(key);
    setReflection(cached ?? selected.fallback);
    if (cached) return;
    const controller = new AbortController();
    setThinking(true);
    void fetch("/api/memory-reflection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: selected.id, locale }),
      signal: controller.signal,
    }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (typeof result?.reflection === "string") {
        cache.current.set(key, result.reflection);
        setReflection(result.reflection);
      }
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setThinking(false); });
    return () => controller.abort();
  }, [selected, locale]);

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Jakarta" }), [locale]);
  return (
    <section className="pm-panel pm-memory-stage mb-5" aria-labelledby="featured-memory-title">
      <div className="pm-memory-kicker">{locale === "id" ? "KENANGAN PILIHAN" : "FEATURED MEMORY"}</div>
      {snapshot && <figure className="pm-memory-snapshot">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase Storage URL */}
        <img src={snapshot.url} alt={locale === "id" ? `Snapshot pertumbuhan Jamkachu, ${snapshot.date}` : `Jamkachu growth snapshot, ${snapshot.date}`} />
        <figcaption><b>{locale === "id" ? "JEPRET! SNAPSHOT TERBARU" : "SNAP! LATEST SNAPSHOT"}</b><span>{snapshot.date} · {snapshot.stage}</span></figcaption>
      </figure>}
      <div className="pm-memory-scene">
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
        <img className="pm-memory-jamkachu" src="/farm/assets/jamkachu/2x/plant-p3-flower-happy.png" alt="" aria-hidden="true" draggable={false} />
        <div className={`pm-memory-bubble${thinking ? " is-thinking" : ""}`} role="status" aria-live="polite">
          <p>{reflection}</p>
          {thinking && <span>{locale === "id" ? "Jamkachu sedang mengingat…" : "Jamkachu is remembering…"}</span>}
        </div>
      </div>
      {selected && <div className="pm-memory-feature-meta"><strong id="featured-memory-title">{selected.title}</strong><span>{dateFormat.format(new Date(selected.occurredAt))}</span></div>}
      {memories.length > 0 && <details className="pm-memory-more"><summary>{locale === "id" ? `Lihat kenangan lain (${memories.length})` : `More memories (${memories.length})`}</summary><div className="pm-memory-picker" aria-label={locale === "id" ? "Pilih kenangan" : "Choose a memory"}>
        {memories.map((memory) => <button key={memory.id} type="button" className={memory.id === selected?.id ? "is-selected" : ""} aria-pressed={memory.id === selected?.id} onClick={() => setSelectedId(memory.id)}><strong>{memory.title}</strong><span>{dateFormat.format(new Date(memory.occurredAt))}</span></button>)}
      </div></details>}
    </section>
  );
}
