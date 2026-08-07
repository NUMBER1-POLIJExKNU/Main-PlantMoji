"use client";

// Ephemeral event-emotion badge (handoff §12): a small floating chip that
// flashes Proud / Excited / Curious / Recovering for a few seconds and then
// disappears on its own. Purely presentational — the parent decides WHEN to
// show something by passing an `EmotionMeta` (from
// `@/game/emotions/event-emotions`) or `null`; this component owns none of
// that decision and stores nothing.
//
// Auto-dismisses after `meta.durationMs` via a UI timer (React 19 rule: no
// synchronous setState in the effect body — the timeout only calls the
// parent's `onDone`, which owns whatever state controls `meta`). Keying off
// `meta.emotion` (mirrors LevelUpOverlay's `key={level}`) makes back-to-back
// emotions replay the pop/fade instead of silently no-op-ing, and dismiss on
// click works the same way LevelUpOverlay's tap-to-dismiss does.

import { useEffect, useRef } from "react";
import type { EmotionMeta } from "@/game/emotions/event-emotions";

export interface EmotionBadgeProps {
  meta: EmotionMeta | null;
  onDone: () => void;
}

export default function EmotionBadge({ meta, onDone }: EmotionBadgeProps) {
  // Keep the latest onDone in a ref so a parent passing a fresh inline
  // callback each render never resets the dismiss timer.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const emotion = meta?.emotion;
  const durationMs = meta?.durationMs;
  useEffect(() => {
    if (!emotion || durationMs === undefined) return;
    // UI timer only (allowed) — no setState here; the timeout just notifies
    // the parent, which owns the `meta` state.
    const timerId = setTimeout(() => {
      onDoneRef.current();
    }, durationMs);
    return () => clearTimeout(timerId);
    // Re-arm whenever the emotion itself changes, not merely the object
    // identity, so two events resolving to the same emotion in a row still
    // behave predictably and a genuinely new emotion always gets its own
    // fresh timer.
  }, [emotion, durationMs]);

  if (!meta) return null;

  return (
    <>
      <style>{`
        @keyframes pm-emotion-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pm-emotion-pop {
          0% { opacity: 0; transform: translateY(-6px) scale(0.7); }
          60% { opacity: 1; transform: translateY(0) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <button
        type="button"
        key={meta.emotion}
        onClick={() => onDone()}
        role="status"
        aria-label={`${meta.label}. Tap to dismiss.`}
        className="fixed top-4 left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-xl backdrop-blur motion-safe:animate-[pm-emotion-pop_450ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-[pm-emotion-fade_150ms_ease-out_both] dark:bg-zinc-900/90 dark:text-zinc-100"
      >
        <span className="text-xl" role="img" aria-hidden="true">
          {meta.emoji}
        </span>
        {meta.label}
      </button>
    </>
  );
}
