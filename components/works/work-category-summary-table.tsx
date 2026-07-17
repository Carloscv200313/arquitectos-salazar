"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveWorkCategoryBudgetAction } from "@/app/(dashboard)/obras/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { WorkCategorySummary } from "@/lib/types";

function signedTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
}

function percentLabel(value: number | null) {
  if (value === null) return "—";
  return `${formatNumber(value)}%`;
}

function budgetInputValue(value: number | null) {
  if (value === null || Math.abs(value) < 0.001) return "";
  return String(value);
}

export function WorkCategorySummaryTable({
  workId,
  rows: initialRows,
}: {
  workId: string;
  rows: WorkCategorySummary[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.category, budgetInputValue(row.budget)])),
  );
  const [isPending, startTransition] = useTransition();

  const orderedRows = useMemo(
    () => rows.slice().sort((a, b) => a.category.localeCompare(b.category, "es")),
    [rows],
  );

  function saveBudget(category: string) {
    const raw = (drafts[category] ?? "").trim();
    const amount = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Ingresa un presupuesto válido.");
      return;
    }

    startTransition(async () => {
      const result = await saveWorkCategoryBudgetAction({
        workId,
        category,
        amount,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setRows(result.data.rows);
      setDrafts(
        Object.fromEntries(
          result.data.rows.map((row) => [row.category, budgetInputValue(row.budget)]),
        ),
      );
      toast.success("Presupuesto actualizado", { description: category });
    });
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Resumen por categoría</h2>
        <p className="text-sm text-muted-foreground">
          Presupuesto manual e indicadores por categoría de la obra.
        </p>
      </div>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-5 text-xs uppercase text-muted-foreground">Categoría</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Presupuesto</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Ingresos</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">% ingresos</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Egresos</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">% egresos</TableHead>
            <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">% ejecutado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderedRows.map((row) => (
            <TableRow key={row.category}>
              <TableCell className="px-5 font-medium">{row.category}</TableCell>
              <TableCell className="min-w-44">
                <div className="flex items-center justify-end gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={drafts[row.category] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.category]: event.target.value,
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
              <TableCell className="text-right tabular-nums text-brand-foreground">
                {formatCurrency(row.income)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {percentLabel(row.incomePercent)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-destructive">
                {formatCurrency(row.expense)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {percentLabel(row.expensePercent)}
              </TableCell>
              <TableCell
                className={cn(
                  "px-5 text-right font-semibold tabular-nums",
                  row.executedPercent !== null && row.executedPercent >= 100
                    ? "text-destructive"
                    : signedTone(row.balance),
                )}
              >
                {percentLabel(row.executedPercent)}
              </TableCell>
            </TableRow>
          ))}
          {orderedRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                Sin categorías registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
