import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FolderKanban,
  Hammer,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/charts/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_COLORS, type ChartSeries } from "@/components/charts/palette";
import {
  ChartLegend,
  ComparisonBars,
  DonutChart,
  TrendChart,
} from "@/components/charts/charts";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { OverviewSnapshot } from "@/lib/overview";

const cashSeries: ChartSeries[] = [
  { key: "ingresos", label: "Ingresos", color: CHART_COLORS.brand },
  { key: "egresos", label: "Egresos", color: CHART_COLORS.c4 },
];
const utilSeries: ChartSeries[] = [
  { key: "proyectos", label: "Proyectos", color: CHART_COLORS.brand },
  { key: "obras", label: "Obras", color: CHART_COLORS.c3 },
];

const statusColors: Record<string, string> = {
  paid: CHART_COLORS.brand,
  partial: CHART_COLORS.warning,
  pending: CHART_COLORS.c4,
};
const ordersColors: Record<string, string> = {
  paid: CHART_COLORS.brand,
  pending: CHART_COLORS.warning,
};

const moduleIcons: Record<string, React.ReactNode> = {
  projects: <FolderKanban className="size-5" />,
  works: <Hammer className="size-5" />,
  orders: <ClipboardList className="size-5" />,
  salary: <Wallet className="size-5" />,
};

export function OverviewView({ snapshot }: { snapshot: OverviewSnapshot }) {
  const { kpis } = snapshot;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Balance general"
          value={formatCurrency(kpis.generalBalance)}
          hint="Consolidado de todas las cuentas"
          icon={<Landmark className="size-5" />}
          accent
          spark={snapshot.cashflowSpark}
        />
        <KpiCard
          label="Cartera de proyectos"
          value={formatCurrency(kpis.portfolio)}
          hint={`Por cobrar ${formatCurrency(kpis.projectsPending)}`}
          icon={<FolderKanban className="size-5" />}
          delta={{ value: kpis.cashflowDelta, label: "flujo del mes" }}
        />
        <KpiCard
          label="Balance de obras"
          value={formatCurrency(kpis.worksBalance)}
          hint={`Pedidos por pagar ${formatCurrency(kpis.ordersPending)}`}
          icon={<Hammer className="size-5" />}
        />
        <KpiCard
          label="Utilidad total"
          value={formatCurrency(kpis.utilityTotal)}
          hint={`Salarios del mes ${formatCurrency(kpis.salaryPaid)}`}
          icon={<TrendingUp className="size-5" />}
          delta={{ value: kpis.utilityDelta, label: "vs mes previo" }}
        />
      </div>

      {/* Module health strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.modules.map((mod) => (
          <Link key={mod.key} href={mod.href} className="group">
            <Card className="h-full gap-0 p-4 transition-colors hover:border-brand/40 hover:bg-brand/5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand-foreground">
                    {moduleIcons[mod.key]}
                  </span>
                  {mod.label}
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-foreground" />
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{mod.primaryLabel}</p>
                  <p className="text-lg font-semibold tabular-nums leading-tight">
                    {mod.format === "currency" ? formatCurrency(mod.primaryValue) : formatNumber(mod.primaryValue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{mod.secondaryLabel}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {mod.secondaryLabel.toLowerCase().includes("activa") ||
                    mod.secondaryLabel.toLowerCase().includes("cotizar")
                      ? formatNumber(mod.secondaryValue)
                      : formatCurrency(mod.secondaryValue)}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <ChartCard
          title="Flujo de caja"
          description="Ingresos y egresos de proyectos y obras (últimos 6 meses)."
          legend={<ChartLegend series={cashSeries} />}
        >
          <TrendChart points={snapshot.cashflow} series={cashSeries} valueFormat="currency" />
        </ChartCard>
        <ChartCard title="Estado de cartera" description="Proyectos por estado de cobro.">
          <DonutChart
            slices={snapshot.portfolioStatus.map((s) => ({
              label: s.label,
              value: s.value,
              color: statusColors[s.key] ?? CHART_COLORS.c3,
            }))}
            valueFormat="number"
            centerLabel="Proyectos"
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <ChartCard
          title="Utilidad por área"
          description="Comparativo mensual de utilidad de proyectos vs obras."
          legend={<ChartLegend series={utilSeries} />}
        >
          <ComparisonBars points={snapshot.utilities} series={utilSeries} valueFormat="currency" />
        </ChartCard>
        <ChartCard title="Pedidos" description="Distribución pagado vs pendiente.">
          <DonutChart
            slices={snapshot.ordersBreakdown.map((s) => ({
              label: s.label,
              value: s.value,
              color: ordersColors[s.key] ?? CHART_COLORS.c3,
            }))}
            valueFormat="currency"
            centerLabel="Pedidos"
          />
        </ChartCard>
      </div>
    </div>
  );
}
