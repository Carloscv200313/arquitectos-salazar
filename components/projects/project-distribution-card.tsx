import { Card } from "@/components/ui/card";
import {
  MARKUP,
  MARKUP_LABELS,
  MARKUP_TOTAL_RATE,
  PROJECT_DISTRIBUTION,
  PROJECT_BASE_LABEL,
  PROJECT_MARKUP_LABEL,
  PROJECT_SLICE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectWithFinance } from "@/lib/types";

function Line({
  label,
  pct,
  amount,
  strong,
  muted,
}: {
  label: string;
  pct?: number;
  amount: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
      <span className={cn("min-w-0 truncate", strong ? "font-medium" : muted ? "text-muted-foreground" : "")}>
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-3 tabular-nums">
        {pct !== undefined && (
          <span className="text-xs text-muted-foreground">{formatPercent(pct * 100)}</span>
        )}
        <span className={cn("w-28 text-right", strong && "font-semibold")}>
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
  );
}

export function ProjectDistributionCard({ project }: { project: ProjectWithFinance }) {
  return (
    <Card className="gap-0 py-0">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Resumen del proyecto</h2>
        <p className="text-xs text-muted-foreground">
          Total a cobrar {formatCurrency(project.total_amount)}
        </p>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Composición del total
            </p>
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <Line label={PROJECT_BASE_LABEL} amount={project.project_amount} strong />
              {project.addons.map((a) => (
                <Line key={a.id} label={a.concept} amount={a.amount} muted />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/35 px-4 py-3 text-sm">
              <span className="font-semibold">Total a cobrar</span>
              <span className="font-semibold tabular-nums text-brand-foreground">
                {formatCurrency(project.total_amount)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Distribución referencial
            </p>
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <Line label={PROJECT_MARKUP_LABEL} pct={MARKUP_TOTAL_RATE} amount={project.office_amount + project.utility_amount} muted />
              <Line label={MARKUP_LABELS.office} pct={MARKUP.office} amount={project.office_amount} muted />
              <Line label={MARKUP_LABELS.utility} pct={MARKUP.utility} amount={project.utility_amount} muted />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Proyecto 50%, oficina y utilidad son referencias internas. No se suman al total a cobrar.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Distribución operativa interna
            </p>
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <Line label={PROJECT_SLICE_LABELS.proposal} pct={PROJECT_DISTRIBUTION.proposal} amount={project.proposal_amount} muted />
              <Line label={PROJECT_SLICE_LABELS.modeling_3d} pct={PROJECT_DISTRIBUTION.modeling_3d} amount={project.modeling_3d_amount} muted />
              <Line label={PROJECT_SLICE_LABELS.plans} pct={PROJECT_DISTRIBUTION.plans} amount={project.plans_amount} muted />
              <Line label={PROJECT_SLICE_LABELS.render} pct={PROJECT_DISTRIBUTION.render} amount={project.render_amount} muted />
            </div>
          </div>

          <div className="rounded-xl bg-muted/35 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lectura operativa
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Usa ingresos para cobros del cliente y egresos para pagos internos de propuesta, modelado 3D, planos y render.
            </p>
          </div>
        </section>
      </div>
    </Card>
  );
}
