"use client";

// Sparkle emoji overlay for the guardian camera stage — presentation only.
// The layer is pointer-events:none DOM decoration painted OVER the <video>,
// so the frame-diff touch loop, the local model, and pest-scan snapshots
// keep reading raw frames (the capture pipeline never sees CSS overlays).
// Tapping the stage bursts sparkles at the tap point; a small ✨ button in
// the top-right corner turns the whole thing off (stored per device).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { AppLocale } from "@/lib/i18n";

const STORAGE_KEY = "pm_cam_sparkles"; // same semantics as sfx: only stored "off" disables
const EMOJI = ["✨", "🌟", "💖", "🌸", "🍀"];
const AMBIENT_MS = 900;
const MAX_LIVE = 16; // hard cap so a tap-storm can never flood the DOM
const BURST_COUNT = 7;

interface Sparkle {
  id: number;
  emoji: string;
  left: number; // % of stage width
  top: number; // % of stage height
  size: number; // px
  duration: number; // ms
  dx: number; // px outward drift, bursts only
  dy: number;
  burst: boolean;
}

function pickEmoji(): string {
  return EMOJI[Math.floor(Math.random() * EMOJI.length)];
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export default function CameraSparkles({ locale }: { locale: AppLocale }) {
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? true : readEnabled(),
  );
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(0);

  const spawn = useCallback((batch: Array<Omit<Sparkle, "id">>) => {
    setSparkles((live) =>
      [...live, ...batch.map((s) => ({ ...s, id: nextId.current++ }))].slice(-MAX_LIVE),
    );
  }, []);

  // Ambient drift — skipped entirely under prefers-reduced-motion (bursts
  // stay, but the CSS swaps them to a short static fade).
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      spawn([
        {
          emoji: pickEmoji(),
          left: 4 + Math.random() * 92,
          top: 25 + Math.random() * 65,
          size: 14 + Math.random() * 14,
          duration: 2400 + Math.random() * 1600,
          dx: 0,
          dy: 0,
          burst: false,
        },
      ]);
    }, AMBIENT_MS);
    return () => window.clearInterval(timer);
  }, [enabled, spawn]);

  // Tap burst. The listener sits on the stage (our parent) so this overlay
  // can stay pointer-events:none and never steal input from stage controls.
  useEffect(() => {
    if (!enabled) return;
    const stage = hostRef.current?.parentElement;
    if (!stage) return;
    const onTap = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(".pm-cam-sparkle-toggle")) return;
      const bounds = stage.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const left = ((event.clientX - bounds.left) / bounds.width) * 100;
      const top = ((event.clientY - bounds.top) / bounds.height) * 100;
      spawn(
        Array.from({ length: BURST_COUNT }, () => {
          const angle = Math.random() * Math.PI * 2;
          const reach = 24 + Math.random() * 44;
          return {
            emoji: pickEmoji(),
            left,
            top,
            size: 16 + Math.random() * 16,
            duration: 900 + Math.random() * 500,
            dx: Math.cos(angle) * reach,
            dy: Math.sin(angle) * reach - 12,
            burst: true,
          };
        }),
      );
    };
    stage.addEventListener("pointerdown", onTap);
    return () => stage.removeEventListener("pointerdown", onTap);
  }, [enabled, spawn]);

  const toggleLabel =
    locale === "id"
      ? enabled
        ? "Matikan efek kelap-kelip"
        : "Nyalakan efek kelap-kelip"
      : enabled
        ? "Turn sparkle effects off"
        : "Turn sparkle effects on";

  return (
    <>
      <div ref={hostRef} className="pm-cam-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className={`pm-cam-sparkle${sparkle.burst ? " is-burst" : ""}`}
            style={
              {
                left: `${sparkle.left}%`,
                top: `${sparkle.top}%`,
                fontSize: `${sparkle.size}px`,
                animationDuration: `${sparkle.duration}ms`,
                "--dx": `${sparkle.dx}px`,
                "--dy": `${sparkle.dy}px`,
              } as CSSProperties
            }
            onAnimationEnd={() =>
              setSparkles((live) => live.filter((other) => other.id !== sparkle.id))
            }
          >
            {sparkle.emoji}
          </span>
        ))}
      </div>
      <button
        type="button"
        className={`pm-cam-sparkle-toggle${enabled ? " is-on" : ""}`}
        aria-pressed={enabled}
        aria-label={toggleLabel}
        title={toggleLabel}
        suppressHydrationWarning
        onClick={() =>
          setEnabled((on) => {
            const next = !on;
            try {
              window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
            } catch {
              // Private-mode storage failure just means the choice won't persist.
            }
            if (!next) setSparkles([]);
            return next;
          })
        }
      >
        ✨
      </button>
    </>
  );
}
