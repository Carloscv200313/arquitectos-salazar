"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, FilterX, Loader2, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, WorkMovementWithBalance } from "@/lib/types";
import { WorkMovementActions } from "./work-movement-actions";

const ALL_PROVIDERS = "__all_providers__";
const ALL_CATEGORIES = "__all_categories__";
const ALL_PROVIDERS_LABEL = "Todos los proveedores";
const ALL_CATEGORIES_LABEL = "Todas las categorías";

function signedTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
}

function movementReceiptCode(movement: WorkMovementWithBalance) {
  return movement.folio ?? movement.receipt ?? "";
}

export function WorkMovementsTable({
  movements,
  workId,
  workName,
  clientName,
  methods,
  providers,
  categories,
}: {
  movements: WorkMovementWithBalance[];
  workId: string;
  workName: string;
  clientName: string;
  methods: PaymentMethod[];
  providers: string[];
  categories: string[];
}) {
  const [providerFilter, setProviderFilter] = useState(ALL_PROVIDERS);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [isExporting, setIsExporting] = useState(false);

  const hasActiveFilters =
    providerFilter !== ALL_PROVIDERS || categoryFilter !== ALL_CATEGORIES || !!search.trim();

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        const term = search.trim().toLowerCase();
        if (term) {
          const searchable = [
            movement.folio,
            movement.receipt,
            movement.concept,
            movement.supplier,
            movement.category,
            movement.method?.name,
            movement.observations,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!searchable.includes(term)) return false;
        }
        if (
          providerFilter !== ALL_PROVIDERS &&
          movement.supplier !== providerFilter
        ) {
          return false;
        }
        if (
          categoryFilter !== ALL_CATEGORIES &&
          movement.category !== categoryFilter
        ) {
          return false;
        }
        return true;
      }),
    [movements, providerFilter, categoryFilter, search],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const movement of filteredMovements) {
      if (movement.movement_type === "income") income += movement.amount;
      else expense += movement.amount;
    }
    return { income, expense };
  }, [filteredMovements]);

  const sortedMovements = useMemo(() => {
    return [...filteredMovements].sort((a, b) => {
      const byDate =
        dateSort === "desc"
          ? b.movement_date.localeCompare(a.movement_date)
          : a.movement_date.localeCompare(b.movement_date);
      if (byDate !== 0) return byDate;
      return dateSort === "desc"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at);
    });
  }, [dateSort, filteredMovements]);

  const providerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...providers, ...movements.map((movement) => movement.supplier)].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [movements, providers],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...categories, ...movements.map((movement) => movement.category)].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [categories, movements],
  );

  async function exportPdf() {
    if (sortedMovements.length === 0) return;
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 10;
      const marginTop = 12;
      const usableWidth = pageWidth - marginX * 2;
      const colWidths = [22, 22, 18, 48, 30, 26, 21, 21, 21, 27];
      const rowHeight = 7;
      const contentBottom = pageHeight - 10;
      const headers = [
        "Folio",
        "Recibo",
        "Fecha",
        "Concepto",
        "Proveedor",
        "Categoría",
        "Entrada",
        "Salida",
        "Saldo",
        "Forma de pago",
      ];

      let y = marginTop;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Historial de movimientos de la obra", marginX, y);
      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        `Proveedor: ${providerFilter === ALL_PROVIDERS ? ALL_PROVIDERS_LABEL : providerFilter}`,
        marginX,
        y,
      );
      pdf.text(
        `Categoría: ${categoryFilter === ALL_CATEGORIES ? ALL_CATEGORIES_LABEL : categoryFilter}`,
        marginX + 70,
        y,
      );
      pdf.text(`Registros: ${sortedMovements.length}`, pageWidth - marginX - 30, y, {
        align: "right",
      });
      y += 5;
      pdf.text(`Entradas: ${formatCurrency(totals.income)}`, marginX, y);
      pdf.text(`Salidas: ${formatCurrency(totals.expense)}`, marginX + 70, y);
      y += 6;

      const drawHeader = () => {
        let x = marginX;
        pdf.setFillColor(244, 244, 245);
        pdf.rect(marginX, y, usableWidth, rowHeight, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        headers.forEach((header, index) => {
          const width = colWidths[index];
          const align = index >= 5 && index <= 7 ? "right" : "left";
          const textX = align === "right" ? x + width - 1.5 : x + 1.5;
          pdf.text(header, textX, y + 4.6, { align });
          x += width;
        });
        y += rowHeight;
      };

      const ensureSpace = (height: number) => {
        if (y + height <= contentBottom) return;
        pdf.addPage();
        y = marginTop;
        drawHeader();
      };

      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      for (const movement of sortedMovements) {
        const cells = [
          movement.folio ?? "—",
          movement.receipt || "—",
          formatDate(movement.movement_date),
          movement.concept,
          movement.supplier,
          movement.category,
          movement.movement_type === "income" ? formatCurrency(movement.amount) : "—",
          movement.movement_type === "expense" ? formatCurrency(movement.amount) : "—",
          formatCurrency(movement.balance),
          movement.method?.name ?? "Sin forma",
        ];

        const wrapped = cells.map((cell, index) =>
          pdf.splitTextToSize(String(cell), colWidths[index] - 3),
        );
        const height = Math.max(...wrapped.map((lines) => lines.length), 1) * 4.2 + 2.8;
        ensureSpace(height);

        let x = marginX;
        wrapped.forEach((lines, index) => {
          const width = colWidths[index];
          const align = index >= 5 && index <= 7 ? "right" : "left";
          const textX = align === "right" ? x + width - 1.5 : x + 1.5;
          pdf.text(lines, textX, y + 4, { align, baseline: "top" });
          x += width;
        });

        pdf.setDrawColor(229, 231, 235);
        pdf.line(marginX, y + height, pageWidth - marginX, y + height);
        y += height;
      }

      const slug = (value: string) =>
        value
          .toLowerCase()
          .normalize("NFD")
          .replaceAll(/[\u0300-\u036f]/g, "")
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replaceAll(/^-+|-+$/g, "");
      const exportDate = new Date().toISOString().slice(0, 10);
      pdf.save(`${exportDate}-${slug(workName)}-${slug(clientName)}.pdf`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card id="movimientos" className="gap-0 overflow-hidden p-0">
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="font-semibold">Historial de movimientos</h2>
            <p className="text-sm text-muted-foreground">
              Entradas y salidas con filtros en tiempo real.
            </p>
          </div>
          <div className="grid gap-3 xl:mx-auto xl:min-w-[860px] xl:max-w-[920px] xl:grid-cols-[minmax(0,240px)_minmax(0,190px)_minmax(0,190px)_auto_auto] xl:items-end">
            <div className="grid gap-1.5 xl:justify-self-center">
              <span className="text-xs font-medium uppercase text-muted-foreground">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Recibo o número de nota..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-1.5 xl:justify-self-center">
              <span className="text-xs font-medium uppercase text-muted-foreground">Proveedor</span>
              <Select value={providerFilter} onValueChange={(value) => setProviderFilter(value ?? ALL_PROVIDERS)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {providerFilter === ALL_PROVIDERS ? ALL_PROVIDERS_LABEL : providerFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROVIDERS}>{ALL_PROVIDERS_LABEL}</SelectItem>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 xl:justify-self-center">
              <span className="text-xs font-medium uppercase text-muted-foreground">Categoría</span>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? ALL_CATEGORIES)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {categoryFilter === ALL_CATEGORIES ? ALL_CATEGORIES_LABEL : categoryFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>{ALL_CATEGORIES_LABEL}</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end xl:justify-self-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setProviderFilter(ALL_PROVIDERS);
                  setCategoryFilter(ALL_CATEGORIES);
                }}
                disabled={!hasActiveFilters}
              >
                <FilterX className="size-4" />
                Limpiar filtros
              </Button>
            </div>
            <div className="flex items-end xl:justify-self-center">
              <Button
                variant="outline"
                onClick={exportPdf}
                disabled={isExporting || sortedMovements.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Exportar PDF
              </Button>
            </div>
            {hasActiveFilters && (
              <>
                <div className="flex items-end xl:justify-self-center">
                  <span className="inline-flex h-8 items-center rounded-lg bg-brand-muted px-3 text-xs font-semibold tabular-nums text-brand-foreground">
                    Entradas: {formatCurrency(totals.income)}
                  </span>
                </div>
                <div className="flex items-end xl:justify-self-center">
                  <span className="inline-flex h-8 items-center rounded-lg bg-destructive/10 px-3 text-xs font-semibold tabular-nums text-destructive">
                    Salidas: {formatCurrency(totals.expense)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-5 text-xs uppercase text-muted-foreground">Folio</TableHead>
            <TableHead className="px-5 text-xs uppercase text-muted-foreground">Recibo</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium uppercase text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setDateSort((current) => (current === "desc" ? "asc" : "desc"))}
                title={dateSort === "desc" ? "Ordenar de más antiguo a más reciente" : "Ordenar de más reciente a más antiguo"}
              >
                Fecha
                {dateSort === "desc" ? (
                  <ArrowDown className="size-3.5" />
                ) : (
                  <ArrowUp className="size-3.5" />
                )}
              </button>
            </TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Concepto</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Proveedor</TableHead>
            <TableHead className="text-xs uppercase text-muted-foreground">Categoría</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Entrada</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Salida</TableHead>
            <TableHead className="text-right text-xs uppercase text-muted-foreground">Saldo</TableHead>
            <TableHead className="px-5 text-xs uppercase text-muted-foreground">Forma de pago</TableHead>
            <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">Comprobante</TableHead>
            <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMovements.map((movement) => {
            const receiptCode = movementReceiptCode(movement);
            return (
              <TableRow key={movement.id}>
                <TableCell className="px-5 font-medium">{movement.folio ?? "—"}</TableCell>
                <TableCell className="px-5 text-muted-foreground">
                  {movement.receipt || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(movement.movement_date)}
                </TableCell>
                <TableCell className="font-medium">{movement.concept}</TableCell>
                <TableCell className="text-muted-foreground">{movement.supplier}</TableCell>
                <TableCell className="text-muted-foreground">{movement.category}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    movement.movement_type === "income"
                      ? "text-brand-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {movement.movement_type === "income" ? formatCurrency(movement.amount) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    movement.movement_type === "expense"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {movement.movement_type === "expense" ? formatCurrency(movement.amount) : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", signedTone(movement.balance))}>
                  {formatCurrency(movement.balance)}
                </TableCell>
                <TableCell className="px-5 text-muted-foreground">
                  {movement.method?.name ?? "Sin forma"}
                </TableCell>
                <TableCell className="px-5 text-right">
                  {receiptCode ? (
                    <a
                      href={`/recibo/obra/${movement.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                      title={movement.movement_type === "income" ? "Imprimir recibo" : "Imprimir comprobante"}
                    >
                      <Receipt className="size-3.5" />
                      {receiptCode}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-5 text-right">
                  <WorkMovementActions
                    movement={movement}
                    workId={workId}
                    methods={methods}
                    providers={providers}
                    categories={categories}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {sortedMovements.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="h-20 text-center text-muted-foreground">
                {hasActiveFilters
                  ? "No hay movimientos que coincidan con los filtros."
                  : "Sin movimientos registrados."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
