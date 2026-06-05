import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, PROJECT_SLICE_LABELS } from "@/lib/constants";
import type { PaymentWithMethod } from "@/lib/types";

export function PaymentHistory({ payments }: { payments: PaymentWithMethod[] }) {
  return (
    <Card id="historial" className="p-5 scroll-mt-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Historial de movimientos</h2>
          <p className="text-sm text-muted-foreground">
            {payments.length} registro{payments.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Receipt className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Aún no se registran movimientos para este proyecto.
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Tipo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Forma de pago</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                        (p.movement_type === "income"
                          ? "bg-success/15 text-success-foreground"
                          : "bg-destructive/10 text-destructive")
                      }
                    >
                      {MOVEMENT_TYPE_LABELS[p.movement_type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {p.internal_area ? PROJECT_SLICE_LABELS[p.internal_area] : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{p.concept}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.method?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(p.payment_date)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-medium tabular-nums " +
                      (p.movement_type === "income"
                        ? "text-success-foreground"
                        : "text-destructive")
                    }
                  >
                    {formatCurrency(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
