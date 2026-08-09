"use client";

import { useEffect, useRef } from "react";
import type { AppLocale } from "@/lib/i18n";

const SEEN_KEY = "plantmoji_guide_seen_v1";

export default function AppGuide({ locale }: { locale: AppLocale }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = locale === "id";
  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) dialog.current?.showModal(); } catch { /* help button remains available */ }
  }, []);
  function close() { try { localStorage.setItem(SEEN_KEY, "1"); } catch {} dialog.current?.close(); }
  return <>
    <button type="button" className="pm-guide-button" aria-label={id ? "Buka panduan" : "Open guide"} onClick={() => dialog.current?.showModal()}>?</button>
    <dialog ref={dialog} className="pm-guide-dialog" aria-labelledby="pm-guide-title">
      <div className="pm-guide-card">
        <span className="pm-guide-kicker">🌱 PLANTMOJI GUIDE</span>
        <h2 id="pm-guide-title">{id ? "Cara bermain" : "How to play"}</h2>
        <ol>
          <li><b>1 · {id ? "RASAKAN" : "SENSE"}</b><span>{id ? "Lihat 4 nilai sensor asli di Kebun Saya." : "Read the four real sensors in My Garden."}</span></li>
          <li><b>2 · {id ? "PAHAMI" : "UNDERSTAND"}</b><span>{id ? "Buka Misi atau Eksplor Tanaman untuk memahami artinya." : "Use Quests or Crop Explorer to understand them."}</span></li>
          <li><b>3 · {id ? "BERTINDAK" : "ACT"}</b><span>{id ? "Lakukan perubahan kecil dan aman pada tanaman asli." : "Make one small, safe change to the real plant."}</span></li>
          <li><b>4 · {id ? "PERIKSA & TUMBUH" : "VERIFY & GROW"}</b><span>{id ? "Sensor memverifikasi perbaikan; Jamkachu mendapat hadiah." : "Sensors verify improvement; Jamkachu earns the reward."}</span></li>
        </ol>
        <p>{id ? "AI hanya menjelaskan. Sensor dan aturan game menentukan kebenaran." : "AI only explains. Sensors and game rules decide what is true."}</p>
        <button type="button" className="pm-btn pm-btn-primary" onClick={close}>{id ? "Ayo mulai!" : "Let's grow!"}</button>
      </div>
    </dialog>
  </>;
}
