"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AppLocale } from "@/lib/i18n";
import FarmerChatDialog from "@/components/farmer-chat-dialog";

export default function FarmerNpc({ isNight, locale }: { isNight: boolean; locale: AppLocale }) {
  const [awake, setAwake] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const suppressClickRef = useRef(false);
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
    suppressClickRef.current = false;
    setDragging(false);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateDragPosition = useCallback((clientX: number, clientY: number, pointerId: number) => {
    const current = drag.current;
    if (!current || current.id !== pointerId) return;
    // The pointer handler's original threshold was
    // Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    // keep the same 6px slop while sharing it with the window fallback.
    if (!current.moved && Math.hypot(clientX - current.startX, clientY - current.startY) < 6) return;
    if (!current.moved) { setAwake(true); setDragging(true); }
    current.moved = true;
    setPosition({ x: Math.max(6, Math.min(window.innerWidth - 58, clientX - current.dx)), y: Math.max(70, Math.min(window.innerHeight - 70, clientY - current.dy)) });
  }, []);
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    updateDragPosition(event.clientX, event.clientY, event.pointerId);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const moved = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!moved) {
      // Opening chat is an intentional wake interaction. Do not let the
      // night auto-sleep timer hide the NPC behind an open dialog.
      setAwake(true);
      setChatOpen(true);
      return;
    }
    // Some mobile browsers synthesize a click after a drag. Consume that
    // click so moving Farmer Tani never unexpectedly opens the chat dialog.
    suppressClickRef.current = true;
    scheduleSleep();
  };

  const pointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    scheduleSleep();
  };

  const openChatFromButton = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // Native button activation (Enter/Space) has no pointer sequence. Keep
    // it equivalent to a gentle tap without changing the drag path.
    setAwake(true);
    setChatOpen(true);
  };

  const closeChat = () => {
    setChatOpen(false);
    scheduleSleep();
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };

  // Pointer capture normally keeps move events on the button, but a few
  // mobile WebViews drop capture when the dragged element changes position.
  // A window listener is a defensive fallback so the NPC follows the finger
  // even after it leaves the original button bounds.
  useEffect(() => {
    const onWindowMove = (event: PointerEvent) => {
      if (!drag.current || drag.current.id !== event.pointerId) return;
      updateDragPosition(event.clientX, event.clientY, event.pointerId);
    };
    window.addEventListener("pointermove", onWindowMove, { passive: true });
    return () => window.removeEventListener("pointermove", onWindowMove);
  }, [updateDragPosition]);

  return <>
    <div className={`pm-react-farmer${isNight ? " is-night" : ""}${awake ? " is-awake" : " is-sleeping"}${chatOpen ? " is-chatting" : ""}${dragging ? " is-dragging" : ""}`}>
      <div className="pm-react-farmer-bed" aria-hidden="true"><i /><b /></div>
      <button ref={buttonRef} type="button" className={position ? "is-moved" : undefined} style={position ? { left: position.x, top: position.y } : undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onClick={openChatFromButton} aria-label={locale === "id" ? "Ngobrol dengan atau pindahkan Farmer Tani" : "Chat with or drag Farmer Tani"} aria-expanded={chatOpen} aria-controls="pm-farmer-chat-dialog">
        <span className="pm-react-farmer-label">
          <b>{isNight && !awake ? "Zzz.." : "💬 FARMER TANI"}</b>
          {(!isNight || awake) && <small>{dragging ? (locale === "id" ? "LEPAS DI SINI" : "DROP ME HERE") : locale === "id" ? "KETUK CHAT · GESER" : "TAP CHAT · DRAG"}</small>}
        </span>
        <span className="pm-react-farmer-sprite" aria-hidden="true">
          {/* Designer art (kiki design integration): the transparent Farmer
              Tani PNG, for the same reason Mbah Tani below uses one — the
              idle GIF opens on a frame with transparency off, so it paints
              the designer's grass diorama opaque behind the sprite wherever
              it stands on the app's own scenery. All four export scales are
              offered so the browser picks the crispest for its density. The
              button's aria-label above stays the accessible name, so this
              art is purely decorative. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- responsive pixel art must not be resampled */}
          <img src="/farm/assets/npc/2x/npc-01-pak-tani.png" srcSet="/farm/assets/npc/1x/npc-01-pak-tani.png 32w, /farm/assets/npc/2x/npc-01-pak-tani.png 64w, /farm/assets/npc/4x/npc-01-pak-tani.png 128w, /farm/assets/npc/8x/npc-01-pak-tani.png 256w" sizes="64px" alt="" />
        </span>
      </button>
    </div>
    <FarmerChatDialog open={chatOpen} locale={locale} onClose={closeChat} />
  </>;
}
