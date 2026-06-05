import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { DashboardMonthPoint } from "@/lib/dashboard";

export function DashboardCashflowCard({
  points,
}: {
  points: DashboardMonthPoint[];
}) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));
  const totalIncome = points.reduce((sum, point) => sum + point.income, 0);
  const totalExpense = points.reduce((sum, point) => sum + point.expense, 0);

  return (
    <Card className="gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Cashflow</p>
          <p className="mt-1 text-sm text-muted-foreground">Ingresos y egresos internos de los últimos 6 meses.</p>
        </div>
        <div className="flex gap-4 text-xs">
          <Legend label="Ingresos" dotClassName="bg-brand" value={formatCurrency(totalIncome)} />
          <Legend label="Egresos" dotClassName="bg-foreground/75" value={formatCurrency(totalExpense)} />
        </div>
      </div>

      <div className="mt-6">
        <div className="grid h-72 grid-cols-6 gap-4">
          {points.map((point) => (
            <div key={point.key} className="flex min-h-0 flex-col items-center gap-3">
              <div className="flex min-h-0 flex-1 items-end gap-1.5">
                <Bar value={point.income} maxValue={maxValue} className="bg-brand" />
                <Bar value={point.expense} maxValue={maxValue} className="bg-foreground/75" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">{point.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {point.income > 0 || point.expense > 0
                    ? `${Math.round(point.income + point.expense).toLocaleString()}`
                    : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Legend({
  label,
  dotClassName,
  value,
}: {
  label: string;
  dotClassName: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dotClassName}`} />
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Bar({
  value,
  maxValue,
  className,
}: {
  value: number;
  maxValue: number;
  className: string;
}) {
  const height = value > 0 ? Math.max((value / maxValue) * 100, 10) : 0;
  return (
    <div className="flex h-full w-7 items-end rounded-full bg-muted/60">
      <div
        className={`w-full rounded-full transition-all ${className}`}
        style={{ height: `${height}%` }}
      />
    </div>
  );
}
