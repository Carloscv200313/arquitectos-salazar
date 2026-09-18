import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import type { FinanceCaptureReport, FinanceUtilityReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTHS = [
  { key: "01", label: "Enero" },
  { key: "02", label: "Febrero" },
  { key: "03", label: "Marzo" },
  { key: "04", label: "Abril" },
  { key: "05", label: "Mayo" },
  { key: "06", label: "Junio" },
  { key: "07", label: "Julio" },
  { key: "08", label: "Agosto" },
  { key: "09", label: "Septiembre" },
  { key: "10", label: "Octubre" },
  { key: "11", label: "Noviembre" },
  { key: "12", label: "Diciembre" },
];

const ADMIN_ROWS = [
  "Capacitaciones",
  "Bonos",
  "Servicios",
  "Sueldos",
  "Otros gastos",
  "Honorarios Profesionales",
  "Suscripciones",
  "Comisiones Financieras",
  "Prestaciones y Bienestar",
];

const FINANCING_ROWS = ["Pago de interés y capital", "Prestamos", "Créditos"];

type MonthlyValues = Record<string, number>;

interface StatementRow {
  label: string;
  values: MonthlyValues;
  description?: string;
  section?: boolean;
  strong?: boolean;
  dark?: boolean;
}

function zeroValues(): MonthlyValues {
  return Object.fromEntries(MONTHS.map((month) => [month.key, 0]));
}

function monthKeyFromISO(date: string) {
  return date.slice(5, 7);
}

function monthKeyFromPeriod(period: string) {
  return period.slice(5, 7);
}

function addValue(values: MonthlyValues, month: string, amount: number) {
  values[month] = (values[month] ?? 0) + amount;
}

function sumValues(...rows: MonthlyValues[]) {
  const result = zeroValues();
  for (const row of rows) {
    for (const month of MONTHS) result[month.key] += row[month.key] ?? 0;
  }
  return result;
}

function subtractValues(base: MonthlyValues, ...rows: MonthlyValues[]) {
  const result = { ...base };
  for (const row of rows) {
    for (const month of MONTHS) result[month.key] -= row[month.key] ?? 0;
  }
  return result;
}

function valuesByTag(report: FinanceCaptureReport, labels: string[]) {
  const targets = new Map(labels.map((label) => [label.toLowerCase(), { label, values: zeroValues() }]));
  for (const row of report.rows) {
    const tagName = row.concept?.tag?.name?.toLowerCase();
    if (!tagName) continue;
    const target = targets.get(tagName);
    if (!target) continue;
    addValue(target.values, monthKeyFromISO(row.capture_date), Math.abs(row.amount));
  }
  return labels.map((label) => targets.get(label.toLowerCase()) ?? { label, values: zeroValues() });
}

function utilityValues(report: FinanceUtilityReport, field: "projectUtility" | "workUtility") {
  const values = zeroValues();
  for (const row of report.rows) {
    addValue(values, monthKeyFromPeriod(row.month), row[field]);
  }
  return values;
}

function money(value: number) {
  return formatCurrency(value);
}

function percent(value: number, total: number) {
  if (Math.abs(total) < 0.001) return "0,00%";
  return `${((value / total) * 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function StatementTable({
  title,
  subtitle,
  rows,
  showPercent,
}: {
  title: string;
  subtitle?: string;
  rows: StatementRow[];
  showPercent?: boolean;
}) {
  const incomeRow = rows.find((row) => row.label === "Total de ingresos" || row.label === "Ingresos totales");

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-[max-content_minmax(0,1fr)]">
        <div className="border-r bg-background">
          <Table className="w-auto">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="h-10 px-5 pr-8 text-xs uppercase text-muted-foreground">
                  Concepto
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.label}
                  className={cn(
                    "h-10",
                    row.section && "bg-muted/40 hover:bg-muted/40",
                    row.dark && "bg-brand-muted/60 hover:bg-brand-muted/60",
                  )}
                >
                  <TableCell
                    className={cn(
                      "h-10 px-5 py-0 pr-8",
                      row.section && "font-semibold",
                      row.strong && "font-semibold",
                      row.dark && "font-semibold text-brand-foreground",
                    )}
                  >
                    <span data-no-table-truncate>{row.label}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="min-w-0">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                {MONTHS.map((month) => (
                  <TableHead key={month.key} className="h-10 px-3 text-right text-xs uppercase text-muted-foreground">
                    {month.label}
                  </TableHead>
                ))}
                {showPercent && (
                  <TableHead className="h-10 px-3 text-right text-xs uppercase text-muted-foreground">%</TableHead>
                )}
                <TableHead className="h-10 w-80 px-5 text-left text-xs uppercase text-muted-foreground">
                  Descripción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const total = MONTHS.reduce((sum, month) => sum + (row.values[month.key] ?? 0), 0);
                const incomeTotal = incomeRow
                  ? MONTHS.reduce((sum, month) => sum + (incomeRow.values[month.key] ?? 0), 0)
                  : 0;
                return (
                  <TableRow
                    key={row.label}
                    className={cn(
                      "h-10",
                      row.section && "bg-muted/40 hover:bg-muted/40",
                      row.dark && "bg-brand-muted/60 hover:bg-brand-muted/60",
                    )}
                  >
                    {MONTHS.map((month) => (
                      <TableCell
                        key={month.key}
                        className={cn(
                          "h-10 px-3 py-0 text-right tabular-nums",
                          row.strong && "font-semibold",
                          row.dark && "font-semibold text-brand-foreground",
                        )}
                      >
                        {money(row.values[month.key] ?? 0)}
                      </TableCell>
                    ))}
                    {showPercent && (
                      <TableCell
                        className={cn(
                          "h-10 px-3 py-0 text-right font-semibold tabular-nums",
                          row.dark && "text-brand-foreground",
                        )}
                      >
                        {percent(total, incomeTotal)}
                      </TableCell>
                    )}
                    <TableCell className="h-10 px-5 py-0 text-xs text-muted-foreground">
                      {row.description ? (
                        <span
                          className="flex h-7 max-w-80 items-center truncate rounded-md bg-brand-muted/35 px-3 text-brand-foreground"
                          title={row.description}
                          data-no-table-truncate
                        >
                          {row.description}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

export function FinancialStatementsView({
  movements,
  utilities,
}: {
  movements: FinanceCaptureReport;
  utilities: FinanceUtilityReport;
}) {
  const projectIncome = utilityValues(utilities, "projectUtility");
  const workIncome = utilityValues(utilities, "workUtility");
  const totalIncome = sumValues(projectIncome, workIncome);
  const workExpenses = zeroValues();
  const architectCommissions = zeroValues();
  const directCosts = sumValues(workExpenses, architectCommissions);
  const adminRows = valuesByTag(movements, ADMIN_ROWS);
  const financeRows = valuesByTag(movements, FINANCING_ROWS);
  const adminTotal = sumValues(...adminRows.map((row) => row.values));
  const financeTotal = sumValues(...financeRows.map((row) => row.values));
  const grossUtility = subtractValues(totalIncome, directCosts);
  const operatingUtility = subtractValues(grossUtility, adminTotal);
  const beforeTaxes = subtractValues(operatingUtility, financeTotal);
  const taxes = zeroValues();
  const netUtility = subtractValues(beforeTaxes, taxes);

  const cashFlowRows: StatementRow[] = [
    { label: "SALDO INICIAL", values: zeroValues(), strong: true },
    { label: "Flujo operativo", values: zeroValues(), section: true },
    { label: "Ingresos", values: totalIncome, section: true },
    {
      label: "Ingresos por proyectos",
      values: projectIncome,
      description:
        "Estos ingresos vienen del 50% de utilidad que se registra en cada proyecto. Si se llena automáticamente, la utilidad suma aquí.",
    },
    {
      label: "Ingresos de obras",
      values: workIncome,
      description:
        "Estos ingresos vendrán de la categoría Cuenta de Oficina y de los gastos registrados del mes en obras.",
    },
    { label: "Gastos", values: sumValues(directCosts, adminTotal, financeTotal), section: true },
    { label: "Costos directos del servicio", values: directCosts, section: true },
    {
      label: "Gastos en Obras",
      values: workExpenses,
      description:
        "Aquí van los gastos acumulados de obras, menos la salida de la categoría Cuenta de oficina.",
    },
    {
      label: "Comisión a Arquitectos por Proyecto",
      values: architectCommissions,
      description:
        "Comisión o pago semanal a arquitectos tomado del área de Salario.",
    },
    { label: "Gastos administrativos", values: adminTotal, section: true },
    ...adminRows.map((row) => ({
      label: row.label,
      values: row.values,
      description:
        "Esta fila se alimenta con los movimientos que estén amarrados a una etiqueta con este nombre.",
    })),
    { label: "Gasto financiero mensual", values: financeTotal, section: true },
    ...financeRows.map((row) => ({
      label: row.label,
      values: row.values,
      description:
        "Esta fila se alimenta con los movimientos que estén amarrados a una etiqueta con este nombre.",
    })),
  ];

  const resultRows: StatementRow[] = [
    {
      label: "Ingresos totales",
      values: totalIncome,
      description:
        "Los ingresos entran a Cuenta de Oficina; hasta ese momento aparecen en ingresos por obra en el estado de resultados.",
    },
    { label: "Otros ingresos", values: zeroValues() },
    { label: "Total de ingresos", values: totalIncome, section: true, strong: true },
    { label: "Costos directos", values: directCosts },
    { label: "Utilidad bruta", values: grossUtility, strong: true },
    { label: "Gastos Administrativos", values: adminTotal },
    { label: "Utilidad operativa", values: operatingUtility, strong: true },
    { label: "Gastos Financieros", values: financeTotal },
    { label: "Utilidad antes de impuestos", values: beforeTaxes, dark: true },
    { label: "Impuestos", values: taxes },
    { label: "Utilidad neta", values: netUtility, dark: true },
  ];

  return (
    <Tabs defaultValue="flujo-caja" className="gap-5">
      <TabsList variant="line" className="flex w-full flex-wrap justify-start gap-2">
        <TabsTrigger value="flujo-caja" className="flex-none px-3">
          Flujo de caja
        </TabsTrigger>
        <TabsTrigger value="estado-resultados" className="flex-none px-3">
          Estado de resultados
        </TabsTrigger>
      </TabsList>
      <TabsContent value="flujo-caja">
        <StatementTable
          title="Flujo de caja"
          subtitle="Desglose mensual de ingresos y gastos operativos y de financiamiento"
          rows={cashFlowRows}
        />
      </TabsContent>
      <TabsContent value="estado-resultados">
        <StatementTable title="Estado de resultados" rows={resultRows} showPercent />
      </TabsContent>
    </Tabs>
  );
}
