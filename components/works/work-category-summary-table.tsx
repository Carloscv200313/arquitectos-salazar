"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveWorkCategoryBudgetAction } from "@/app/(dashboard)/obras/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { WorkFilesSheet } from "@/components/works/work-files-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { WorkCategorySummary, WorkFile } from "@/lib/types";

function percentLabel(value: number | null) {
  if (value === null) return "—";
  return `${formatNumber(value)}%`;
}

function budgetInputValue(value: number | null) {
  if (value === null || Math.abs(value) < 0.001) return "";
  return String(value);
}

function movementSummary(row: WorkCategorySummary) {
  const hasIncome = row.income > 0.001;
  const hasExpense = row.expense > 0.001;
  if (hasIncome && hasExpense) {
    const net = row.income - row.expense;
    return {
      type: "Mixto",
      amount: net,
      percent: null,
      badgeClass: "bg-muted text-muted-foreground",
      amountClass: net < -0.001 ? "text-destructive" : "text-brand-foreground",
    };
  }
  if (hasIncome) {
    return {
      type: "Ingreso",
      amount: row.income,
      percent: row.incomePercent,
      badgeClass: "bg-brand-muted text-brand-foreground",
      amountClass: "text-brand-foreground",
    };
  }
  if (hasExpense) {
    return {
      type: "Egreso",
      amount: row.expense,
      percent: row.expensePercent,
      badgeClass: "bg-destructive/10 text-destructive",
      amountClass: "text-destructive",
    };
  }
  return {
    type: "Sin movimiento",
    amount: 0,
    percent: null,
    badgeClass: "bg-muted text-muted-foreground",
    amountClass: "text-muted-foreground",
  };
}

function differencePercentLabel(row: WorkCategorySummary) {
  const budget = row.budget ?? 0;
  const executed = row.executedAmount ?? 0;
  if (budget <= 0.001) return "—";
  return percentLabel((executed * 100) / budget);
}

export function WorkCategorySummaryTable({
  workId,
  workName,
  clientName,
  initialFiles,
  rows: initialRows,
}: {
  workId: string;
  workName: string;
  clientName: string;
  initialFiles: WorkFile[];
  rows: WorkCategorySummary[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [filesOpen, setFilesOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { budget: string; executed: string }>>(() =>
    Object.fromEntries(
      initialRows.map((row) => [
        row.category,
        {
          budget: budgetInputValue(row.budget),
          executed: budgetInputValue(row.executedAmount),
        },
      ]),
    ),
  );
  const [isPending, startTransition] = useTransition();

  const orderedRows = useMemo(
    () => rows.slice().sort((a, b) => a.category.localeCompare(b.category, "es")),
    [rows],
  );

  function saveBudget(category: string) {
    const draft = drafts[category] ?? { budget: "", executed: "" };
    const budget = draft.budget.trim() === "" ? 0 : Number(draft.budget);
    const executedAmount = draft.executed.trim() === "" ? 0 : Number(draft.executed);

    if (!Number.isFinite(budget) || budget < 0) {
      toast.error("Ingresa un presupuesto válido.");
      return;
    }
    if (!Number.isFinite(executedAmount) || executedAmount < 0) {
      toast.error("Ingresa un ejecutado válido.");
      return;
    }

    startTransition(async () => {
      const result = await saveWorkCategoryBudgetAction({
        workId,
        category,
        budget,
        executedAmount,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setRows(result.data.rows);
      setDrafts(
        Object.fromEntries(
          result.data.rows.map((row) => [
            row.category,
            {
              budget: budgetInputValue(row.budget),
              executed: budgetInputValue(row.executedAmount),
            },
          ]),
        ),
      );
      toast.success("Categoría actualizada", { description: category });
    });
  }

  return (
    <>
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">Resumen por categoría</h2>
            <p className="text-sm text-muted-foreground">
              Presupuesto manual e indicadores por categoría de la obra.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilesOpen(true)}>
            <FileText className="size-4" />
            Archivos
          </Button>
        </div>
        <div className="max-h-[14.5rem] overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="sticky top-0 z-10 bg-muted/95 px-5 text-xs uppercase text-muted-foreground">Categoría</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-right text-xs uppercase text-muted-foreground">Presupuesto</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs uppercase text-muted-foreground">Tipo</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-right text-xs uppercase text-muted-foreground">Monto registrado</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-right text-xs uppercase text-muted-foreground">% sobre presupuesto</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-right text-xs uppercase text-muted-foreground">Ejecutado</TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted/95 text-right text-xs uppercase text-muted-foreground">Diferencia %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedRows.map((row) => {
                const movement = movementSummary(row);
                return (
                  <TableRow key={row.category}>
                    <TableCell className="px-5 font-medium">{row.category}</TableCell>
                    <TableCell className="min-w-44">
                      <div className="flex items-center justify-end gap-2">
                        <MoneyInput
                          value={drafts[row.category]?.budget ?? ""}
                          onValueChange={(value) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.category]: {
                                budget: value,
                                executed: current[row.category]?.executed ?? "",
                              },
                            }))
                          }
                          className="w-28 text-right tabular-nums"
                          placeholder="0.00"
                        />
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => saveBudget(row.category)}
                          disabled={isPending}
                          title="Guardar presupuesto"
                        >
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          <span className="sr-only">Guardar presupuesto</span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${movement.badgeClass}`}>
                        {movement.type}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${movement.amountClass}`}>
                      {formatCurrency(Math.abs(movement.amount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {percentLabel(movement.percent)}
                    </TableCell>
                    <TableCell className="min-w-44">
                      <div className="flex items-center justify-end gap-2">
                        <MoneyInput
                          value={drafts[row.category]?.executed ?? ""}
                          onValueChange={(value) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.category]: {
                                budget: current[row.category]?.budget ?? "",
                                executed: value,
                              },
                            }))
                          }
                          className="w-28 text-right tabular-nums"
                          placeholder="0.00"
                        />
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => saveBudget(row.category)}
                          disabled={isPending}
                          title="Guardar ejecutado"
                        >
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          <span className="sr-only">Guardar ejecutado</span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 text-right font-medium tabular-nums text-muted-foreground">
                      {differencePercentLabel(row)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {orderedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    Sin categorías registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <WorkFilesSheet
        open={filesOpen}
        onOpenChange={setFilesOpen}
        workId={workId}
        workName={workName}
        clientName={clientName}
        initialFiles={initialFiles}
      />
    </>
  );
}
