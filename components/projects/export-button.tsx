"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ExportRow {
  proyecto: string;
  cliente: string;
  montoTotal: number;
  montoProyecto: number;
  ingresos: number;
  egresos: number;
  porCobrar: number;
  estado: string;
  fechaCreacion: string;
}

const HEADERS: { key: keyof ExportRow; label: string }[] = [
  { key: "proyecto", label: "Proyecto" },
  { key: "cliente", label: "Cliente" },
  { key: "montoTotal", label: "Monto total" },
  { key: "montoProyecto", label: "Monto proyecto" },
  { key: "ingresos", label: "Ingresos" },
  { key: "egresos", label: "Egresos internos" },
  { key: "porCobrar", label: "Por cobrar" },
  { key: "estado", label: "Estado" },
  { key: "fechaCreacion", label: "Fecha de creación" },
];

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function cell(row: ExportRow, key: keyof ExportRow): string {
  const v = row[key];
  return typeof v === "number" ? v.toFixed(2) : String(v);
}

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

export function ExportButton({ rows }: { rows: ExportRow[] }) {
  const disabled = rows.length === 0;

  function exportCsv() {
    const head = HEADERS.map((h) => escapeCsv(h.label)).join(",");
    const body = rows
      .map((r) => HEADERS.map((h) => escapeCsv(cell(r, h.key))).join(","))
      .join("\n");
    // UTF-8 BOM so Excel/Sheets read accents correctly.
    download(`proyectos-${timestamp()}.csv`, "﻿" + head + "\n" + body, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    // Excel-readable HTML table (.xls) — no external dependency required.
    const head = HEADERS.map((h) => `<th>${h.label}</th>`).join("");
    const body = rows
      .map(
        (r) =>
          "<tr>" +
          HEADERS.map((h) => `<td>${cell(r, h.key)}</td>`).join("") +
          "</tr>",
      )
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    download(`proyectos-${timestamp()}.xls`, html, "application/vnd.ms-excel");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" disabled={disabled} />}
      >
        <Download className="size-4" />
        Exportar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="size-4" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCsv}>
          <FileText className="size-4" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
