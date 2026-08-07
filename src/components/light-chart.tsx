// Light-intensity line chart (design: DESIGN/dashboard.png, bottom panel).
// recharts, single blue series, no dots, thin line. This module has no
// "use client" directive of its own — it joins the client bundle through
// monitoring-live.tsx.

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LightPoint {
  /** Unix timestamp (ms). */
  t: number;
  /** Lux in "lux" mode; 0 | 1 in "binary" mode. */
  value: number;
}

/** "lux" plots real lux; "binary" is the fallback for old flows that only
 *  log the on/off `light` column. */
export type LightMode = "lux" | "binary";

// blue-500 — legible on both the white and the zinc-900 card surface, close
// to the Node-RED original's line color.
const LINE_BLUE = "#3b82f6";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** 1717082973000 → "20:14:33" (viewer's local time). */
export function formatTime(ms: number): string {
  return timeFormat.format(new Date(ms));
}

interface ChartTooltipProps {
  mode: LightMode;
  // Injected by recharts when it clones the tooltip element.
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: LightPoint }>;
}

function ChartTooltip({ mode, active, payload }: ChartTooltipProps) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {mode === "lux"
          ? `${point.value.toLocaleString("en-US")} lx`
          : point.value >= 1
            ? "Light on"
            : "Light off"}
      </p>
      <p className="tabular-nums text-zinc-500 dark:text-zinc-400">{formatTime(point.t)}</p>
    </div>
  );
}

export default function LightChart({
  points,
  mode,
}: {
  points: LightPoint[];
  mode: LightMode;
}) {
  // y-axis: 0–2,000 like the design, growing in clean 2,000-steps only when
  // the data exceeds it (quarter ticks stay round multiples of 500).
  let yMax = 1;
  let yTicks: number[] = [0, 1];
  if (mode === "lux") {
    let dataMax = 0;
    for (const p of points) dataMax = Math.max(dataMax, p.value);
    yMax = Math.max(2000, Math.ceil(dataMax / 2000) * 2000);
    yTicks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];
  }

  return (
    <div
      className="h-[260px] w-full text-zinc-500 tabular-nums dark:text-zinc-400"
      aria-label={mode === "lux" ? "Light intensity history in lux" : "Light on/off history"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fill: "currentColor", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", strokeOpacity: 0.3 }}
            minTickGap={56}
            tickMargin={8}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={
              mode === "binary"
                ? (v: number) => (v >= 1 ? "On" : "Off")
                : (v: number) => v.toLocaleString("en-US")
            }
            tick={{ fill: "currentColor", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={mode === "binary" ? 34 : 46}
            padding={mode === "binary" ? { top: 12 } : undefined}
          />
          <Tooltip
            content={<ChartTooltip mode={mode} />}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={LINE_BLUE}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, className: "stroke-white dark:stroke-zinc-900" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
