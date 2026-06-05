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
    <Card className="flex h-full flex-col gap-0 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Flujo de caja</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses</p>
        </div>
        <div className="flex gap-5 text-xs">
          <Legend label="Ingresos" dotClassName="bg-brand" value={formatCurrency(totalIncome)} />
          <Legend label="Egresos" dotClassName="bg-chart-4" value={formatCurrency(totalExpense)} />
        </div>
      </div>

      <div className="mt-6 flex-1">
        <div className="grid h-64 grid-cols-6 gap-3 sm:gap-5">
          {points.map((point) => (
            <div key={point.key} className="flex min-h-0 flex-col items-center gap-3">
              <div className="flex min-h-0 flex-1 items-end justify-center gap-1.5">
                <Bar value={point.income} maxValue={maxValue} className="bg-brand" />
                <Bar value={point.expense} maxValue={maxValue} className="bg-chart-4" />
              </div>
              <p className="text-xs font-medium capitalize text-muted-foreground">{point.label}</p>
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
      <span className={`size-2.5 rounded-full ${dotClassName}`} />
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
  const height = value > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
  return (
    <div className="flex h-full w-5 items-end sm:w-6">
      <div
        className={`w-full rounded-md transition-all ${className}`}
        style={{ height: `${height}%` }}
        title={formatCurrency(value)}
      />
    </div>
  );
}
