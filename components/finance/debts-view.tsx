"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  ClipboardList,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { saveManualDebtorAction } from "@/app/(dashboard)/finance/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { round2 } from "@/lib/calculations";
import type { DebtReportRow } from "@/lib/types";

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function amountTone(value: number) {
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
  icon: React.ReactNode;
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

function DebtTableCard({
  title,
  description,
  rows,
  total,
  type,
  onCreate,
  onEdit,
}: {
  title: string;
  description: string;
  rows: DebtReportRow[];
  total: number;
  type: DebtReportRow["type"];
  onCreate?: () => void;
  onEdit?: (row: DebtReportRow) => void;
}) {
  const isDebtor = type === "debtor";
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl p-0">
      <div className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onCreate && (
              <Button
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={onCreate}
              >
                <Plus className="size-4" />
                Nuevo deudor
              </Button>
            )}
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                isDebtor
                  ? "bg-amber-100 text-amber-900"
                  : "bg-brand-muted text-brand-foreground",
              )}
            >
              {isDebtor ? (
                <HandCoins className="size-5" />
              ) : (
                <BadgeDollarSign className="size-5" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-56 px-5">Nombre</TableHead>
              <TableHead className="px-5 text-right">Monto</TableHead>
              {onEdit && (
                <TableHead className="w-14 px-5 text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="px-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isDebtor
                          ? "bg-amber-100 text-amber-900"
                          : "bg-brand-muted text-brand-foreground",
                      )}
                    >
                      {row.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.source === "manual"
                          ? "Registro manual"
                          : "Calculado desde Pedidos"}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn("px-5 text-right font-semibold tabular-nums", amountTone(row.amount))}>
                  {signedCurrency(row.amount)}
                </TableCell>
                {onEdit && (
                  <TableCell className="px-5 text-right">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => onEdit(row)}
                      title="Editar deudor"
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Editar deudor</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={onEdit ? 3 : 2}
                  className="h-24 text-center text-muted-foreground"
                >
                  Sin registros para la búsqueda.
                </TableCell>
              </TableRow>
            )}
            <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
              <TableCell className="px-5">Total</TableCell>
              <TableCell
                className={cn(
                  "px-5 text-right tabular-nums",
                  isDebtor ? "text-brand-foreground" : "text-destructive",
                )}
              >
                {isDebtor ? formatCurrency(total) : signedCurrency(total)}
              </TableCell>
              {onEdit && <TableCell className="px-5" />}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function ManualDebtorSheet({
  open,
  onOpenChange,
  debtor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: DebtReportRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(debtor?.name ?? "");
  const [amount, setAmount] = useState(debtor ? String(debtor.amount) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!debtor;

  function reset() {
    setName("");
    setAmount("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveManualDebtorAction({
        id: debtor?.id ?? "",
        name,
        amount: Number(amount),
      });
      if (result.ok) {
        toast.success(isEditing ? "Deudor actualizado" : "Deudor agregado", {
          description: `${name} · ${formatCurrency(Number(amount))}`,
        });
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar deudor" : "Nuevo deudor"}</SheetTitle>
          <SheetDescription>
            Registra saldos manuales que no vienen desde Obras.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="debtor-name">Nombre</Label>
            <Input
              id="debtor-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del deudor"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-amount">Monto</Label>
            <Input
              id="debtor-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {isEditing ? "Guardar cambios" : "Agregar deudor"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DebtsView({ rows }: { rows: DebtReportRow[] }) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<DebtReportRow | null>(null);
  const debtors = rows.filter((row) => row.type === "debtor");
  const providers = rows.filter((row) => row.type === "provider");
  const totalDebtors = round2(debtors.reduce((sum, row) => sum + row.amount, 0));
  const totalProviders = round2(
    providers.reduce((sum, row) => sum + row.amount, 0),
  );
  const net = round2(totalDebtors + totalProviders);
  const activeRows = rows.filter((row) => Math.abs(row.amount) > 0.001).length;
  const q = search.trim().toLowerCase();
  const filteredDebtors = debtors.filter((row) => !q || row.name.toLowerCase().includes(q));
  const filteredProviders = providers.filter((row) => !q || row.name.toLowerCase().includes(q));
  const filteredDebtorsTotal = round2(
    filteredDebtors.reduce((sum, row) => sum + row.amount, 0),
  );
  const filteredProvidersTotal = round2(
    filteredProviders.reduce((sum, row) => sum + row.amount, 0),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Balance de deudas"
          value={signedCurrency(net)}
          hint="Deudores menos proveedores"
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Deudores"
          value={formatCurrency(totalDebtors)}
          hint={`${debtors.length} registros manuales`}
          icon={<HandCoins className="size-5" />}
          tone="success"
        />
        <Metric
          label="Proveedores"
          value={signedCurrency(totalProviders)}
          hint="Pendiente de pedidos"
          icon={<BadgeDollarSign className="size-5" />}
          tone="danger"
        />
        <Metric
          label="Con saldo"
          value={String(activeRows)}
          hint="Registros distintos de cero"
          icon={<ClipboardList className="size-5" />}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card className="rounded-2xl p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar deudor o proveedor..."
              className="h-9 pl-9"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <DebtTableCard
            title="Deudores"
            description="Registros manuales pendientes por cobrar."
            rows={filteredDebtors}
            total={filteredDebtorsTotal}
            type="debtor"
            onCreate={() => {
              setEditingDebtor(null);
              setSheetOpen(true);
            }}
            onEdit={(row) => {
              setEditingDebtor(row);
              setSheetOpen(true);
            }}
          />
          <DebtTableCard
            title="Proveedores"
            description="Calculado desde pedidos pendientes por proveedor."
            rows={filteredProviders}
            total={filteredProvidersTotal}
            type="provider"
          />
        </div>
      </div>

      {sheetOpen && (
        <ManualDebtorSheet
          key={editingDebtor?.id ?? "new"}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          debtor={editingDebtor}
        />
      )}
    </div>
  );
}
