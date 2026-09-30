"use client";

import { computeBreakdown, round2, type Addon, type ProjectDistribution } from "@/lib/calculations";
import {
  MARKUP_LABELS,
  MARKUP_TOTAL_RATE,
  PROYECTO_RATE,
  PROJECT_DISTRIBUTION,
  PROJECT_SLICE_LABELS,
  type ProjectSliceKey,
  type SliceWeights,
} from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/format";
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
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
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

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function DistributionPreview({
  base,
  addons,
  weights = PROJECT_DISTRIBUTION,
  projectDistribution,
  creditMode = false,
}: {
  base: number;
  addons: Addon[];
  weights?: SliceWeights;
  projectDistribution?: ProjectDistribution;
  creditMode?: boolean;
}) {
  const valid = Number.isFinite(base) && base > 0;
  const b = computeBreakdown(valid ? base : 0, addons, weights);
  const projectKeys = Object.keys(PROJECT_DISTRIBUTION) as ProjectSliceKey[];
  const validAddons = addons.filter((a) => a.amount > 0);
  const projectAmounts = projectDistribution ?? b.project;
  const projectDistributionTotal = round2(
    projectKeys.reduce((sum, key) => sum + (projectAmounts[key] || 0), 0),
  );
  const usesExactProjectAmounts = !!projectDistribution;
  const distributionProjectShare = b.base > 0 ? projectDistributionTotal / b.base : 0;
  const estimatedUtility = usesExactProjectAmounts
    ? round2(b.base - projectDistributionTotal)
    : b.markupTotal;
  const utilityProjectShare = b.base > 0 ? estimatedUtility / b.base : MARKUP_TOTAL_RATE;
  const utilityVsRecommended =
    b.markupTotal > 0 ? (Math.max(estimatedUtility, 0) / b.markupTotal) * 100 : 0;
  const utilityNote = usesExactProjectAmounts
    ? estimatedUtility >= 0
      ? `Con estos montos queda ${formatPercent(utilityProjectShare * 100)} del proyecto como utilidad (${formatPercent(utilityVsRecommended)} de la utilidad recomendada).`
      : `La distribución supera el monto del proyecto por ${formatCurrency(Math.abs(estimatedUtility))}; no queda utilidad disponible.`
    : "Este gasto es para utilidad y gasto de oficina.";

  const segments = [
    { v: b.base, c: "bg-brand" },
    { v: b.addonsTotal, c: "bg-chart-2" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero: total a cobrar */}
      {!creditMode && (
        <div className="rounded-xl bg-brand-muted/40 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-brand-foreground">
              {formatCurrency(b.total)}
            </span>
          </div>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-background/60">
            {segments.map((s, i) =>
              b.total > 0 && s.v > 0 ? (
                <div key={i} className={s.c} style={{ width: `${(s.v / b.total) * 100}%` }} />
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Cálculo del total */}
      <div>
        <SectionTitle>Cálculo del total</SectionTitle>
        <div className="divide-y divide-border/60">
          {creditMode ? (
            <div className="py-2 text-sm">
              <p className="font-medium">Proyecto a crédito</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                No hay monto inicial. Cada egreso del proyecto se suma a la deuda
                del cliente y cada ingreso se registra como abono.
              </p>
            </div>
          ) : (
            <Row label="Monto del proyecto" amount={b.base} dot="bg-brand" strong />
          )}
          {validAddons.map((a, i) => (
            <Row key={i} label={a.concept || "Adicional"} amount={a.amount} dot="bg-chart-2" muted />
          ))}
        </div>
        {!creditMode && (
          <div className="mt-2 flex items-center justify-between border-t pt-2.5 text-sm">
            <span className="font-semibold">Total a cobrar</span>
            <span className="font-semibold tabular-nums text-brand-foreground">
              {formatCurrency(b.total)}
            </span>
          </div>
        )}
      </div>

      {/* Distribución del Proyecto según plantilla o montos exactos */}
      {!creditMode && (
        <div className="rounded-xl border bg-muted/25 p-4">
          <div className="mb-1 flex items-center justify-between">
            <SectionTitle>Distribución del proyecto</SectionTitle>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {usesExactProjectAmounts
                ? `${formatPercent(distributionProjectShare * 100)} · ${formatCurrency(projectDistributionTotal)}`
                : `${Math.round(PROYECTO_RATE * 100)}% · ${formatCurrency(b.projectPortion)}`}
            </span>
          </div>
          <div className="divide-y divide-border/60">
            {projectKeys.map((k) => (
              <Row
                key={k}
                label={PROJECT_SLICE_LABELS[k]}
                pct={
                  usesExactProjectAmounts
                    ? projectDistributionTotal > 0
                      ? projectAmounts[k] / projectDistributionTotal
                      : 0
                    : weights[k]
                }
                amount={projectAmounts[k]}
                muted
              />
            ))}
          </div>
        </div>
      )}

      {/* Referencial: utilidad recomendada o estimada */}
      {!creditMode && (
        <div className="rounded-xl border bg-muted/25 p-4">
          <SectionTitle>Referencia interna</SectionTitle>
          <div className="divide-y divide-border/60">
            <Row
              label={usesExactProjectAmounts ? "Utilidad estimada" : MARKUP_LABELS.utility}
              pct={usesExactProjectAmounts ? utilityProjectShare : MARKUP_TOTAL_RATE}
              amount={estimatedUtility}
              muted
            />
            {usesExactProjectAmounts && (
              <Row
                label="Utilidad recomendada"
                pct={MARKUP_TOTAL_RATE}
                amount={b.markupTotal}
                muted
              />
            )}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {utilityNote}
          </p>
        </div>
      )}
    </div>
  );
}
