import {
  ArrowDownLeft,
  BadgeDollarSign,
  Calculator,
  History,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { GeneralBalanceReport, GeneralBalanceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function amountTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
}

function balanceRowTone(row: GeneralBalanceRow) {
  if (row.source === "providers" && Math.abs(row.amount) > 0.001) {
    return "text-destructive";
  }
  return amountTone(row.amount);
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Card
      className={cn(
        "p-5",
        accent && "border-transparent bg-brand text-brand-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              accent ? "text-brand-foreground/80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              !accent && tone === "danger" && "text-destructive",
              !accent && tone === "success" && "text-brand-foreground",
            )}
          >
            {value}
          </p>
          <p
            className={cn(
              "mt-1 text-xs",
              accent ? "text-brand-foreground/70" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accent
              ? "bg-brand-foreground/10"
              : tone === "success"
                ? "bg-brand-muted text-brand-foreground"
                : tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function sourceLabel(row: GeneralBalanceRow) {
  if (row.source === "providers") return "Proveedores";
  if (row.source === "receivable") return "Deudores + Obras por cobrar";
  return "Obras";
}

export function GeneralBalanceView({ report }: { report: GeneralBalanceReport }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Suma total"
          value={signedCurrency(report.total)}
          hint={`${report.rows.length} cuentas consolidadas`}
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Suma menos deudores"
          value={signedCurrency(report.totalWithoutDebtors)}
          hint="Suma total - deudores manuales"
          icon={<Calculator className="size-5" />}
        />
        <Metric
          label="Cuentas por pagar"
          value={signedCurrency(report.providersTotal)}
          hint="Pendiente de pedidos"
          icon={<BadgeDollarSign className="size-5" />}
          tone="danger"
        />
        <Metric
          label="Cuentas por cobrar"
          value={signedCurrency(report.debtorsTotal + report.worksReceivableTotal)}
          hint="Deudores + obras por cobrar"
          icon={<ArrowDownLeft className="size-5" />}
          tone="success"
        />
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl p-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-72">
                  Cuenta
                </TableHead>
                <TableHead className="min-w-56">
                  Origen
                </TableHead>
                <TableHead className="text-right">
                  Monto
                </TableHead>
                <TableHead className="w-32 text-right">
                  <span className="sr-only">Historial</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/finance/balance-general/${row.id}`}
                      className="font-medium transition-colors hover:text-brand-foreground"
                    >
                      {row.label}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sourceLabel(row)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      balanceRowTone(row),
                    )}
                  >
                    {signedCurrency(row.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/finance/balance-general/${row.id}`} />}
                    >
                      <History className="size-4" />
                      Historial
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
