import { ClipboardList, CheckCircle2, Clock, PackageSearch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_COLORS } from "@/components/charts/palette";
import { ComparisonBars, DonutChart } from "@/components/charts/charts";
import { KpiCard } from "@/components/charts/kpi-card";
import { round2 } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import type { WorkWithFinance } from "@/lib/types";

export interface OrderWorkRow extends WorkWithFinance {
  ordersCount: number;
  pendingOrdersCount: number;
  ordersAmount: number;
  ordersPaid: number;
  ordersPending: number;
}

export function OrderReports({ works }: { works: OrderWorkRow[] }) {
  const totalAmount = round2(works.reduce((s, w) => s + w.ordersAmount, 0));
  const totalPaid = round2(works.reduce((s, w) => s + w.ordersPaid, 0));
  const totalPending = round2(works.reduce((s, w) => s + w.ordersPending, 0));
  const totalOrders = works.reduce((s, w) => s + w.ordersCount, 0);
  const totalUnquoted = works.reduce((s, w) => s + w.pendingOrdersCount, 0);
  const paidPct = totalAmount > 0 ? round2((totalPaid / totalAmount) * 100) : 0;

  const byWork = [...works]
    .filter((w) => w.ordersAmount > 0)
    .sort((a, b) => b.ordersPending - a.ordersPending)
    .slice(0, 6)
    .map((w) => ({
      label: w.name.length > 14 ? `${w.name.slice(0, 13)}…` : w.name,
      values: { pagado: w.ordersPaid, pendiente: w.ordersPending },
    }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total en pedidos"
          value={formatCurrency(totalAmount)}
          hint={`${totalOrders} pedido${totalOrders === 1 ? "" : "s"} cotizados`}
          icon={<ClipboardList className="size-5" />}
          accent
        />
        <KpiCard
          label="Pagado"
          value={formatCurrency(totalPaid)}
          hint={`${paidPct.toFixed(0)}% del total`}
          icon={<CheckCircle2 className="size-5" />}
          delta={{ value: paidPct, label: "pagado", goodWhenUp: true }}
        />
        <KpiCard
          label="Por pagar"
          value={formatCurrency(totalPending)}
          hint="Saldo pendiente a proveedores"
          icon={<Clock className="size-5" />}
        />
        <KpiCard
          label="Sin cotizar"
          value={String(totalUnquoted)}
          hint="Pedidos a la espera de monto"
          icon={<PackageSearch className="size-5" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <ChartCard title="Pagado vs pendiente" description="Distribución global de pedidos.">
          {totalAmount > 0 ? (
            <DonutChart
              slices={[
                { label: "Pagado", value: totalPaid, color: CHART_COLORS.brand },
                { label: "Pendiente", value: totalPending, color: CHART_COLORS.warning },
              ]}
              valueFormat="currency"
              centerLabel="Pedidos"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin pedidos cotizados.</p>
          )}
        </ChartCard>
        <ChartCard title="Pedidos por obra" description="Pagado y pendiente de las obras con más saldo.">
          {byWork.length > 0 ? (
            <ComparisonBars
              points={byWork}
              series={[
                { key: "pagado", label: "Pagado", color: CHART_COLORS.brand },
                { key: "pendiente", label: "Pendiente", color: CHART_COLORS.warning },
              ]}
              valueFormat="currency"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin pedidos para graficar.</p>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Detalle por obra" description="Pedidos, montos y saldos por obra.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-4">Obra</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Por pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {works
                .filter((w) => w.ordersCount > 0)
                .map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="px-4">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.client.name}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{w.ordersCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(w.ordersAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-brand-foreground">
                      {formatCurrency(w.ordersPaid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {w.ordersPending > 0.001 ? (
                        <span className="text-amber-600">{formatCurrency(w.ordersPending)}</span>
                      ) : (
                        formatCurrency(0)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {works.every((w) => w.ordersCount === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    Sin pedidos registrados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </div>
  );
}
