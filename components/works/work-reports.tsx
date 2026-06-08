import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { round2 } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import type {
  PaymentMethodReportRow,
  WorkAdministrationUtilityRow,
  WorkWithFinance,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function signedTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
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
  icon: ReactNode;
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
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
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

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function WorkReports({
  works,
  paymentMethodRows,
  administrationUtilities,
}: {
  works: WorkWithFinance[];
  paymentMethodRows: PaymentMethodReportRow[];
  administrationUtilities: WorkAdministrationUtilityRow[];
}) {
  const totalIncome = round2(works.reduce((sum, work) => sum + work.finance.income, 0));
  const totalExpense = round2(works.reduce((sum, work) => sum + work.finance.expense, 0));
  const totalBalance = round2(totalIncome - totalExpense);
  const totalAdministration = round2(
    administrationUtilities.reduce((sum, row) => sum + row.amount, 0),
  );
  const activeMethodCount = paymentMethodRows.filter(
    (row) => Math.abs(row.finalBalance) > 0.001,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Saldo total"
          value={signedCurrency(totalBalance)}
          hint={`${works.length} obra${works.length === 1 ? "" : "s"}`}
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Entradas"
          value={formatCurrency(totalIncome)}
          hint="Ingresos de obras"
          icon={<ArrowDownLeft className="size-5" />}
          tone="success"
        />
        <Metric
          label="Salidas"
          value={formatCurrency(totalExpense)}
          hint="Egresos de obras"
          icon={<ArrowUpRight className="size-5" />}
          tone="danger"
        />
        <Metric
          label="Administración"
          value={formatCurrency(totalAdministration)}
          hint={`${administrationUtilities.length} mes${administrationUtilities.length === 1 ? "" : "es"} con honorarios`}
          icon={<TrendingUp className="size-5" />}
          tone="success"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="gap-0 overflow-hidden p-0">
          <SectionTitle
            title="Saldos por forma de pago"
            description={`Balance por cuenta según entradas, salidas y movimientos internos. ${activeMethodCount} forma${activeMethodCount === 1 ? "" : "s"} con saldo.`}
          />
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                  Forma de pago
                </TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">
                  Mov. clientes
                </TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">
                  Mov. internos
                </TableHead>
                <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                  Saldo final
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethodRows.map((row) => (
                <TableRow key={row.methodId}>
                  <TableCell className="px-5 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-brand" />
                      {row.methodName}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", signedTone(row.clientMovements))}>
                    {signedCurrency(row.clientMovements)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", signedTone(row.internalMovements))}>
                    {signedCurrency(row.internalMovements)}
                  </TableCell>
                  <TableCell className={cn("px-5 text-right font-semibold tabular-nums", signedTone(row.finalBalance))}>
                    {signedCurrency(row.finalBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <SectionTitle
            title="Utilidad por administración"
            description="Suma mensual de movimientos con categoría Honorarios."
            action={
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Meses:</span>
                <span className="font-semibold tabular-nums">
                  {administrationUtilities.length}
                </span>
              </div>
            }
          />
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                  Fecha
                </TableHead>
                <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                  Utilidad
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {administrationUtilities.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="px-5 font-medium capitalize">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-brand" />
                      {monthLabel(row.month)}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                    {formatCurrency(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {administrationUtilities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                    Sin honorarios registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
