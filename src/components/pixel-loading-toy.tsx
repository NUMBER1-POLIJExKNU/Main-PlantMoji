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
        <span className="pm-loading-sprout"><i /><i /></span>
        <span className="pm-loading-face"><i /><i /></span>
        <span className="pm-loading-pot"><i /></span>
        <span className="pm-loading-dirt" />
        <span className="pm-loading-prop" data-variant={variant}><i /><i /><i /></span>
        <span className="pm-loading-heart">♥</span>
      </span>
    </button>
  );
}
