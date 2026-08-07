"use client";

// Fullscreen level-up celebration (handoff Phase 9):
//
//   ✨ LEVEL UP
//   Bond Lv.3
//
// Presentational — the client parent decides WHEN to show it (it also owns
// urgent-warning precedence per Phase 9: warnings outrank celebration).
// Auto-dismisses after ~2.5 s via a UI timer, or immediately on click/tap.
// Animation is CSS-only and gated behind motion-safe so users with
// prefers-reduced-motion get an instant, static overlay.

import { useEffect, useRef } from "react";

export interface LevelUpOverlayProps {
  level: number;
  show: boolean;
  onDone: () => void;
}

const AUTO_DISMISS_MS = 2500;

export default function LevelUpOverlay({ level, show, onDone }: LevelUpOverlayProps) {
  // Keep the latest onDone in a ref so a parent passing a fresh inline
  // callback each render never resets the dismiss timer.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!show) return;
    // UI timer only (allowed) — no setState here; the timeout just notifies
    // the parent, which owns the `show` state.
    const timerId = setTimeout(() => {
      onDoneRef.current();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timerId);
  }, [show, level]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes leaftalk-levelup-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes leaftalk-levelup-pop {
          0% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <button
        type="button"
        onClick={() => onDone()}
        aria-label={`Level up! Bond level ${level}. Tap to dismiss.`}
        className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm motion-safe:animate-[leaftalk-levelup-fade_300ms_ease-out_both]"
      >
        <div
          // Re-key on level so back-to-back level-ups replay the pop.
          key={level}
          role="status"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 px-12 py-10 text-center shadow-2xl backdrop-blur motion-safe:animate-[leaftalk-levelup-pop_600ms_cubic-bezier(0.22,1,0.36,1)_both] dark:bg-zinc-900/90"
        >
          <span className="text-5xl motion-safe:animate-pulse" role="img" aria-hidden="true">
            ✨
          </span>
          <span className="text-2xl font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
            LEVEL UP
          </span>
          <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            Bond Lv.{level}
          </span>
        </div>
      </button>
    </>
  );
}
