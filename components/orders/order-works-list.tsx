import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkOrderStatus, WorkWithFinance } from "@/lib/types";
import { OrderStatusBadge } from "./order-status-badge";

type Row = WorkWithFinance & {
  ordersCount: number;
  pendingOrdersCount: number;
  ordersAmount: number;
  ordersPaid: number;
  ordersPending: number;
};

function amountTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
}

function pendingTone(pending: number, total: number) {
  if (total <= 0.001 || pending <= 0.001) return "text-muted-foreground";
  return Math.abs(pending - total) < 0.001
    ? "text-destructive"
    : "text-brand-foreground";
}

function orderWorkStatus(work: Row): WorkOrderStatus | "none" {
  if (work.ordersCount === 0) return "none";
  if (work.ordersAmount <= 0.001) return "pending_quote";
  if (work.ordersPending <= 0.001) return "paid";
  return Math.abs(work.ordersPending - work.ordersAmount) < 0.001
    ? "quoted"
    : "partial";
}

function OrderWorkStatusBadge({ work }: { work: Row }) {
  const status = orderWorkStatus(work);
  if (status === "none") {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Sin pedidos
      </Badge>
    );
  }
  return <OrderStatusBadge status={status} />;
}

export function OrderWorksList({ works }: { works: Row[] }) {
  const totalOrders = works.reduce((sum, work) => sum + work.ordersCount, 0);
  const pendingOrders = works.reduce((sum, work) => sum + work.pendingOrdersCount, 0);
  const totalAmount = works.reduce((sum, work) => sum + work.ordersAmount, 0);
  const totalPaid = works.reduce((sum, work) => sum + work.ordersPaid, 0);
  const totalPending = works.reduce((sum, work) => sum + work.ordersPending, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-transparent bg-brand p-5 text-brand-foreground">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-foreground/80">
                Monto total
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCurrency(totalAmount)}
              </p>
              <p className="mt-1 text-xs text-brand-foreground/70">
                {totalOrders} pedidos en {works.length} obras
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-foreground/10">
              <ClipboardList className="size-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Abonado</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-brand-foreground">
                {formatCurrency(totalPaid)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pagos registrados
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand-foreground">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pendiente</p>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold tabular-nums",
                  pendingTone(totalPending, totalAmount),
                )}
              >
                {formatCurrency(totalPending)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingOrders} pedidos pendientes
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <BadgeDollarSign className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Obras</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona una obra para revisar y registrar pedidos.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-5">Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto total</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creación</TableHead>
                <TableHead className="text-right">Pedidos pendientes</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Acción</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {works.map((work) => (
                <TableRow key={work.id}>
                  <TableCell className="px-5">
                    <Link
                      href={`/pedidos/${work.id}`}
                      className="font-medium transition-colors hover:text-brand-foreground"
                    >
                      {work.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {work.finance.movementsCount} movimientos
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {work.client.name}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      amountTone(work.ordersAmount),
                    )}
                  >
                    {formatCurrency(work.ordersAmount)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      amountTone(work.ordersPaid),
                    )}
                  >
                    {formatCurrency(work.ordersPaid)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      pendingTone(work.ordersPending, work.ordersAmount),
                    )}
                  >
                    {formatCurrency(work.ordersPending)}
                  </TableCell>
                  <TableCell>
                    <OrderWorkStatusBadge work={work} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(work.created_at)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      work.pendingOrdersCount > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {work.pendingOrdersCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {work.ordersCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/pedidos/${work.id}`} />}
                    >
                      Abrir
                      <ArrowRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
