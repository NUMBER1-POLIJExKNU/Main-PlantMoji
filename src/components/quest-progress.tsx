"use client";

// Live quest progress bar. All quest timing is timestamp-based (handoff
// Correction 4) — this component only *renders* elapsed time from the ISO
// timestamps it receives; completion itself is decided server-side by the
// quest engine's lazy sweep.
//
// Props cross the RSC boundary, so timestamps arrive as ISO strings.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n";

export interface QuestProgressProps {
  /** maintain: count up toward requiredSeconds. verifying: count down. */
  mode: "maintain" | "verifying";
  /** ISO timestamp the window is measured from (started_at / verifying_since). */
  sinceIso: string;
  requiredSeconds: number;
  /** Plant whose quest this bar tracks — the completion sweep needs it. */
  plantId: string;
  locale: AppLocale;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function QuestProgress({
  mode,
  sinceIso,
  requiredSeconds,
  plantId,
  locale,
}: QuestProgressProps) {
  const router = useRouter();
  const sinceMs = Date.parse(sinceIso);
  // "Now" lives in state so render stays pure (no Date.now() during render).
  // It starts pinned to the start timestamp — server and hydration render the
  // identical zero-state — then the rAF/interval callbacks swap in live time.
  const [nowMs, setNowMs] = useState(sinceMs);
  // Guards the completion sweep so it fires at most once per mount.
  const firedRef = useRef(false);

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const raf = requestAnimationFrame(update);
    const id = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.min(requiredSeconds, Math.floor((nowMs - sinceMs) / 1000)),
  );

  // Once the bar visually completes, run the server-side lazy sweep so the
  // quest resolves without a manual reload. The sweep is idempotent — a
  // duplicate tick (e.g. a second open tab) is safe.
  useEffect(() => {
    if (!Number.isFinite(sinceMs) || requiredSeconds <= 0) return;
    if (elapsedSeconds < requiredSeconds || firedRef.current) return;
    firedRef.current = true;
    fetch("/api/game-tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId }),
    }).finally(() => router.refresh());
  }, [sinceMs, elapsedSeconds, requiredSeconds, plantId, router]);

  if (!Number.isFinite(sinceMs) || requiredSeconds <= 0) return null;
  const percent = (elapsedSeconds / requiredSeconds) * 100;

  const label =
    mode === "maintain"
      ? `${Math.floor(elapsedSeconds / 60)} / ${Math.round(requiredSeconds / 60)} ${locale === "id" ? "mnt" : "min"}`
      : locale === "id"
        ? `Memeriksa… tersisa ${formatClock(requiredSeconds - elapsedSeconds)}`
        : `Verifying… ${formatClock(requiredSeconds - elapsedSeconds)} left`;

  return (
    <div className="mt-3">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredSeconds}
        aria-valuenow={elapsedSeconds}
        aria-label={label}
        className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-700/60"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            mode === "maintain"
              ? "bg-linear-to-r from-green-400 to-emerald-500"
              : "bg-linear-to-r from-amber-300 to-amber-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
        {label}
      </p>
    </div>
  );
}
