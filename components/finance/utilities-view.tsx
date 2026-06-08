import { Building2, FolderKanban, TrendingUp } from "lucide-react";
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
import type { FinanceUtilityReport } from "@/lib/types";
import { cn } from "@/lib/utils";

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
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
            accent ? "bg-brand-foreground/10" : "bg-brand-muted text-brand-foreground",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function UtilitiesView({ report }: { report: FinanceUtilityReport }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          label="Utilidad total"
          value={formatCurrency(report.total)}
          hint={`${report.rows.length} mes${report.rows.length === 1 ? "" : "es"} con utilidad`}
          icon={<TrendingUp className="size-5" />}
          accent
        />
        <Metric
          label="Utilidad de obras"
          value={formatCurrency(report.workTotal)}
          hint="Categoría Honorarios"
          icon={<Building2 className="size-5" />}
        />
        <Metric
          label="Utilidad de proyectos"
          value={formatCurrency(report.projectTotal)}
          hint="30% de ingresos"
          icon={<FolderKanban className="size-5" />}
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Utilidades mensuales</h2>
          <p className="text-sm text-muted-foreground">
            Comparativo mensual entre utilidades de obras y proyectos.
          </p>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                Mes
              </TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">
                Utilidad obras
              </TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">
                Utilidad proyectos
              </TableHead>
              <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="px-5 font-medium capitalize">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" />
                    {monthLabel(row.month)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                  {formatCurrency(row.workUtility)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                  {formatCurrency(row.projectUtility)}
                </TableCell>
                <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                  {formatCurrency(row.totalUtility)}
                </TableCell>
              </TableRow>
            ))}
            {report.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Sin utilidades registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
