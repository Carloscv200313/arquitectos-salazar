"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ScrollText, Search } from "lucide-react";
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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PROJECT_SLICE_LABELS } from "@/lib/constants";
import { ArrowRight } from "lucide-react";
import type { AuditLogRow, AuditEntityType, AuditOperation } from "@/lib/types";

const ENTITY_OPTIONS: { value: AuditEntityType | "all"; label: string }[] = [
  { value: "all", label: "Todos los módulos" },
  { value: "project_movement", label: "Proyectos" },
  { value: "work_movement", label: "Obras" },
  { value: "order_payment", label: "Pedidos" },
  { value: "salary", label: "Salarios" },
];

const OPERATION_OPTIONS: { value: AuditOperation | "all"; label: string }[] = [
  { value: "all", label: "Todas las acciones" },
  { value: "create", label: "Creó" },
  { value: "update", label: "Editó" },
  { value: "delete", label: "Eliminó" },
];

function operationClass(op: AuditOperation) {
  switch (op) {
    case "create":
      return "bg-success/15 text-success-foreground";
    case "update":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "delete":
      return "bg-destructive/10 text-destructive";
  }
}

// Etiquetas legibles para cada campo guardado en el snapshot.
const FIELD_LABELS: Record<string, string> = {
  amount: "Monto",
  concept: "Concepto",
  payment_date: "Fecha",
  movement_date: "Fecha",
  internal_area: "Área interna",
  payment_method_id: "Forma de pago",
  movement_type: "Tipo",
  supplier: "Proveedor",
  category: "Categoría",
  observations: "Observaciones",
  description: "Descripción",
  receipt: "Recibo",
};

// Orden de presentación de los campos.
const FIELD_ORDER = [
  "concept",
  "description",
  "amount",
  "movement_type",
  "internal_area",
  "category",
  "supplier",
  "payment_method_id",
  "payment_date",
  "movement_date",
  "receipt",
  "observations",
];

function formatFieldValue(
  key: string,
  value: unknown,
  methodNames: Record<string, string>,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "amount") return formatCurrency(Number(value));
  if (key === "payment_date" || key === "movement_date") return formatDate(String(value));
  if (key === "internal_area") {
    return PROJECT_SLICE_LABELS[value as keyof typeof PROJECT_SLICE_LABELS] ?? String(value);
  }
  if (key === "payment_method_id") return methodNames[String(value)] ?? "Cuenta";
  if (key === "movement_type") return value === "income" ? "Ingreso" : "Egreso";
  return String(value);
}

function SnapshotDiff({
  log,
  methodNames,
}: {
  log: AuditLogRow;
  methodNames: Record<string, string>;
}) {
  const snapshot = log.snapshot;
  if (!snapshot || (!snapshot.before && !snapshot.after)) return null;

  const before = (snapshot.before ?? {}) as Record<string, unknown>;
  const after = (snapshot.after ?? null) as Record<string, unknown> | null;

  // Claves a mostrar, en orden conocido y luego cualquier extra.
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after ?? {})]),
  ).sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Edición: antes → después solo en lo que cambió.
  if (after) {
    const rows = keys.map((k) => {
      const bv = formatFieldValue(k, before[k], methodNames);
      const av = formatFieldValue(k, after[k], methodNames);
      return { key: k, label: FIELD_LABELS[k] ?? k, bv, av, changed: bv !== av };
    });
    const changed = rows.filter((r) => r.changed);
    const unchanged = rows.filter((r) => !r.changed);

    return (
      <div className="rounded-lg bg-muted/50 p-4 text-sm">
        {changed.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cambios
            </p>
            {changed.map((r) => (
              <div key={r.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-28 font-medium">{r.label}</span>
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive line-through">
                  {r.bv}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="rounded-md bg-success/15 px-2 py-0.5 text-success-foreground">
                  {r.av}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No cambió ningún dato.</p>
        )}

        {unchanged.length > 0 ? (
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sin cambios
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {unchanged.map((r) => (
                <div key={r.key} className="flex gap-2 text-muted-foreground">
                  <span className="min-w-28 font-medium">{r.label}</span>
                  <span>{r.bv}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Eliminación: solo el estado previo (lo que se quitó).
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Datos del registro eliminado
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {keys.map((k) => (
          <div key={k} className="flex gap-2">
            <span className="min-w-28 font-medium">{FIELD_LABELS[k] ?? k}</span>
            <span className="text-muted-foreground">
              {formatFieldValue(k, before[k], methodNames)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditView({
  logs,
  methodNames,
}: {
  logs: AuditLogRow[];
  methodNames: Record<string, string>;
}) {
  const [entity, setEntity] = useState<AuditEntityType | "all">("all");
  const [operation, setOperation] = useState<AuditOperation | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (entity !== "all" && l.entityType !== entity) return false;
      if (operation !== "all" && l.operation !== operation) return false;
      if (term) {
        const hay = `${l.userName} ${l.description ?? ""} ${l.note ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [logs, entity, operation, search]);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, concepto o motivo…"
            className="pl-9"
          />
        </div>
        <Select value={entity} onValueChange={(v) => setEntity((v as AuditEntityType | "all") ?? "all")} items={ENTITY_OPTIONS}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={operation} onValueChange={(v) => setOperation((v as AuditOperation | "all") ?? "all")} items={OPERATION_OPTIONS}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ScrollText className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">No hay registros que coincidan.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const expandable = !!l.snapshot && (!!l.snapshot.before || !!l.snapshot.after);
                const open = openId === l.id;
                return (
                  <Fragment key={l.id}>
                    <TableRow>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{l.userName}</TableCell>
                      <TableCell>
                        <span
                          className={
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                            operationClass(l.operation)
                          }
                        >
                          {l.operationLabel}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {l.entityLabel}
                      </TableCell>
                      <TableCell>{l.description ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {l.amount != null ? formatCurrency(l.amount) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[18rem] text-muted-foreground">
                        {l.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {expandable ? (
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : l.id)}
                            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors hover:bg-accent"
                          >
                            Cambios
                            <ChevronDown
                              className={"size-3.5 transition-transform " + (open ? "rotate-180" : "")}
                            />
                          </button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                    {expandable && open ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="py-3">
                          <SnapshotDiff log={l} methodNames={methodNames} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
