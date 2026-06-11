"use client";

// Lightweight, brand-colored SVG chart kit. No external dependencies.
// Every chart is responsive (viewBox + width 100%), keyboard/hover friendly,
// and respects the lime brand palette via CSS variables.

import { useId, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "./palette";
import type { ChartPoint, ChartSeries, DonutSlice, ValueFormat } from "./palette";

// Re-export so client consumers keep importing from "@/components/charts/charts".
// IMPORTANT: server components must import CHART_COLORS from "./palette" directly,
// because non-component values do not survive the client→server module boundary.
export { CHART_COLORS };
export type { ChartPoint, ChartSeries, DonutSlice, ValueFormat };

function fmt(value: number, format: ValueFormat) {
  return format === "currency" ? formatCurrency(value) : formatNumber(value);
}

// Short label for on-chart annotations (e.g. $1.2M, $540k, 12).
function compact(value: number, format: ValueFormat) {
  if (format === "number") return formatNumber(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / pow;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * pow;
}

/* ---------------------------------------------------------------- Sparkline */

export function Sparkline({
  values,
  color = CHART_COLORS.brand,
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  if (values.length === 0) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - ((v - min) / span) * h]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)}>
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* --------------------------------------------------------------- TrendChart */

export function TrendChart({
  points,
  series,
  valueFormat = "currency",
  height = 220,
}: {
  points: ChartPoint[];
  series: ChartSeries[];
  valueFormat?: ValueFormat;
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const padX = 8;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const rawMax = Math.max(
    1,
    ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)),
  );
  const max = niceMax(rawMax);
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const x = (i: number) => padX + i * step;
  const y = (v: number) => padY + innerH - (v / max) * innerH;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={w - padX}
            y1={padY + innerH * t}
            y2={padY + innerH * t}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
            strokeDasharray={t === 1 ? "0" : "4 6"}
            opacity={0.5}
          />
        ))}

        {series.map((s, si) => {
          const linePts = points.map((p, i) => [x(i), y(p.values[s.key] ?? 0)] as const);
          const line = linePts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
          const area = `${line} L${x(points.length - 1)},${padY + innerH} L${x(0)},${padY + innerH} Z`;
          const isPrimary = si === 0;
          return (
            <g key={s.key}>
              {isPrimary ? (
                <>
                  <defs>
                    <linearGradient id={`${gradientId}-${si}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d={area} fill={`url(#${gradientId}-${si})`} />
                </>
              ) : null}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isPrimary ? "0" : "6 5"}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {/* always-visible value labels for the primary series */}
        {points.map((p, i) => {
          const v = p.values[series[0]?.key] ?? 0;
          if (v <= 0) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={x(i)}
              y={Math.max(y(v) - 8, 12)}
              textAnchor="middle"
              className="fill-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              {compact(v, valueFormat)}
            </text>
          );
        })}

        {/* hover guide + dots */}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padY}
            y2={padY + innerH}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1}
            opacity={0.5}
          />
        ) : null}
        {series.map((s) =>
          points.map((p, i) =>
            hover === i ? (
              <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(p.values[s.key] ?? 0)} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
            ) : null,
          ),
        )}

        {/* hover hit areas */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* x labels */}
      <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={i} className={cn(hover === i && "font-semibold text-foreground")}>
            {p.label}
          </span>
        ))}
      </div>

      {/* tooltip */}
      {hover !== null ? (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <p className="mb-1 font-semibold">{points[hover].label}</p>
          <div className="grid gap-1">
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums">{fmt(points[hover].values[s.key] ?? 0, valueFormat)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- ComparisonBars */

export function ComparisonBars({
  points,
  series,
  valueFormat = "currency",
  height = 220,
}: {
  points: ChartPoint[];
  series: ChartSeries[];
  valueFormat?: ValueFormat;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const padX = 8;
  const padY = 14;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const rawMax = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const max = niceMax(rawMax);
  const groupW = innerW / points.length;
  const gap = groupW * 0.22;
  const barsW = groupW - gap;
  const barW = barsW / series.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={padX} x2={w - padX} y1={padY + innerH * (1 - t)} y2={padY + innerH * (1 - t)} stroke="currentColor" className="text-border" strokeWidth={1} strokeDasharray="4 6" opacity={0.5} />
        ))}
        {points.map((p, i) => {
          const gx = padX + i * groupW + gap / 2;
          return (
            <g key={i}>
              {hover === i ? (
                <rect x={padX + i * groupW} y={0} width={groupW} height={h} className="fill-muted/40" rx={8} />
              ) : null}
              {series.map((s, si) => {
                const v = p.values[s.key] ?? 0;
                const bh = (v / max) * innerH;
                const bx = gx + si * barW;
                const by = padY + innerH - bh;
                return (
                  <g key={s.key}>
                    <rect
                      x={bx}
                      y={by}
                      width={barW - 3}
                      height={Math.max(bh, 1)}
                      rx={4}
                      fill={s.color}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                    {v > 0 ? (
                      <text
                        x={bx + (barW - 3) / 2}
                        y={by - 4}
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ fontSize: 9, fontWeight: 600 }}
                      >
                        {compact(v, valueFormat)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              <rect x={padX + i * groupW} y={0} width={groupW} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={i} className={cn("flex-1 text-center", hover === i && "font-semibold text-foreground")}>
            {p.label}
          </span>
        ))}
      </div>
      {hover !== null ? (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <p className="mb-1 font-semibold">{points[hover].label}</p>
          <div className="grid gap-1">
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums">{fmt(points[hover].values[s.key] ?? 0, valueFormat)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- DonutChart */

export function DonutChart({
  slices,
  valueFormat = "number",
  centerLabel,
}: {
  slices: DonutSlice[];
  valueFormat?: ValueFormat;
  centerLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const centerValue = hover !== null ? slices[hover].value : total;
  const centerText = hover !== null ? slices[hover].label : centerLabel ?? "Total";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={stroke} opacity={0.25} />
          {total > 0 &&
            slices.map((s, i) => {
              const frac = s.value / total;
              const dash = frac * circ;
              const seg = (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={hover === null || hover === i ? 1 : 0.5}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer", transition: "stroke-width 150ms" }}
                />
              );
              offset += dash;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold tabular-nums">{fmt(centerValue, valueFormat)}</span>
          <span className="px-2 text-[11px] text-muted-foreground">{centerText}</span>
        </div>
      </div>
      <div className="grid w-full gap-2">
        {slices.map((s, i) => (
          <button
            key={i}
            type="button"
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
              hover === i ? "bg-muted/60" : "hover:bg-muted/40",
            )}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums">
              {fmt(s.value, valueFormat)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {total > 0 ? `${Math.round((s.value / total) * 100)}%` : "0%"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Legend bar */

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
