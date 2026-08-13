"use client";

// Two-panel sensor history for /monitoring — replaces the single light chart.
//
// WHY THIS IS HAND-DRAWN SVG AND NOT recharts:
// globals.css:804 sets `.reno-route-page * { max-width:100% }` on every
// descendant of a route page. recharts v3 measures its container by nesting
// the chart inside a `width:0;height:0` probe div, so that blanket rule
// resolved the chart wrapper's max-width against a 0px parent and collapsed
// it to 0. The axes and the series were all in the DOM, correctly computed,
// inside an element 0 pixels wide — a card that looked simply empty, with no
// error anywhere. Plain SVG sized from a ResizeObserver has no probe element
// to collapse, and drops the app's heaviest dependency from this route.
//
// AUTHORITY: presentation only. Comfort bands come from the active crop
// profile (the same fields the quest engine reads); nothing here decides
// anything, grants anything, or writes anywhere.

import { useEffect, useMemo, useRef, useState } from "react";

export interface HistorySample {
  /** Unix ms. */
  t: number;
  temperature: number | null;
  humidity: number | null;
  soilPh: number | null;
  light: number | null;
}

export type SeriesKey = "temperature" | "humidity" | "soilPh" | "light";

export interface Band {
  min: number;
  max: number;
}

interface SeriesSpec {
  key: SeriesKey;
  label: string;
  unit: string;
  color: string;
  /** Fixed axis domain — never data-fitted. A classroom reading that barely
   *  moves must look steady, not dramatic; auto-zoom would turn ±0.2°C of
   *  sensor noise into a mountain range. */
  domain: [number, number];
  ticks: number[];
  band?: Band;
  /** One decimal for the readouts that earn it, integers for the rest. */
  decimals: 0 | 1;
}

const GEOM = {
  height: 214,
  // padTop leaves a clear line for the two unit captions above the highest
  // tick — at 10px they collided with the domain-max label on both axes.
  padTop: 22,
  padBottom: 24,
  padLeft: 40,
  padRight: 42,
  minWidth: 220,
  /** Must equal .pm-history-split's column-gap, so the SVG is laid out at the
   *  exact pixel width it is drawn at and never rescales its own text. */
  columnGap: 14,
} as const;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFormatSeconds = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function fmt(value: number, decimals: 0 | 1) {
  return decimals === 1 ? (Math.round(value * 10) / 10).toFixed(1) : String(Math.round(value));
}

/** Container width, measured rather than inferred. Starts at 0 and the chart
 *  renders nothing until a real measurement lands, so no frame is ever drawn
 *  against a guessed width. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Series path, broken at gaps. A dropped reading leaves a hole rather than a
 *  straight line pretending the sensor was steady across the outage. */
