import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardMovement } from "@/lib/dashboard";

export function DashboardRecentMovementsCard({
  movements,
}: {
  movements: DashboardMovement[];
}) {
  return (
    <Card className="gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Movimientos recientes</p>
          <p className="mt-1 text-sm text-muted-foreground">Últimos ingresos y egresos registrados en proyectos.</p>
        </div>
        <Link href="/projects" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Ver todo
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <Table className="min-w-[640px] border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="text-left text-muted-foreground hover:bg-transparent">
              <TableHead className="border-b py-3 pr-4 font-medium">Movimiento</TableHead>
              <TableHead className="border-b py-3 pr-4 font-medium">Proyecto</TableHead>
              <TableHead className="border-b py-3 pr-4 font-medium">Cliente</TableHead>
              <TableHead className="border-b py-3 pr-4 font-medium">Fecha</TableHead>
              <TableHead className="border-b py-3 text-right font-medium">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="border-b py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "flex size-9 items-center justify-center rounded-xl " +
                        (movement.movement_type === "income"
                          ? "bg-brand-muted text-brand-foreground"
                          : "bg-destructive/10 text-destructive")
                      }
                    >
                      {movement.movement_type === "income" ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{movement.concept}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.movement_type === "income" ? "Ingreso" : "Egreso"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="border-b py-3 pr-4 font-medium">{movement.projectName}</TableCell>
                <TableCell className="border-b py-3 pr-4 text-muted-foreground">{movement.clientName}</TableCell>
                <TableCell className="border-b py-3 pr-4 text-muted-foreground">{formatDate(movement.payment_date)}</TableCell>
                <TableCell
                  className={
                    "border-b py-3 text-right font-semibold tabular-nums " +
                    (movement.movement_type === "income"
                      ? "text-success-foreground"
                      : "text-destructive")
                  }
                >
                  {formatCurrency(movement.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
