"use client";

import { computeBreakdown, type Addon } from "@/lib/calculations";
import {
  MARKUP,
  MARKUP_LABELS,
  MARKUP_TOTAL_RATE,
  PROJECT_DISTRIBUTION,
  PROJECT_BASE_LABEL,
  PROJECT_MARKUP_LABEL,
  PROJECT_SLICE_LABELS,
  type ProjectSliceKey,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({
  label,
  pct,
  amount,
  dot,
  strong,
  muted,
}: {
  label: string;
  pct?: number;
  amount: number;
  dot?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} />}
        <span className={cn("truncate", strong ? "font-medium" : muted ? "text-muted-foreground" : "")}>
          {label}
        </span>
        {pct !== undefined && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground tabular-nums">
            {Math.round(pct * 100)}%
          </span>
        )}
      </span>
      <span className={cn("shrink-0 tabular-nums", strong && "font-semibold")}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

export function DistributionPreview({
  base,
  addons,
}: {
  base: number;
  addons: Addon[];
}) {
  const valid = Number.isFinite(base) && base > 0;
  const b = computeBreakdown(valid ? base : 0, addons);
  const projectKeys = Object.keys(PROJECT_DISTRIBUTION) as ProjectSliceKey[];
  const validAddons = addons.filter((a) => a.amount > 0);

  const segments = [
    { v: b.base, c: "bg-brand" },
    { v: b.addonsTotal, c: "bg-chart-2" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total a cobrar</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-brand-foreground">
          {formatCurrency(b.total)}
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) =>
          b.total > 0 && s.v > 0 ? (
            <div key={i} className={s.c} style={{ width: `${(s.v / b.total) * 100}%` }} />
          ) : null,
        )}
      </div>

      <div>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cálculo del total
        </p>
        <div className="divide-y">
          <Row label={PROJECT_BASE_LABEL} amount={b.base} dot="bg-brand" strong />
          {validAddons.map((a, i) => (
            <Row key={i} label={a.concept || "Adicional"} amount={a.amount} dot="bg-chart-2" muted />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
          <span className="font-semibold">Total a cobrar</span>
          <span className="font-semibold tabular-nums text-brand-foreground">
            {formatCurrency(b.total)}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distribución referencial
        </p>
        <div className="divide-y">
          <Row label={PROJECT_MARKUP_LABEL} pct={MARKUP_TOTAL_RATE} amount={b.markupTotal} muted />
          <Row label={MARKUP_LABELS.office} pct={MARKUP.office} amount={b.markup.office} muted />
          <Row label={MARKUP_LABELS.utility} pct={MARKUP.utility} amount={b.markup.utility} muted />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Oficina y utilidad se muestran como referencia interna. No se suman al total
          a cobrar.
        </p>
      </div>

      <div>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distribución operativa interna
        </p>
        <div className="divide-y">
          {projectKeys.map((k) => (
            <Row
              key={k}
              label={PROJECT_SLICE_LABELS[k]}
              pct={PROJECT_DISTRIBUTION[k]}
              amount={b.project[k]}
              muted
            />
          ))}
        </div>
      </div>
    </div>
  );
}
