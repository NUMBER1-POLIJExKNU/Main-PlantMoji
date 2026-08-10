"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AppLocale } from "@/lib/i18n";

export default function FarmerNpc({ isNight, locale }: { isNight: boolean; locale: AppLocale }) {
  const [awake, setAwake] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; moved: boolean } | null>(null);
  const sleepTimer = useRef<number | null>(null);

  const scheduleSleep = () => {
    if (sleepTimer.current !== null) window.clearTimeout(sleepTimer.current);
    if (!isNight) return;
    sleepTimer.current = window.setTimeout(() => {
      sleepTimer.current = null;
      setAwake(false);
      setPosition(null);
    }, 3000);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { setAwake(!isNight); setPosition(null); }, 0);
    return () => { window.clearTimeout(timer); if (sleepTimer.current !== null) window.clearTimeout(sleepTimer.current); };
  }, [isNight]);

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (sleepTimer.current !== null) window.clearTimeout(sleepTimer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    setAwake(true);
    setPosition({ x: rect.left, y: rect.top });
    drag.current = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    current.moved = true;
    setPosition({ x: Math.max(6, Math.min(window.innerWidth - 58, event.clientX - current.dx)), y: Math.max(70, Math.min(window.innerHeight - 70, event.clientY - current.dy)) });
  };
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    scheduleSleep();
  };

  return <div className={`pm-react-farmer${isNight ? " is-night" : ""}${awake ? " is-awake" : " is-sleeping"}`}>
    <div className="pm-react-farmer-bed" aria-hidden="true"><i /><b /></div>
    <button type="button" style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label={isNight ? (locale === "id" ? "Bangunkan dan pindahkan Kakek Tani" : "Wake and move Grandpa Tani") : (locale === "id" ? "Pindahkan Kakek Tani" : "Move Grandpa Tani")}>
      <span className="pm-react-farmer-label">{isNight && !awake ? "Zzz.." : locale === "id" ? "KAKEK TANI" : "GRANDPA"}</span>
      <span className="pm-react-farmer-sprite" aria-hidden="true"><i /><b /><em /></span>
    </button>
  </div>;
}
