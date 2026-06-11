import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MARKUP,
  MARKUP_LABELS,
  PROYECTO_RATE,
  PROJECT_MARKUP_LABEL,
  PROJECT_SLICE_LABELS,
  TEMPLATE_LABELS,
} from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InternalArea, PaymentWithMethod, ProjectWithFinance } from "@/lib/types";

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
      <span
        className={cn(
          "block min-w-0 truncate",
          strong ? "font-medium" : muted ? "text-muted-foreground" : "",
        )}
      >
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-3 tabular-nums">
        {pct !== undefined && (
          <span className="text-xs text-muted-foreground">{formatPercent(pct * 100)}</span>
        )}
        <span className={cn("whitespace-nowrap text-right", strong && "font-semibold")}>
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
  );
}

function AreaRow({
  label,
  responsible,
  pct,
  total,
  paid,
}: {
  label: string;
  responsible: string;
  pct: number;
  total: number;
  paid: number;
}) {
  const safePaid = Math.min(round2(paid), total);
  const progress = total > 0 ? Math.min(round2((safePaid / total) * 100), 100) : 0;

  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs font-medium text-brand-foreground">{responsible}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 tabular-nums">
          <span className="text-xs text-muted-foreground">{formatPercent(pct * 100)}</span>
          <span className="text-right font-semibold">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Pagado {formatCurrency(safePaid)}</span>
          <span className="font-medium text-brand-foreground">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProjectDistributionCard({
  project,
  payments,
}: {
  project: ProjectWithFinance;
  payments: PaymentWithMethod[];
}) {
  const portion = round2(
    project.proposal_amount +
      project.modeling_3d_amount +
      project.plans_amount +
      project.render_amount,
  );
  const pctOf = (amount: number) => (portion > 0 ? amount / portion : 0);

  const paidByArea = payments.reduce<Record<InternalArea, number>>(
    (acc, payment) => {
      if (payment.movement_type !== "expense" || !payment.internal_area) return acc;
      acc[payment.internal_area] = round2(acc[payment.internal_area] + payment.amount);
      return acc;
    },
    {
      proposal: 0,
      modeling_3d: 0,
      plans: 0,
      render: 0,
    },
  );

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Resumen del proyecto</h2>
          <p className="text-xs text-muted-foreground">
            Total a cobrar {formatCurrency(project.total_amount)}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Plantilla {TEMPLATE_LABELS[project.template]}
        </Badge>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Composición del total
            </p>
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <Line label="Monto del proyecto" amount={project.project_amount} strong />
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
              Referencia interna
            </p>
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <Line label={MARKUP_LABELS.office} pct={MARKUP.office} amount={project.office_amount} muted />
              <Line label={MARKUP_LABELS.utility} pct={MARKUP.utility} amount={project.utility_amount} muted />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {PROJECT_MARKUP_LABEL} 50%, oficina y utilidad son referencias internas. No se
              suman al total a cobrar.
            </p>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Distribución del proyecto
            </p>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {Math.round(PROYECTO_RATE * 100)}% · {formatCurrency(portion)}
            </span>
          </div>
          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <AreaRow
              label={PROJECT_SLICE_LABELS.proposal}
              responsible={project.proposal_responsible}
              pct={pctOf(project.proposal_amount)}
              total={project.proposal_amount}
              paid={paidByArea.proposal}
            />
            <AreaRow
              label={PROJECT_SLICE_LABELS.modeling_3d}
              responsible={project.modeling_3d_responsible}
              pct={pctOf(project.modeling_3d_amount)}
              total={project.modeling_3d_amount}
              paid={paidByArea.modeling_3d}
            />
            <AreaRow
              label={PROJECT_SLICE_LABELS.plans}
              responsible={project.plans_responsible}
              pct={pctOf(project.plans_amount)}
              total={project.plans_amount}
              paid={paidByArea.plans}
            />
            <AreaRow
              label={PROJECT_SLICE_LABELS.render}
              responsible={project.render_responsible}
              pct={pctOf(project.render_amount)}
              total={project.render_amount}
              paid={paidByArea.render}
            />
          </div>
        </section>
      </div>
    </Card>
  );
}
