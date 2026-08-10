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
  /** quests.id — stamps the one-shot "just completed" sessionStorage flag
   *  (Quest Done-Pill Stamp) so quest-done-pill.tsx knows to animate. */
  questId: string;
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
  questId,
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

  // Anticipation beat (spec §3 "Verifying Shimmer"): when the verify countdown
  // hits zero the card holds ~600ms on "Sensor confirmed!" before
  // router.refresh() reveals the completed state. Derived, not stored — the
  // clamped countdown reaching its target IS the confirmed state.
  // Presentation only: completion and XP are decided server-side by the sweep.
  const confirmed =
    mode === "verifying" && requiredSeconds > 0 && elapsedSeconds >= requiredSeconds;

  // Once the bar visually completes, run the server-side lazy sweep so the
  // quest resolves without a manual reload. The sweep is idempotent — a
  // duplicate tick (e.g. a second open tab) is safe.
  useEffect(() => {
    if (!Number.isFinite(sinceMs) || requiredSeconds <= 0) return;
    if (elapsedSeconds < requiredSeconds || firedRef.current) return;
    firedRef.current = true;
    const sweep = () => {
      // Quest Done-Pill Stamp handshake: mark this quest as "just completed"
      // BEFORE the refresh that will render its history pill, so
      // quest-done-pill.tsx knows to stamp it in exactly once. Optimistic —
      // set on local completion detection, not on server confirmation — but
      // harmless if the sweep doesn't actually land COMPLETED, since only a
      // COMPLETED pill ever reads this flag; try/catch covers private-mode
      // storage denial (the stamp just won't fire).
      try {
        sessionStorage.setItem(`pm-just-completed:${questId}`, "1");
      } catch {
        /* sessionStorage unavailable — no stamp, refresh still proceeds */
      }
      fetch("/api/game-tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      }).finally(() => router.refresh());
    };
    if (mode === "verifying") {
      // Rising arpeggio + the 600ms "Sensor confirmed!" hold (rendered via
      // the derived `confirmed` flag), then the sweep. ?. keeps a missing SFX
      // engine a silent no-op; the cue itself is mute/rate-limit gated inside
      // sfx.js. Zero XP logic here.
      window.PMSfx?.play("cascade");
      setTimeout(sweep, 600);
      return;
    }
    sweep();
  }, [mode, sinceMs, elapsedSeconds, requiredSeconds, plantId, questId, router]);

  if (!Number.isFinite(sinceMs) || requiredSeconds <= 0) return null;
  const percent = (elapsedSeconds / requiredSeconds) * 100;

  // Copy follows this page's i18n mechanism (dac0528): AppLocale prop +
  // inline en/id ternaries, English as the "en" source of truth.
  const label =
    mode === "maintain"
      ? `${Math.floor(elapsedSeconds / 60)} / ${Math.round(requiredSeconds / 60)} ${locale === "id" ? "mnt" : "min"}`
      : confirmed
        ? locale === "id"
          ? "Sensor mengonfirmasi!"
          : "Sensor confirmed!"
        : locale === "id"
          ? `Memeriksa… tersisa ${formatClock(requiredSeconds - elapsedSeconds)}`
          : `Verifying… ${formatClock(requiredSeconds - elapsedSeconds)} left`;

  // Farm-look fills (public/farm/style.css): the grass XP gradient while
  // maintaining/confirmed, the verifying amber while sensors are checking.
  // Inline styles because the unlayered .pm-bar-fill base wins over Tailwind
  // color utilities in the cascade.
  const fillStyle = {
    width: `${percent}%`,
    background:
      mode === "maintain" || confirmed
        ? "linear-gradient(90deg, var(--color-grass), var(--color-grass-light))"
        : "linear-gradient(90deg, #E8C46B, #FFDE6A)",
  };

  return (
    <div className="mt-3">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredSeconds}
        aria-valuenow={elapsedSeconds}
        aria-label={label}
        className="pm-bar w-full"
      >
        <div className="pm-bar-fill" style={fillStyle} />
      </div>
      <p
        className="font-pixel mt-2 text-[10px] leading-relaxed tabular-nums"
        style={{
          color: confirmed
            ? "var(--color-forest)"
            : mode === "verifying"
              ? "#7A5B12"
              : "var(--color-text)",
        }}
      >
        {label}
      </p>
    </div>
  );
}
