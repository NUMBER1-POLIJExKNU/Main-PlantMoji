"use client";

import { useEffect, useState } from "react";
import { COMPANION_STAGES } from "@/types/game";
import { companionStageLabel, type AppLocale } from "@/lib/i18n";
import Mascot from "@/components/mascot";

export default function GrowthShowcase({ locale, onClose }: { locale: AppLocale; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stage = COMPANION_STAGES[index];

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setIndex((value) => {
      if (value >= COMPANION_STAGES.length - 1) { setPlaying(false); return value; }
      window.PMSfx?.play("evoChirp");
      window.setTimeout(() => window.PMSfx?.play("fanfare"), 920);
      return value + 1;
    }), 1700);
    return () => window.clearInterval(id);
  }, [playing]);

  const move = (next: number) => { setPlaying(false); setIndex(Math.max(0, Math.min(COMPANION_STAGES.length - 1, next))); };

  return <div className="pm-growth-showcase" role="dialog" aria-modal="true" aria-labelledby="growth-showcase-title">
    <div className="pm-growth-sky"><button type="button" className="pm-growth-close" onClick={onClose} aria-label={locale === "id" ? "Tutup" : "Close"}>×</button><div className="pm-growth-stars" aria-hidden="true">✦　·　✧　·　✦</div><p>{locale === "id" ? "PERJALANAN PERTUMBUHAN JAMKACHU" : "JAMKACHU GROWTH JOURNEY"}</p><h2 id="growth-showcase-title">{companionStageLabel(locale, stage)}</h2><strong>STAGE {index + 1} / {COMPANION_STAGES.length}</strong>
      <div key={`label-${stage}`} className="pm-growth-evolving">{index === 0 ? (locale === "id" ? "PERJALANAN DIMULAI" : "THE JOURNEY BEGINS") : (locale === "id" ? "EVOLUSI!" : "EVOLUTION!")}</div>
      <div key={stage} className="pm-growth-jamkachu"><Mascot mood="Happy" stage={stage} /></div>
      <div className="pm-growth-burst" aria-hidden="true">✦　✧　✦</div>
    </div>
    <ol className="pm-growth-ladder">{COMPANION_STAGES.map((item, itemIndex) => <li key={item} className={itemIndex === index ? "is-current" : itemIndex < index ? "is-seen" : ""}><button type="button" onClick={() => move(itemIndex)}><span>{itemIndex < index ? "✓" : itemIndex + 1}</span><small>{companionStageLabel(locale, item)}</small></button></li>)}</ol>
    <div className="pm-growth-controls"><button type="button" onClick={() => move(index - 1)} disabled={index === 0}>← {locale === "id" ? "SEBELUMNYA" : "PREVIOUS"}</button><button type="button" className="is-primary" onClick={() => { if (index === COMPANION_STAGES.length - 1) setIndex(0); setPlaying((value) => !value); }}>{playing ? `Ⅱ ${locale === "id" ? "JEDA" : "PAUSE"}` : index === COMPANION_STAGES.length - 1 ? `↺ ${locale === "id" ? "ULANGI" : "REPLAY"}` : `▶ ${locale === "id" ? "LANJUT" : "PLAY"}`}</button><button type="button" onClick={() => move(index + 1)} disabled={index === COMPANION_STAGES.length - 1}>{locale === "id" ? "BERIKUTNYA" : "NEXT"} →</button></div>
  </div>;
}
