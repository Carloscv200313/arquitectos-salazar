"use client";

import { useState } from "react";
import type { Workbook, Worksheet } from "exceljs";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

const FINANCING_ROWS = ["Pago de interés y capital", "Prestamos", "Créditos"];
const RESERVED_INCOME_TAGS = new Set([
  "otros ingresos",
  "otro ingreso",
  "ingresos por proyectos",
  "ingresos de obras",
]);
const RESERVED_DIRECT_COST_TAGS = new Set([
  "comision a arquitectos por proyecto",
  "gastos en obras",
]);

type MonthlyValues = Record<string, number>;

interface StatementRow {
  label: string;
  values: MonthlyValues;
  description?: string;
  section?: boolean;
  mutedBlock?: boolean;
  strong?: boolean;
  dark?: boolean;
  hideValues?: boolean;
  tone?: "income" | "direct" | "admin" | "finance";
}

function normalizedLabel(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isFinancingLabel(value: string) {
  const normalized = normalizedLabel(value);
  return FINANCING_ROWS.some((label) => normalizedLabel(label) === normalized);
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizedLabel(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function hasValues(values: MonthlyValues) {
  return MONTHS.some((month) => Math.abs(values[month.key] ?? 0) > 0.001);
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
  const targets = new Map(
    labels.map((label) => [normalizedLabel(label), { label, values: zeroValues() }]),
  );
  for (const row of report.rows) {
    if (row.movement_type !== "expense") continue;
    const tagName = row.concept?.tag?.name
      ? normalizedLabel(row.concept.tag.name)
      : undefined;
    if (!tagName) continue;
    const target = targets.get(tagName);
    if (!target) continue;
    addValue(target.values, monthKeyFromISO(row.capture_date), Math.abs(row.amount));
  }
  return labels.map(
    (label) => targets.get(normalizedLabel(label)) ?? { label, values: zeroValues() },
  );
}

function valuesByMovementType(report: FinanceCaptureReport, movementType: "income" | "expense") {
  const values = zeroValues();
  for (const row of report.rows) {
    if (row.movement_type !== movementType) continue;
    addValue(values, monthKeyFromISO(row.capture_date), Math.abs(row.amount));
  }
  return values;
}

function utilityValues(report: FinanceUtilityReport, field: "projectUtility" | "workUtility") {
  const values = zeroValues();
  for (const row of report.rows) {
    addValue(values, monthKeyFromPeriod(row.month), row[field]);
  }
  return values;
}

function monthlyAmountValues(rows: Array<{ month: string; amount: number }>) {
  const values = zeroValues();
  for (const row of rows) {
    addValue(values, monthKeyFromPeriod(row.month), row.amount);
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

function rowToneClass(tone: StatementRow["tone"]) {
  switch (tone) {
    case "income":
      return "border-l-4 border-l-emerald-500 bg-emerald-50/70 hover:bg-emerald-50/70";
    case "direct":
      return "border-l-4 border-l-sky-500 bg-sky-50/70 hover:bg-sky-50/70";
    case "admin":
      return "border-l-4 border-l-amber-500 bg-amber-50/70 hover:bg-amber-50/70";
    case "finance":
      return "border-l-4 border-l-rose-500 bg-rose-50/70 hover:bg-rose-50/70";
    default:
      return undefined;
  }
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
      <Table className={showPercent ? "w-max min-w-[1680px]" : "w-max min-w-[1080px]"}>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead
              rowSpan={showPercent ? 2 : 1}
              className={cn(
                "sticky left-0 z-20 w-max min-w-[max-content] border-r bg-muted px-5 pr-8 text-xs uppercase text-muted-foreground",
                showPercent ? "h-16" : "h-10",
              )}
            >
              Concepto
            </TableHead>
            {MONTHS.map((month) => (
              <TableHead
                key={month.key}
                colSpan={showPercent ? 2 : 1}
                className={cn(
                  "px-3 text-center text-xs uppercase text-muted-foreground",
                  showPercent ? "h-8" : "h-10",
                )}
              >
                {month.label}
              </TableHead>
            ))}
          </TableRow>
          {showPercent && (
            <TableRow>
              {MONTHS.flatMap((month) => [
                <TableHead
                  key={`${month.key}-amount`}
                  className="h-8 px-3 text-right text-[11px] uppercase text-muted-foreground"
                >
                  Monto
                </TableHead>,
                <TableHead
                  key={`${month.key}-percent`}
                  className="h-8 w-20 px-3 text-right text-[11px] uppercase text-muted-foreground"
                >
                  %
                </TableHead>,
              ])}
            </TableRow>
          )}
        </TableHeader>
        <TableBody paginate={false}>
          {rows.map((row) => (
            <TableRow
              key={row.label}
              className={cn(
                "h-10",
                row.section && "bg-muted/40 hover:bg-muted/40",
                row.mutedBlock && "bg-muted hover:bg-muted",
                row.dark && "bg-brand-muted/60 hover:bg-brand-muted/60",
                rowToneClass(row.tone),
              )}
            >
              <TableCell
                className={cn(
                  "sticky left-0 z-10 h-10 w-max min-w-[max-content] border-r bg-background px-5 py-0 pr-8",
                  row.section && "bg-muted/40 font-semibold",
                  row.mutedBlock && "bg-muted font-semibold text-foreground",
                  row.strong && "font-semibold",
                  row.dark && "bg-brand-muted/60 font-semibold text-brand-foreground",
                  row.tone === "income" && "bg-emerald-50",
                  row.tone === "direct" && "bg-sky-50",
                  row.tone === "admin" && "bg-amber-50",
                  row.tone === "finance" && "bg-rose-50",
                )}
              >
                {row.label}
              </TableCell>
              {MONTHS.flatMap((month) => {
                const amount = row.values[month.key] ?? 0;
                const income = incomeRow?.values[month.key] ?? 0;
                const cellClass = cn(
                  "h-10 px-3 py-0 text-right tabular-nums",
                  row.mutedBlock && "font-semibold text-foreground",
                  row.strong && "font-semibold",
                  row.dark && "font-semibold text-brand-foreground",
                );
                return [
                  <TableCell key={`${month.key}-amount`} className={cellClass}>
                    {row.hideValues ? null : money(amount)}
                  </TableCell>,
                  ...(showPercent
                    ? [
                        <TableCell
                          key={`${month.key}-percent`}
                          className={cn(cellClass, "font-semibold")}
                        >
                          {row.hideValues ? null : percent(amount, income)}
                        </TableCell>,
                      ]
                    : []),
                ];
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

const EXCEL_TONE_FILLS: Record<NonNullable<StatementRow["tone"]>, string> = {
  income: "FFE8F7EE",
  direct: "FFE8F3FA",
  admin: "FFFFF4D6",
  finance: "FFFFE8EA",
};

function styleExcelRow(
  worksheet: Worksheet,
  rowNumber: number,
  statementRow: StatementRow,
) {
  const row = worksheet.getRow(rowNumber);
  row.height = 20;
  if (statementRow.tone) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: EXCEL_TONE_FILLS[statementRow.tone] },
    };
  }
  if (statementRow.section || statementRow.strong || statementRow.dark) {
    row.font = { bold: true, color: { argb: statementRow.dark ? "FF173B16" : "FF111827" } };
  }
  if (statementRow.dark) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE3F3D5" },
    };
  }
  row.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
    cell.alignment = { vertical: "middle" };
  });
}

function addStatementWorksheet(
  workbook: Workbook,
  name: string,
  title: string,
  rows: StatementRow[],
  showPercent: boolean,
) {
  const worksheet = workbook.addWorksheet(name, {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  const columnCount = 1 + MONTHS.length * (showPercent ? 2 : 1);
  worksheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: "FF173B16" } };
  titleCell.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 28;

  let dataStart = 3;
  if (showPercent) {
    worksheet.getCell(2, 1).value = "Concepto";
    worksheet.mergeCells(2, 1, 3, 1);
    MONTHS.forEach((month, index) => {
      const startColumn = 2 + index * 2;
      worksheet.getCell(2, startColumn).value = month.label;
      worksheet.mergeCells(2, startColumn, 2, startColumn + 1);
      worksheet.getCell(3, startColumn).value = "Monto";
      worksheet.getCell(3, startColumn + 1).value = "%";
    });
    dataStart = 4;
  } else {
    worksheet.addRow(["Concepto", ...MONTHS.map((month) => month.label)]);
  }

  for (let rowNumber = 2; rowNumber < dataStart; rowNumber += 1) {
    const header = worksheet.getRow(rowNumber);
    header.height = 20;
    header.font = { bold: true, color: { argb: "FF4B5563" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    header.alignment = { horizontal: "center", vertical: "middle" };
  }

  const incomeRow = rows.find(
    (row) => row.label === "Total de ingresos" || row.label === "Ingresos totales",
  );
  rows.forEach((statementRow, index) => {
    const values: Array<string | number | null> = [statementRow.label];
    MONTHS.forEach((month) => {
      const amount = statementRow.values[month.key] ?? 0;
      values.push(statementRow.hideValues ? null : amount);
      if (showPercent) {
        const income = incomeRow?.values[month.key] ?? 0;
        values.push(statementRow.hideValues ? null : Math.abs(income) < 0.001 ? 0 : amount / income);
      }
    });
    const rowNumber = dataStart + index;
    worksheet.addRow(values);
    styleExcelRow(worksheet, rowNumber, statementRow);
  });

  worksheet.getColumn(1).width = 42;
  for (let column = 2; column <= columnCount; column += 1) {
    const isPercentColumn = showPercent && column % 2 === 1;
    worksheet.getColumn(column).width = isPercentColumn ? 11 : 16;
    worksheet.getColumn(column).alignment = { horizontal: "right" };
    worksheet.getColumn(column).numFmt = isPercentColumn
      ? "0.00%"
      : '$#,##0.00;[Red]-$#,##0.00';
  }
  worksheet.views = [{ state: "frozen", xSplit: 1, ySplit: dataStart - 1 }];
  worksheet.headerFooter.oddFooter = "Página &P de &N";
  worksheet.pageSetup.printTitlesRow = `1:${dataStart - 1}`;
  return worksheet;
}

export function FinancialStatementsView({
  movements,
  utilities,
  workIncome,
  workExpenses,
  architectCommissions,
  administrativeSalaries,
}: {
  movements: FinanceCaptureReport;
  utilities: FinanceUtilityReport;
  workIncome: Array<{ month: string; amount: number }>;
  workExpenses: Array<{ month: string; amount: number }>;
  architectCommissions: Array<{ month: string; amount: number }>;
  administrativeSalaries: Array<{ month: string; amount: number }>;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const projectIncome = utilityValues(utilities, "projectUtility");
  const workIncomeValues = monthlyAmountValues(workIncome);
  const otherIncome = valuesByMovementType(movements, "income");
  const regularIncome = sumValues(projectIncome, workIncomeValues);
  const totalIncome = sumValues(regularIncome, otherIncome);
  const workExpenseValues = monthlyAmountValues(workExpenses);
  const architectCommissionValues = monthlyAmountValues(architectCommissions);
  const administrativeSalaryValues = monthlyAmountValues(administrativeSalaries);
  const directCosts = sumValues(workExpenseValues, architectCommissionValues);
  const tagLabels = uniqueLabels(movements.tags.map((tag) => tag.name));
  const financeLabels = tagLabels.filter(isFinancingLabel);
  const adminLabels = tagLabels.filter((label) => {
    const normalized = normalizedLabel(label);
    return (
      !RESERVED_INCOME_TAGS.has(normalized) &&
      !RESERVED_DIRECT_COST_TAGS.has(normalized) &&
      !isFinancingLabel(label)
    );
  });
  if (
    hasValues(administrativeSalaryValues) &&
    !adminLabels.some((label) => normalizedLabel(label) === "sueldos")
  ) {
    adminLabels.push("Sueldos");
  }
  const adminRows: StatementRow[] = valuesByTag(movements, adminLabels).map((row): StatementRow =>
    normalizedLabel(row.label) === "sueldos"
      ? {
          ...row,
          values: sumValues(row.values, administrativeSalaryValues),
          tone: "admin",
          description:
            "Aquí se cruzan los pagos por semana registrados en Salario y las capturas manuales vinculadas a la etiqueta Sueldos. No incluye pagos por proyecto ni mano de obra de Obras.",
        }
      : { ...row, tone: "admin" },
  );
  const financeRows: StatementRow[] = valuesByTag(movements, financeLabels).map((row) => ({
    ...row,
    tone: "finance",
  }));
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
    { label: "Ingresos", values: totalIncome, section: true, tone: "income" },
    {
      label: "Ingresos por proyectos",
      values: projectIncome,
      tone: "income",
      description:
        "Estos ingresos vienen del 50% de utilidad que se registra en cada proyecto. Esta información se llena de forma automática: si dan un abono a un proyecto en Utilidad, entonces esa utilidad suma aquí.",
    },
    {
      label: "Ingresos de obras",
      values: workIncomeValues,
      tone: "income",
      description:
        "Estos ingresos van a venir de la categoría que se va a dar de alta llamada Cuenta de Oficina, más todos los gastos registrados ese mes en las obras. En ese momento aparece aquí el ingreso por obra en el estado de resultados. Se registra un movimiento en la categoría Cuenta de Oficina donde se registran los movimientos de obras como una salida de utilidad. Este movimiento queda registrado en la obra y en la tabla Resumen por categoría.",
    },
    {
      label: "Otros ingresos",
      values: otherIncome,
      tone: "income",
      description:
        "Ingresos registrados directamente en Finanzas > Movimientos. Se acumulan aquí y también en Otros ingresos del estado de resultados.",
    },
    {
      label: "Gastos",
      values: sumValues(directCosts, adminTotal, financeTotal),
      section: true,
      tone: "direct",
    },
    {
      label: "Costos directos del servicio",
      values: directCosts,
      section: true,
      mutedBlock: true,
      hideValues: true,
      tone: "direct",
    },
    {
      label: "Gastos en Obras",
      values: workExpenseValues,
      tone: "direct",
      description:
        "Aquí se suman los gastos directos registrados dentro de las obras, incluidas las categorías Honorario, Honorarios y Mano de obra. Solo se excluye Cuenta de Oficina.",
    },
    {
      label: "Comisión a Arquitectos por Proyecto",
      values: architectCommissionValues,
      tone: "direct",
      description:
        "Pagos a arquitectos vinculados a un proyecto, registrados desde Proyectos con concepto Pago de... o desde Salario como Pago proyecto.",
    },
    {
      label: "Gastos administrativos",
      values: adminTotal,
      section: true,
      mutedBlock: true,
      hideValues: true,
      tone: "admin",
    },
    ...adminRows.map((row) => ({
      label: row.label,
      values: row.values,
      tone: "admin" as const,
      description:
        row.description ??
        "Estos campos quedan pendientes de nombre o se ponen dinámicos para que aparezcan cuando se agreguen etiquetas.",
    })),
    {
      label: "Gasto financiero mensual",
      values: financeTotal,
      section: true,
      mutedBlock: true,
      hideValues: true,
      tone: "finance",
    },
    ...financeRows.map((row) => ({
      label: row.label,
      values: row.values,
      tone: "finance" as const,
      description:
        "Estos campos quedan pendientes de nombre o se ponen dinámicos para que aparezcan cuando se agreguen etiquetas.",
    })),
  ];

  const resultRows: StatementRow[] = [
    {
      label: "Ingresos totales",
      values: regularIncome,
      tone: "income",
      description:
        "Los ingresos entran a Cuenta de Oficina; hasta ese momento aparecen en ingresos por obra en el estado de resultados.",
    },
    {
      label: "Otros ingresos",
      values: otherIncome,
      tone: "income",
      description:
        "Ingresos registrados directamente en Finanzas > Movimientos.",
    },
    {
      label: "Total de ingresos",
      values: totalIncome,
      section: true,
      strong: true,
      tone: "income",
    },
    { label: "Costos directos", values: directCosts, tone: "direct" },
    { label: "Utilidad bruta", values: grossUtility, strong: true },
    { label: "Gastos Administrativos", values: adminTotal, tone: "admin" },
    { label: "Utilidad operativa", values: operatingUtility, strong: true },
    { label: "Gastos Financieros", values: financeTotal, tone: "finance" },
    { label: "Utilidad antes de impuestos", values: beforeTaxes, dark: true },
    { label: "Impuestos", values: taxes },
    { label: "Utilidad neta", values: netUtility, dark: true },
  ];

  async function exportExcel() {
    setIsExporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Arquitectos Salazar";
      workbook.created = new Date();
      addStatementWorksheet(workbook, "Flujo de caja", "Flujo de caja", cashFlowRows, false);
      addStatementWorksheet(
        workbook,
        "Estado de resultados",
        "Estado de resultados",
        resultRows,
        true,
      );
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `estados-financieros-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel generado", {
        description: "Incluye Flujo de caja y Estado de resultados.",
      });
    } catch (error) {
      console.error("[financial-statements] No se pudo generar el Excel:", error);
      toast.error("No se pudo generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Tabs defaultValue="flujo-caja" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList variant="line" className="flex flex-wrap justify-start gap-2">
          <TabsTrigger value="flujo-caja" className="flex-none px-3">
            Flujo de caja
          </TabsTrigger>
          <TabsTrigger value="estado-resultados" className="flex-none px-3">
            Estado de resultados
          </TabsTrigger>
        </TabsList>
        <Button variant="outline" onClick={exportExcel} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Generar Excel
        </Button>
      </div>
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
