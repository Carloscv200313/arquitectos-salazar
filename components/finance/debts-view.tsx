"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  Eye,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import {
  registerManualDebtorPaymentAction,
  saveManualProviderDebtAction,
  saveManualDebtorAction,
} from "@/app/(dashboard)/finance/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import { round2 } from "@/lib/calculations";
import type {
  DebtReportRow,
  ManualDebtorDetail,
  PaymentMethod,
  ProviderDebtDetail,
} from "@/lib/types";

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
  onPay,
  onInspect,
  debtorDetails,
  providerDetails,
}: {
  title: string;
  description: string;
  rows: DebtReportRow[];
  total: number;
  type: DebtReportRow["type"];
  onCreate?: () => void;
  onEdit?: (row: DebtReportRow) => void;
  onPay?: (row: DebtReportRow) => void;
  onInspect?: (row: DebtReportRow) => void;
  debtorDetails?: Map<string, ManualDebtorDetail>;
  providerDetails?: Map<string, ProviderDebtDetail>;
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
                {isDebtor ? "Nuevo deudor" : "Nuevo proveedor"}
              </Button>
            )}
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                isDebtor ? "bg-amber-100 text-amber-900" : "bg-brand-muted text-brand-foreground",
              )}
            >
              {isDebtor ? <HandCoins className="size-5" /> : <BadgeDollarSign className="size-5" />}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isDebtor ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-56 px-5">Nombre</TableHead>
                <TableHead className="min-w-44">Cuenta préstamo</TableHead>
                <TableHead className="text-right">Prestado</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="w-32 px-5 text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const detail = debtorDetails?.get(row.id);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
                          {row.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.loanDate ? `Prestado ${formatDate(row.loanDate)}` : "Registro manual"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {detail?.debtor.project_id
                        ? "Proyecto a crédito"
                        : (detail?.debtor.account?.name ?? row.sourceAccountName ?? "Sin cuenta")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(row.totalAmount ?? detail?.totalAmount ?? row.amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                      {formatCurrency(row.totalPaid ?? detail?.totalPaid ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-destructive">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="px-5 text-right">
                      <div className="flex justify-end gap-2">
                        {onInspect && (
                          <Button variant="outline" size="icon" className="size-8" onClick={() => onInspect(row)} title="Ver detalle">
                            <Eye className="size-4" />
                            <span className="sr-only">Ver detalle</span>
                          </Button>
                        )}
                        {onPay && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 text-brand-foreground"
                            onClick={() => onPay(row)}
                            disabled={row.amount <= 0.001}
                            title="Registrar abono"
                          >
                            <CheckCircle2 className="size-4" />
                            <span className="sr-only">Registrar abono</span>
                          </Button>
                        )}
                        {onEdit && !detail?.debtor.project_id && (
                          <Button variant="outline" size="icon" className="size-8" onClick={() => onEdit(row)} title="Editar deudor">
                            <Pencil className="size-4" />
                            <span className="sr-only">Editar deudor</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Sin registros para la búsqueda.
                  </TableCell>
                </TableRow>
              )}
              <TableRow pinned className="bg-muted/30 font-semibold hover:bg-muted/30">
                <TableCell className="px-5" colSpan={4}>Total pendiente</TableCell>
                <TableCell className="text-right tabular-nums text-brand-foreground">
                  {formatCurrency(total)}
                </TableCell>
                <TableCell className="px-5" />
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-56 px-5">Nombre</TableHead>
                <TableHead className="min-w-40">Origen</TableHead>
                <TableHead className="text-right">Prestado</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                {(onEdit || onInspect) && (
                  <TableHead className="w-14 px-5 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const detail = providerDetails?.get(row.name);
                const sourceLabel =
                  row.source === "manual"
                    ? "Registro manual"
                    : row.source === "works"
                      ? "Calculado desde Obras"
                      : row.source === "mixed"
                        ? "Pedidos, Obras o manual"
                        : "Calculado desde Pedidos";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-semibold text-brand-foreground">
                          {row.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {detail
                              ? `${detail.orders.length + detail.workMovements.length + detail.manualDebts.length} registro${
                                  detail.orders.length + detail.workMovements.length + detail.manualDebts.length === 1 ? "" : "s"
                                }`
                              : sourceLabel}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sourceLabel}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(row.totalAmount ?? detail?.totalAmount ?? row.amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                      {formatCurrency(row.totalPaid ?? detail?.totalPaid ?? 0)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", amountTone(row.amount))}>
                      {signedCurrency(row.amount)}
                    </TableCell>
                    {onInspect && (
                      <TableCell className="px-5 text-right">
                        <Button variant="outline" size="icon" className="size-8" onClick={() => onInspect(row)} title="Ver detalle">
                          <Eye className="size-4" />
                          <span className="sr-only">Ver detalle</span>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={onInspect ? 6 : 5} className="h-24 text-center text-muted-foreground">
                    Sin registros para la búsqueda.
                  </TableCell>
                </TableRow>
              )}
              <TableRow pinned className="bg-muted/30 font-semibold hover:bg-muted/30">
                <TableCell className="px-5" colSpan={4}>Total pendiente</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  {signedCurrency(total)}
                </TableCell>
                {onInspect && <TableCell className="px-5" />}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function ManualDebtorSheet({
  open,
  onOpenChange,
  debtor,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: ManualDebtorDetail | null;
  accounts: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(debtor?.debtor.name ?? "");
  const [amount, setAmount] = useState(debtor ? String(debtor.totalAmount) : "");
  const [sourceAccountId, setSourceAccountId] = useState(debtor?.debtor.source_account_id ?? "");
  const [loanDate, setLoanDate] = useState(debtor?.debtor.loan_date ?? todayISODate());
  const [note, setNote] = useState(debtor?.debtor.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!debtor;
  const accountItems = accounts.map((account) => ({ value: account.id, label: account.name }));

  function reset() {
    setName("");
    setAmount("");
    setSourceAccountId("");
    setLoanDate(todayISODate());
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveManualDebtorAction({
        id: debtor?.debtor.id ?? "",
        name,
        amount: Number(amount),
        sourceAccountId,
        loanDate,
        note,
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
            Registra el préstamo y la cuenta de donde salió el dinero.
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
            <MoneyInput
              id="debtor-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-source-account">Cuenta que prestó el dinero</Label>
            <Select
              value={sourceAccountId}
              onValueChange={(value) => setSourceAccountId(value ?? "")}
              items={accountItems}
            >
              <SelectTrigger id="debtor-source-account" className="w-full" aria-invalid={!!errors.sourceAccountId}>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sourceAccountId && <p className="text-xs text-destructive">{errors.sourceAccountId}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-loan-date">Fecha del préstamo</Label>
            <Input
              id="debtor-loan-date"
              type="date"
              value={loanDate}
              onChange={(event) => setLoanDate(event.target.value)}
              aria-invalid={!!errors.loanDate}
            />
            {errors.loanDate && <p className="text-xs text-destructive">{errors.loanDate}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-note">Nota</Label>
            <Input
              id="debtor-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Préstamo personal / anticipo"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
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

function DebtorPaymentSheet({
  open,
  onOpenChange,
  debtor,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: ManualDebtorDetail;
  accounts: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [amount, setAmount] = useState(String(debtor.totalPending));
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const accountItems = accounts.map((account) => ({ value: account.id, label: account.name }));

  function reset() {
    setPaymentDate(todayISODate());
    setAmount(String(debtor.totalPending));
    setToAccountId("");
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await registerManualDebtorPaymentAction({
        debtorId: debtor.debtor.id,
        paymentDate,
        amount: Number(amount),
        toAccountId,
        note,
      });
      if (result.ok) {
        toast.success("Abono registrado", {
          description: `${formatCurrency(Number(amount))} · ${debtor.debtor.name}`,
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar abono</SheetTitle>
          <SheetDescription>
            {debtor.debtor.name} · pendiente {formatCurrency(debtor.totalPending)}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <Card className="bg-brand-muted/50 p-4">
            <p className="font-medium">Cobranza de deudor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              El abono entrará a la cuenta que selecciones.
            </p>
          </Card>

          <div className="grid gap-2">
            <Label htmlFor="debtor-payment-date">Fecha de pago</Label>
            <Input
              id="debtor-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              aria-invalid={!!errors.paymentDate}
            />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-payment-amount">Monto del abono</Label>
            <MoneyInput
              id="debtor-payment-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-payment-account">Cuenta donde entra el pago</Label>
            <Select
              value={toAccountId}
              onValueChange={(value) => setToAccountId(value ?? "")}
              items={accountItems}
            >
              <SelectTrigger id="debtor-payment-account" className="w-full" aria-invalid={!!errors.toAccountId}>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.toAccountId && <p className="text-xs text-destructive">{errors.toAccountId}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="debtor-payment-note">Nota</Label>
            <Input
              id="debtor-payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Abono por transferencia"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>

          <Button onClick={submit} disabled={isPending} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Guardar abono
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ManualProviderDebtSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [debtDate, setDebtDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setProvider("");
    setAmount("");
    setDebtDate(todayISODate());
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveManualProviderDebtAction({
        provider,
        amount: Number(amount),
        debtDate,
        note,
      });
      if (result.ok) {
        toast.success("Deuda de proveedor agregada", {
          description: `${provider} · ${formatCurrency(Number(amount))}`,
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
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva deuda de proveedor</SheetTitle>
          <SheetDescription>
            Registra manualmente un gasto a crédito para un proveedor.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="provider-debt-name">Proveedor</Label>
            <Input
              id="provider-debt-name"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="Nombre del proveedor"
              aria-invalid={!!errors.provider}
            />
            {errors.provider && <p className="text-xs text-destructive">{errors.provider}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-debt-amount">Monto</Label>
            <MoneyInput
              id="provider-debt-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-debt-date">Fecha</Label>
            <Input
              id="provider-debt-date"
              type="date"
              value={debtDate}
              onChange={(event) => setDebtDate(event.target.value)}
              aria-invalid={!!errors.debtDate}
            />
            {errors.debtDate && <p className="text-xs text-destructive">{errors.debtDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-debt-note">Nota</Label>
            <Input
              id="provider-debt-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Llave de agua para oficina"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>
          <Button onClick={submit} disabled={isPending} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Agregar deuda
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DebtsView({
  rows,
  providerDetails,
  debtorDetails,
  accounts,
}: {
  rows: DebtReportRow[];
  providerDetails: ProviderDebtDetail[];
  debtorDetails: ManualDebtorDetail[];
  accounts: PaymentMethod[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [providerSheetOpen, setProviderSheetOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<ManualDebtorDetail | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ManualDebtorDetail | null>(null);
  const debtorDetailsById = new Map(debtorDetails.map((detail) => [detail.debtor.id, detail]));
  const providerDetailsByName = new Map(providerDetails.map((detail) => [detail.provider, detail]));

  const debtors = rows.filter((row) => row.type === "debtor");
  const providers = rows.filter((row) => row.type === "provider");
  const totalDebtors = round2(debtors.reduce((sum, row) => sum + row.amount, 0));
  const totalProviders = round2(providers.reduce((sum, row) => sum + row.amount, 0));
  const net = round2(totalDebtors + totalProviders);
  const activeRows = rows.filter((row) => Math.abs(row.amount) > 0.001).length;
  const q = search.trim().toLowerCase();
  const filteredDebtors = debtors.filter((row) => !q || row.name.toLowerCase().includes(q));
  const filteredProviders = providers.filter((row) => !q || row.name.toLowerCase().includes(q));
  const filteredDebtorsTotal = round2(filteredDebtors.reduce((sum, row) => sum + row.amount, 0));
  const filteredProvidersTotal = round2(filteredProviders.reduce((sum, row) => sum + row.amount, 0));

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
              const detail = debtorDetailsById.get(row.id);
              if (!detail) return;
              setEditingDebtor(detail);
              setSheetOpen(true);
            }}
            onPay={(row) => {
              const detail = debtorDetailsById.get(row.id);
              if (detail) setPaymentTarget(detail);
            }}
            onInspect={(row) => router.push(`/finance/deudas/deudor-${row.id}`)}
            debtorDetails={debtorDetailsById}
          />
          <DebtTableCard
            title="Proveedores"
            description="Pedidos, obras y deudas manuales pendientes por proveedor."
            rows={filteredProviders}
            total={filteredProvidersTotal}
            type="provider"
            onCreate={() => setProviderSheetOpen(true)}
            onInspect={(row) => {
              const detail = providerDetails.find((item) => item.provider === row.name) ?? null;
              if (!detail) return;
              router.push(`/finance/deudas/${encodeURIComponent(detail.provider)}`);
            }}
            providerDetails={providerDetailsByName}
          />
        </div>
      </div>

      {sheetOpen && (
        <ManualDebtorSheet
          key={editingDebtor?.debtor.id ?? "new"}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          debtor={editingDebtor}
          accounts={accounts}
        />
      )}
      {providerSheetOpen && (
        <ManualProviderDebtSheet
          open={providerSheetOpen}
          onOpenChange={setProviderSheetOpen}
        />
      )}
      {paymentTarget && (
        <DebtorPaymentSheet
          key={paymentTarget.debtor.id}
          open={!!paymentTarget}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          debtor={paymentTarget}
          accounts={accounts}
        />
      )}
    </div>
  );
}