function linePath(
  samples: HistorySample[],
  key: SeriesKey,
  x: (t: number) => number,
  y: (value: number) => number,
) {
  let path = "";
  let open = false;
  for (const sample of samples) {
    const value = sample[key];
    if (typeof value !== "number") {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"}${x(sample.t).toFixed(1)} ${y(value).toFixed(1)}`;
    open = true;
  }
  return path;
}

function Panel({
  title,
  samples,
  left,
  right,
  width,
}: {
  title: string;
  samples: HistorySample[];
  left: SeriesSpec;
  right: SeriesSpec;
  width: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { height, padTop, padBottom, padLeft, padRight } = GEOM;
  const plotWidth = Math.max(1, width - padLeft - padRight);
  const plotHeight = height - padTop - padBottom;

  const tMin = samples[0]?.t ?? 0;
  const tMax = samples[samples.length - 1]?.t ?? 1;
  const span = Math.max(1, tMax - tMin);
  const x = (t: number) => padLeft + ((t - tMin) / span) * plotWidth;
  const scaleFor = (spec: SeriesSpec) => (value: number) => {
    const [lo, hi] = spec.domain;
    const clamped = Math.min(hi, Math.max(lo, value));
    return padTop + plotHeight - ((clamped - lo) / (hi - lo)) * plotHeight;
  };
  const yLeft = scaleFor(left);
  const yRight = scaleFor(right);

  const hovered = hoverIndex === null ? null : samples[hoverIndex] ?? null;
  const latest = samples[samples.length - 1] ?? null;
  const shown = hovered ?? latest;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    if (px < padLeft || px > padLeft + plotWidth || samples.length === 0) {
      setHoverIndex(null);
      return;
    }
    const target = tMin + ((px - padLeft) / plotWidth) * span;
    // Samples are evenly spaced enough that a proportional guess plus a short
    // local walk beats a full scan on every pointer move (500 points, 60fps).
    let index = Math.round(((target - tMin) / span) * (samples.length - 1));
    index = Math.min(samples.length - 1, Math.max(0, index));
    for (let step = 0; step < 8; step += 1) {
      const here = Math.abs(samples[index].t - target);
      const prev = index > 0 ? Math.abs(samples[index - 1].t - target) : Infinity;
      const next = index < samples.length - 1 ? Math.abs(samples[index + 1].t - target) : Infinity;
      if (prev < here) index -= 1;
      else if (next < here) index += 1;
      else break;
    }
    setHoverIndex(index);
  };

  const xTicks = useMemo(() => {
    if (samples.length < 2) return [];
    const count = plotWidth > 420 ? 5 : plotWidth > 260 ? 4 : 3;
    return Array.from({ length: count }, (_, i) => tMin + (span * i) / (count - 1));
  }, [plotWidth, samples.length, span, tMin]);

  return (
    <div className="pm-history-panel">
      <div className="pm-history-panel-head">
        <h3>{title}</h3>
        <div className="pm-history-legend">
          {[left, right].map((spec) => {
            const value = shown?.[spec.key];
            return (
              <span key={spec.key} style={{ ["--series" as string]: spec.color }}>
                <i aria-hidden="true" />
                <b>{spec.label}</b>
                <em>{typeof value === "number" ? `${fmt(value, spec.decimals)}${spec.unit}` : "—"}</em>
              </span>
            );
          })}
        </div>
      </div>

      <svg
        className="pm-history-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${left.label} and ${right.label} over the last hour`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Comfort band for the left-axis series: filled, in its own colour. */}
        {left.band && (
          <rect
            x={padLeft}
            y={Math.min(yLeft(left.band.max), yLeft(left.band.min))}
            width={plotWidth}
            height={Math.abs(yLeft(left.band.min) - yLeft(left.band.max))}
            fill={left.color}
            opacity={0.13}
          />
        )}
        {/* The right-axis series gets dashed threshold rules instead of a second
            fill — two overlapping tinted bands read as mud. */}
        {right.band &&
          [right.band.min, right.band.max].map((value) => (
            <line
              key={value}
              x1={padLeft}
              x2={padLeft + plotWidth}
              y1={yRight(value)}
              y2={yRight(value)}
              stroke={right.color}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.5}
            />
          ))}

        {/* Horizontal grid on the left axis' ticks. */}
        {left.ticks.map((tick) => (
          <line
            key={tick}
            x1={padLeft}
            x2={padLeft + plotWidth}
            y1={yLeft(tick)}
            y2={yLeft(tick)}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}

        {/* Axis labels: each tick wears its series' colour, so which scale a
            line belongs to never needs a guess. */}
        {left.ticks.map((tick) => (
          <text key={tick} x={padLeft - 7} y={yLeft(tick) + 3.5} textAnchor="end" fill={left.color} fontSize={10}>
            {fmt(tick, 0)}
          </text>
        ))}
        {right.ticks.map((tick) => (
          <text
            key={tick}
            x={padLeft + plotWidth + 7}
            y={yRight(tick) + 3.5}
            textAnchor="start"
            fill={right.color}
            fontSize={10}
          >
            {fmt(tick, 0)}
          </text>
        ))}
        <text x={padLeft - 7} y={11} textAnchor="end" fill={left.color} fontSize={9} opacity={0.85}>
          {left.unit}
        </text>
        <text x={padLeft + plotWidth + 7} y={11} textAnchor="start" fill={right.color} fontSize={9} opacity={0.85}>
          {right.unit}
        </text>

        {xTicks.map((tick, index) => (
          <text
            key={tick}
            x={x(tick)}
            y={height - 7}
            textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
            fill="currentColor"
            fillOpacity={0.62}
            fontSize={10}
          >
            {timeFormat.format(new Date(tick))}
          </text>
        ))}

        <line
          x1={padLeft}
          x2={padLeft + plotWidth}
          y1={padTop + plotHeight}
          y2={padTop + plotHeight}
          stroke="currentColor"
          strokeOpacity={0.3}
        />

        <path d={linePath(samples, left.key, x, yLeft)} fill="none" stroke={left.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        <path d={linePath(samples, right.key, x, yRight)} fill="none" stroke={right.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {/* Emphasised endpoint: where the garden is right now. */}
        {latest && typeof latest[left.key] === "number" && (
          <circle cx={x(latest.t)} cy={yLeft(latest[left.key] as number)} r={3.2} fill={left.color} stroke="var(--color-surface)" strokeWidth={1.5} />
        )}
        {latest && typeof latest[right.key] === "number" && (
          <circle cx={x(latest.t)} cy={yRight(latest[right.key] as number)} r={3.2} fill={right.color} stroke="var(--color-surface)" strokeWidth={1.5} />
        )}

        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hovered.t)} x2={x(hovered.t)} y1={padTop} y2={padTop + plotHeight} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 3" />
            {typeof hovered[left.key] === "number" && (
              <circle cx={x(hovered.t)} cy={yLeft(hovered[left.key] as number)} r={4} fill={left.color} stroke="var(--color-surface)" strokeWidth={2} />
            )}
            {typeof hovered[right.key] === "number" && (
              <circle cx={x(hovered.t)} cy={yRight(hovered[right.key] as number)} r={4} fill={right.color} stroke="var(--color-surface)" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>

      <p className="pm-history-stamp">{shown ? timeFormatSeconds.format(new Date(shown.t)) : ""}</p>
    </div>
  );
}

export interface SensorHistoryCopy {
  airGroup: string;
  soilLightGroup: string;
  temperature: string;
  humidity: string;
  soilPh: string;
  light: string;
}

export default function SensorHistoryCharts({
  samples,
  copy,
  bands,
}: {
  samples: HistorySample[];
  copy: SensorHistoryCopy;
  /** Active crop profile's suitable ranges, or null when unavailable — the
   *  chart then draws without bands rather than inventing thresholds. */
  bands: Record<SeriesKey, Band> | null;
}) {
  const [ref, width] = useMeasuredWidth();

  const air = useMemo<[SeriesSpec, SeriesSpec]>(
    () => [
      { key: "temperature", label: copy.temperature, unit: "°C", color: "#EF8B6C", domain: [0, 40], ticks: [0, 10, 20, 30, 40], band: bands?.temperature, decimals: 1 },
      { key: "humidity", label: copy.humidity, unit: "%", color: "#4DA1ED", domain: [0, 100], ticks: [0, 25, 50, 75, 100], band: bands?.humidity, decimals: 0 },
    ],
    [bands, copy.humidity, copy.temperature],
  );
  const soilLight = useMemo<[SeriesSpec, SeriesSpec]>(
    () => [
      { key: "soilPh", label: copy.soilPh, unit: "pH", color: "#AA7E55", domain: [0, 14], ticks: [0, 7, 14], band: bands?.soilPh, decimals: 1 },
      { key: "light", label: copy.light, unit: "%", color: "#F2C84B", domain: [0, 100], ticks: [0, 25, 50, 75, 100], band: bands?.light, decimals: 0 },
    ],
    [bands, copy.light, copy.soilPh],
  );

  // One measurement drives both halves: the divider splits the row evenly, so
  // asking each panel to measure itself would just race to the same number.
  // The grid is `1fr 1px 1fr` with two gaps, so that is what gets subtracted.
  const split = Math.floor((width - 1 - 2 * GEOM.columnGap) / 2);
  const stacked = width > 0 && split < GEOM.minWidth;
  const panelWidth = stacked ? Math.max(GEOM.minWidth, Math.floor(width)) : split;

  return (
    <div ref={ref} className={`pm-history-split${stacked ? " is-stacked" : ""}`}>
      {width > 0 && (
        <>
          <Panel title={copy.airGroup} samples={samples} left={air[0]} right={air[1]} width={panelWidth} />
          <span className="pm-history-divider" aria-hidden="true" />
          <Panel title={copy.soilLightGroup} samples={samples} left={soilLight[0]} right={soilLight[1]} width={panelWidth} />
        </>
      )}
    </div>
  );
}
