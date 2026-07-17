import { ArrowDownLeft, ArrowUpRight, ListChecks, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  WorkAdministrationUtilityRow,
  WorkFinance,
} from "@/lib/types";

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "success" | "danger";
  accent?: boolean;
}) {
  return (
    <Card className={cn("p-5", accent && "border-transparent bg-brand text-brand-foreground")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          <p className={cn("mt-1 text-xs", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
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

export function WorkFinanceOverview({ finance }: { finance: WorkFinance }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Saldo actual"
        value={formatCurrency(finance.balance)}
        hint="Disponible en la obra"
        icon={<Wallet className="size-5" />}
        accent
      />
      <Stat
        label="Entradas"
        value={formatCurrency(finance.income)}
        hint="Ingresos registrados"
        icon={<ArrowDownLeft className="size-5" />}
        tone="success"
      />
      <Stat
        label="Salidas"
        value={formatCurrency(finance.expense)}
        hint="Egresos registrados"
        icon={<ArrowUpRight className="size-5" />}
        tone="danger"
      />
      <Stat
        label="Movimientos"
        value={String(finance.movementsCount)}
        hint={finance.lastMovementDate ? `Último ${formatDate(finance.lastMovementDate)}` : "Sin movimientos"}
        icon={<ListChecks className="size-5" />}
      />
    </div>
  );
}

export function WorkAdministrationUtilityTable({
  rows,
}: {
  rows: WorkAdministrationUtilityRow[];
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Utilidad por administración</h2>
        <p className="text-sm text-muted-foreground">
          Suma mensual de movimientos con categoría Honorarios.
        </p>
      </div>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-5 text-xs uppercase text-muted-foreground">Fecha</TableHead>
            <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">Utilidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.month}>
              <TableCell className="px-5 font-medium capitalize">
                {monthLabel(row.month)}
              </TableCell>
              <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                {formatCurrency(row.amount)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                Sin honorarios registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
