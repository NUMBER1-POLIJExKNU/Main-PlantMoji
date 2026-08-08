"use client";

// Weekly recap island (dopamine plan Task 18, spec §3 "Peaks & polish").
// Purely presentational: receives numbers the reports page already
// computed — it runs NO queries of its own. The server renders the final
// values (so no-JS and prefers-reduced-motion both get static, correct
// numbers) and a mount-only effect replays them as an 800ms ease-out
// count-up — the same curve as live.js `animateXpCount`.

import { useEffect, useRef, useState } from "react";

const STREAK_MILESTONES = [3, 7, 14, 30] as const;
const COUNT_UP_MS = 800;

export interface ReportsRecapProps {
  /** Lifetime bond XP — the page has no per-week XP figure (closest equivalent). */
  xpTotal: number;
  /** Quests completed inside the report week. */
  questsWeek: number;
  /** Current care streak in days. */
  streak: number;
  /** Weekday of the best care day; the line is hidden until the page can
   *  compute one (WeeklyReport has no per-day breakdown yet). */
  bestDay?: string | null;
}

export default function ReportsRecap({
  xpTotal,
  questsWeek,
  streak,
  bestDay = null,
}: ReportsRecapProps) {
  // 0→1 animation progress. Starts at 1 so server HTML and hydration show
  // the real numbers; the effect rewinds to 0 and counts up only when
  // motion is allowed.
  const [progress, setProgress] = useState(1);
  // Gates the finishing blip to once per mount (StrictMode-safe: refs
  // survive the dev remount, and the effect never reruns after mount).
  const playedRef = useRef(false);

  useEffect(() => {
    // Static numbers under reduced motion (spec §4 guardrail 4).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // No synchronous setState here — the first rAF tick rewinds progress
    // to ~0 itself, so all updates happen inside animation callbacks.
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!playedRef.current) {
        // Optional finishing blip — mount-only (deps []), never on
        // rerender. Degrades silently when sfx.js isn't loaded; the
        // engine itself handles mute/unlock state.
        playedRef.current = true;
        (
          window as Window & { PMSfx?: { play?: (cue: string) => void } }
        ).PMSfx?.play?.("blip");
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const shown = (value: number) => Math.round(value * progress);

  // Streak arc: progress toward the next milestone (3/7/14/30); a 30+ day
  // streak shows a full bar. Copy stays warm — no countdowns, no guilt.
  const nextMilestone = STREAK_MILESTONES.find((m) => streak < m) ?? null;
  const arcTarget = nextMilestone ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  const arcPercent = Math.min(100, (streak / arcTarget) * 100);
  const streakLabel =
    streak <= 0
      ? "Streak milestones: 3 · 7 · 14 · 30 days"
      : nextMilestone !== null
        ? `🔥 ${streak} of ${nextMilestone} days — next streak milestone`
        : `🔥 ${streak} days — every milestone reached!`;

  // Farm surface card (.pm-panel) with a harvest-yellow accent; the big
  // count-up numbers render in Press Start 2P (.pm-heading). Accents stay
  // inline because the unlayered pm-* contract beats Tailwind utilities.
  return (
    <section
      aria-label="Weekly recap"
      className="pm-panel mb-6"
      style={{ borderColor: "var(--color-yellow)" }}
    >
      <p className="pm-heading text-center text-[9px] uppercase" style={{ color: "#A97B12" }}>
        This week&apos;s recap
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="pm-heading text-xl tabular-nums">{shown(xpTotal)}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: "#5B6B57" }}>
            Total XP
          </p>
        </div>
        <div>
          <p className="pm-heading text-xl tabular-nums">{shown(questsWeek)}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: "#5B6B57" }}>
            Quests this week
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={arcTarget}
          aria-valuenow={Math.min(streak, arcTarget)}
          aria-label={streakLabel}
          className="pm-bar w-full"
        >
          {/* Width is driven every frame by the count-up rAF, so the
              contract's 0.8s width transition is disabled inline — it would
              lag behind the eased curve. Flame gradient stays in the farm
              palette (yellow → overheat orange). */}
          <div
            className="pm-bar-fill"
            style={{
              width: `${arcPercent * progress}%`,
              transition: "none",
              background: "linear-gradient(90deg, var(--color-yellow) 0%, #F08A6B 100%)",
            }}
          />
        </div>
        <p className="mt-1.5 text-xs font-semibold" style={{ color: "#5B6B57" }}>
          {streakLabel}
        </p>
      </div>

      {bestDay && (
        <p className="mt-3 text-center text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          <span role="img" aria-hidden="true">
            🌟
          </span>{" "}
          Best care day: {bestDay}
        </p>
      )}
    </section>
  );
}
