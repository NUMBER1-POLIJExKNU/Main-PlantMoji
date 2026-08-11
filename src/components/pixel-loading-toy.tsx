"use client";

import { useRef, useState } from "react";
import type { PixelLoadingVariant } from "@/components/pixel-loading";

// The accessible name is spelled out in both languages below rather than
// passed in as a prop: its parent is a Suspense fallback and may not await the
// request locale to pick one (see pixel-loading.tsx). `display: none` content
// is excluded from the accessible name, so only the visible language counts.
export default function PixelLoadingToy({ variant }: { variant: PixelLoadingVariant }) {
  const [poked, setPoked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = () => {
    window.PMSfx?.play("pet");
    if (timer.current) clearTimeout(timer.current);
    setPoked(false);
    requestAnimationFrame(() => {
      setPoked(true);
      timer.current = setTimeout(() => setPoked(false), 480);
    });
  };
  return (
    <button type="button" className={`pm-loading-toy${poked ? " is-poked" : ""}`} onClick={poke}>
      <span className="sr-only">
        <span className="pm-i18n-id">Ketuk Jamkachu</span>
        <span className="pm-i18n-en">Tap Jamkachu</span>
      </span>
      <span className="pm-loading-scene" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pixel art; the optimizer would resample the crisp pixels */}
        <img className="pm-loading-jamkachu" src="/farm/assets/jamkachu/2x/plant-p2-sprout-happy.png" alt="" draggable={false} />
        <span className="pm-loading-prop" data-variant={variant}><i /><i /><i /></span>
        <span className="pm-loading-heart">♥</span>
      </span>
    </button>
  );
}
