"use client";

import { useRef, useState } from "react";
import type { PixelLoadingVariant } from "@/components/pixel-loading";

export default function PixelLoadingToy({ variant, label }: { variant: PixelLoadingVariant; label: string }) {
  const [poked, setPoked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = () => {
    if (timer.current) clearTimeout(timer.current);
    setPoked(false);
    requestAnimationFrame(() => {
      setPoked(true);
      timer.current = setTimeout(() => setPoked(false), 480);
    });
  };
  return (
    <button type="button" className={`pm-loading-toy${poked ? " is-poked" : ""}`} onClick={poke} aria-label={label}>
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
