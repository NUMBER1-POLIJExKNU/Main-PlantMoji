// Semicircular sensor gauge (design: DESIGN/dashboard.png) — presentational
// SVG only, no chart library. Thick arc, colored fill for the read fraction,
// gray track for the remainder, thin needle, big centered value, unit below,
// min/max labels at the arc ends.
//
// ── Pure helpers ────────────────────────────────────────────────────────
// Shared by this gauge, /api/sensor-history, and tests/monitoring.test.ts.
// They live in this dependency-free module because Next.js route files may
// only export HTTP handlers, and light-chart.tsx pulls in recharts (which
// cannot load in a route handler's react-server environment).

export const MINUTES_DEFAULT = 60;
export const MINUTES_MIN = 5;
export const MINUTES_MAX = 360;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Needle rotation in degrees around the gauge center: -90° at min (pointing
 * left along the arc), 0° at mid (straight up), +90° at max. Out-of-range
 * values pin to the ends; a degenerate range (max <= min) pins to min.
 */
export function needleAngle(value: number, min: number, max: number): number {
  if (max <= min) return -90;
  const fraction = (clamp(value, min, max) - min) / (max - min);
  return fraction * 180 - 90;
}

/** 27.16 → "27.2", 57 → "57" — one decimal max, no trailing zero (design). */
export function formatReading(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** ?minutes= query parser: default 60, clamped to 5–360, whole minutes. */
export function clampMinutes(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return MINUTES_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return MINUTES_DEFAULT;
  return Math.round(clamp(parsed, MINUTES_MIN, MINUTES_MAX));
}

/**
 * Evenly sample `rows` down to at most `cap` items, always keeping the first
 * and last rows and preserving order. Used by /api/sensor-history to bound
 * the chart payload.
 */
export function downsample<T>(rows: readonly T[], cap: number): T[] {
  if (cap <= 0 || rows.length === 0) return [];
  if (rows.length <= cap) return [...rows];
  if (cap === 1) return [rows[0]];
  const step = (rows.length - 1) / (cap - 1);
  const out: T[] = [];
  let previous = -1;
  for (let i = 0; i < cap; i++) {
    const index = Math.round(i * step);
    if (index !== previous) {
      out.push(rows[index]);
      previous = index;
    }
  }
  return out;
}

// ── Gauge component ─────────────────────────────────────────────────────

export interface SensorGaugeProps {
  label: string;
  /** Latest reading; null renders the muted "no sensor" empty state. */
  value: number | null;
  min: number;
  max: number;
  unit: string;
  /** Tailwind text-color classes for the filled arc (drawn with currentColor). */
  colorClass: string;
}

// 200×124 viewBox: arc center (100,100), radius 72, stroke 26.
const ARC_PATH = "M 28 100 A 72 72 0 0 1 172 100";

export default function SensorGauge({
  label,
  value,
  min,
  max,
  unit,
  colorClass,
}: SensorGaugeProps) {
  const hasValue = value !== null && Number.isFinite(value);
  const fraction = hasValue ? (clamp(value, min, max) - min) / Math.max(max - min, 1e-9) : 0;
  const rotation = hasValue ? needleAngle(value, min, max) : -90;
  const ariaLabel = hasValue
    ? `${label}: ${formatReading(value)} ${unit}`
    : `${label}: no sensor data yet`;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2
        className={`text-center text-base font-bold tracking-tight ${
          hasValue ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
        }`}
      >
        {label}
      </h2>
      <svg
        viewBox="0 0 200 124"
        role="img"
        aria-label={ariaLabel}
        className="mx-auto mt-1 w-full max-w-[260px]"
      >
        {/* Track (unfilled remainder) */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={26}
          className="text-zinc-300 dark:text-zinc-700"
        />
        {/* Filled fraction — pathLength normalizes the dash to 0–100 */}
        {hasValue && fraction > 0 && (
          <path
            d={ARC_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={26}
            pathLength={100}
            strokeDasharray={`${fraction * 100} 100`}
            className={colorClass}
          />
        )}
        {/* Needle — tapered, pivoting on the (hidden) arc center */}
        <polygon
          points="97.4,64 99.2,10 100.8,10 102.6,64"
          fill="currentColor"
          transform={`rotate(${rotation} 100 100)`}
          className={hasValue ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-300 dark:text-zinc-600"}
        />
        <text
          x={100}
          y={90}
          textAnchor="middle"
          fontSize={27}
          className={`font-bold tabular-nums tracking-tight ${
            hasValue ? "fill-zinc-900 dark:fill-zinc-50" : "fill-zinc-300 dark:fill-zinc-600"
          }`}
        >
          {hasValue ? formatReading(value) : "—"}
        </text>
        <text
          x={100}
          y={118}
          textAnchor="middle"
          fontSize={10}
          className="fill-zinc-500 dark:fill-zinc-400"
        >
          {unit}
        </text>
        <text
          x={28}
          y={118}
          textAnchor="middle"
          fontSize={10}
          className="fill-zinc-500 tabular-nums dark:fill-zinc-400"
        >
          {min}
        </text>
        <text
          x={172}
          y={118}
          textAnchor="middle"
          fontSize={10}
          className="fill-zinc-500 tabular-nums dark:fill-zinc-400"
        >
          {max}
        </text>
      </svg>
      {!hasValue && (
        <p className="mt-1 text-center text-xs text-zinc-400 dark:text-zinc-500">no sensor yet</p>
      )}
    </section>
  );
}
