// Plain (non-"use client") module so these values can be safely imported by
// BOTH server and client components. Exporting CHART_COLORS from a "use client"
// file made it resolve to `undefined` inside server components (the values
// don't cross the client→server boundary), which left SVG fills empty (black).

export type ValueFormat = "currency" | "number";

export interface ChartSeries {
  key: string;
  label: string;
  color: string; // concrete hex (SVG fill/stroke don't render oklch CSS vars)
}

export interface ChartPoint {
  label: string;
  values: Record<string, number>;
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

// Brand palette as hex (lime ramp) that matches the system's green theme.
export const CHART_COLORS = {
  brand: "#84cc16", // lime-500
  c2: "#65a30d", // lime-600
  c3: "#4d7c0f", // lime-700
  c4: "#3f6212", // lime-800
  c5: "#1a2e05", // deep lime
  warning: "#f59e0b", // amber-500
  destructive: "#ef4444", // red-500
} as const;
