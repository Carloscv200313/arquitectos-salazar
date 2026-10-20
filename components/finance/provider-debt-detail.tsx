"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  Eye,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteProviderDebtPaymentAction,
  registerManualProviderDebtPaymentAction,
  saveManualProviderDebtAction,
  settleProviderDebtAction,
  updateProviderDebtPaymentAction,
} from "@/app/(dashboard)/finance/actions";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import type { PaymentMethod, ProviderDebtDetail, ProviderDebtPayment, ProviderDebtSourceType } from "@/lib/types";

type SettleTarget =
  | { sourceType: "work_order"; sourceId: string; provider: string; title: string; subtitle: string; pending: number }
  | { sourceType: "work_movement"; sourceId: string; provider: string; title: string; subtitle: string; pending: number }
  | { sourceType: "manual_provider_debt"; sourceId: string; provider: string; title: string; subtitle: string; pending: number };

type ProviderDebtDisplayUpdate =
  | { type: "settlement"; target: SettleTarget; amount: number }
  | { type: "payment-deleted"; payment: ProviderDebtPayment };

type PaymentHistoryTarget = {
  sourceType: ProviderDebtSourceType;
  sourceId: string;
  title: string;
};

function updateProviderDebtDisplay(
  current: ProviderDebtDetail,
  update: ProviderDebtDisplayUpdate,
): ProviderDebtDetail {
  if (update.type === "payment-deleted") {
    const { payment } = update;
    const amount = Math.round(payment.amount * 100) / 100;
    return {
      ...current,
      totalPaid: Math.max(Math.round((current.totalPaid - amount) * 100) / 100, 0),
      totalPending: Math.round((current.totalPending + amount) * 100) / 100,
      payments: current.payments.filter(
        (item) => !(item.id === payment.id && item.kind === payment.kind),
      ),
      orders: current.orders.map((order) =>
        payment.sourceType === "work_order" && order.id === payment.sourceId
          ? {
              ...order,
              paid: Math.max(Math.round((order.paid - amount) * 100) / 100, 0),
              pending: Math.round((order.pending + amount) * 100) / 100,
            }
          : order,
      ),
      workMovements: current.workMovements.map((movement) =>
        payment.sourceType === "work_movement" && movement.id === payment.sourceId
          ? {
              ...movement,
              settled: Math.max(Math.round((movement.settled - amount) * 100) / 100, 0),
              pending: Math.round((movement.pending + amount) * 100) / 100,
            }
          : movement,
      ),
      manualDebts: current.manualDebts.map((manual) =>
        payment.sourceType === "manual_provider_debt" && manual.debt.id === payment.sourceId
          ? {
              ...manual,
              totalPaid: Math.max(Math.round((manual.totalPaid - amount) * 100) / 100, 0),
              totalPending: Math.round((manual.totalPending + amount) * 100) / 100,
              payments: manual.payments.filter((item) => item.id !== payment.id),
            }
          : manual,
      ),
    };
  }

  const appliedAmount = Math.round(Math.min(Math.max(update.amount, 0), update.target.pending) * 100) / 100;
  if (!Number.isFinite(appliedAmount) || appliedAmount <= 0) return current;

  return {
    ...current,
    totalPaid: Math.round((current.totalPaid + appliedAmount) * 100) / 100,
    totalPending: Math.max(Math.round((current.totalPending - appliedAmount) * 100) / 100, 0),
    orders: current.orders
      .map((order) =>
        update.target.sourceType === "work_order" && order.id === update.target.sourceId
          ? {
              ...order,
              paid: Math.round((order.paid + appliedAmount) * 100) / 100,
              pending: Math.max(Math.round((order.pending - appliedAmount) * 100) / 100, 0),
            }
          : order,
      )
      .filter((order) => order.pending > 0.001),
    workMovements: current.workMovements
      .map((movement) =>
        update.target.sourceType === "work_movement" && movement.id === update.target.sourceId
          ? {
              ...movement,
              settled: Math.round((movement.settled + appliedAmount) * 100) / 100,
              pending: Math.max(Math.round((movement.pending - appliedAmount) * 100) / 100, 0),
            }
          : movement,
      )
      .filter((movement) => movement.pending > 0.001),
    manualDebts: current.manualDebts
      .map((manual) =>
        update.target.sourceType === "manual_provider_debt" && manual.debt.id === update.target.sourceId
          ? {
              ...manual,
              totalPaid: Math.round((manual.totalPaid + appliedAmount) * 100) / 100,
              totalPending: Math.max(Math.round((manual.totalPending - appliedAmount) * 100) / 100, 0),
            }
          : manual,
      )
      .filter((manual) => manual.totalPending > 0.001),
  };
}


function pendingTone(pending: number, total: number) {
  if (total <= 0.001 || pending <= 0.001) return "text-muted-foreground";
  return Math.abs(pending - total) < 0.001 ? "text-destructive" : "text-brand-foreground";
}

function Stat({
  label,
  value,
  hint,
  icon,
  accent,
  tone,
  compactValue,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: "success" | "danger";
  compactValue?: boolean;
}) {
  return (
    <Card className={cn("p-5", accent && "border-transparent bg-brand text-brand-foreground")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className={cn("mt-2 font-semibold", compactValue ? "text-lg leading-tight" : "text-2xl tabular-nums")}>
            {value}
          </p>
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

function SettleProviderDebtSheet({
  open,
  onOpenChange,
  target,
  onSettled,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SettleTarget;
  onSettled: (target: SettleTarget, amount: number) => void;
  accounts: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settlementDate, setSettlementDate] = useState(todayISODate());
  const [amount, setAmount] = useState(String(target.pending));
  const [fromAccountId, setFromAccountId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setSettlementDate(todayISODate());
    setAmount(String(target.pending));
    setFromAccountId("");
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const settledAmount = Math.min(Number(amount), target.pending);
      onSettled(target, settledAmount);
      const result =
        target.sourceType === "manual_provider_debt"
          ? await registerManualProviderDebtPaymentAction({
              debtId: target.sourceId,
              amount: Number(amount),
              paymentDate: settlementDate,
              fromAccountId,
              note,
            })
          : await settleProviderDebtAction({
              provider: target.provider,
              sourceType: target.sourceType,
              sourceId: target.sourceId,
              amount: Number(amount),
              settlementDate,
              fromAccountId,
              note,
            });
      if (result.ok) {
        const remaining = Math.max(target.pending - settledAmount, 0);
        toast.success(remaining > 0.001 ? "Abono registrado" : "Deuda saldada", {
          description:
            remaining > 0.001
              ? `${formatCurrency(settledAmount)} abonados · pendiente ${formatCurrency(remaining)}`
              : `${formatCurrency(settledAmount)} · ${target.provider}`,
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar abono</SheetTitle>
          <SheetDescription>
            {target.title} · pendiente {formatCurrency(target.pending)}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <Card className="bg-brand-muted/50 p-4">
            <p className="font-medium">{target.subtitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              El saldo pendiente se actualizará con el monto abonado.
            </p>
          </Card>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-date">Fecha</Label>
            <Input
              id="settle-provider-date"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              aria-invalid={!!(errors.settlementDate || errors.paymentDate)}
            />
            {(errors.settlementDate || errors.paymentDate) && (
              <p className="text-xs text-destructive">{errors.settlementDate || errors.paymentDate}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-amount">Monto del abono</Label>
            <MoneyInput
              id="settle-provider-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-account">Cuenta de salida</Label>
            <Select
              value={fromAccountId}
              onValueChange={(value) => setFromAccountId(value ?? "")}
              items={accounts.map((account) => ({ value: account.id, label: account.name }))}
            >
              <SelectTrigger
                id="settle-provider-account"
                className="w-full"
                aria-invalid={!!errors.fromAccountId}
              >
                <SelectValue placeholder="Selecciona la cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fromAccountId && <p className="text-xs text-destructive">{errors.fromAccountId}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-note">Nota</Label>
            <Input
              id="settle-provider-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Liquidado por administración"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>
          <Button onClick={submit} disabled={isPending} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Registrar abono
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProviderPaymentHistorySheet({
  open,
  onOpenChange,
  target,
  payments,
  onPaymentDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PaymentHistoryTarget;
  payments: ProviderDebtPayment[];
  onPaymentDeleted: (payment: ProviderDebtPayment) => void;
}) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<ProviderDebtPayment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderDebtPayment | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [paymentNote, setPaymentNote] = useState("");
  const [observation, setObservation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function beginEdit(payment: ProviderDebtPayment) {
    setEditTarget(payment);
    setAmount(String(payment.amount));
    setPaymentDate(payment.paymentDate);
    setPaymentNote(payment.note ?? "");
    setObservation("");
    setErrors({});
  }

  function submitEdit() {
    if (!editTarget) return;
    setErrors({});
    startTransition(async () => {
      const result = await updateProviderDebtPaymentAction({
        paymentId: editTarget.id,
        kind: editTarget.kind,
        amount: Number(amount),
        paymentDate,
        paymentNote,
        observation,
      });
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success("Abono actualizado", { description: "El saldo y la auditoría fueron actualizados." });
      setEditTarget(null);
      router.refresh();
    });
  }

  function submitDelete() {
    if (!deleteTarget) return;
    setErrors({});
    startTransition(async () => {
      const result = await deleteProviderDebtPaymentAction({
        paymentId: deleteTarget.id,
        kind: deleteTarget.kind,
        observation,
      });
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      const deletedPayment = deleteTarget;
      setDeleteTarget(null);
      setObservation("");
      onPaymentDeleted(deletedPayment);
      router.refresh();
      window.requestAnimationFrame(() => {
        toast.success("Abono eliminado", { description: "El saldo pendiente fue recalculado." });
      });
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Historial de abonos</SheetTitle>
            <SheetDescription>{target.title}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cuenta de salida</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={`${payment.kind}-${payment.id}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.accountName ?? "Sin especificar"}
                      </TableCell>
                      <TableCell className="max-w-52 whitespace-normal break-words text-muted-foreground">
                        {payment.note || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Editar abono"
                            aria-label="Editar abono"
                            onClick={() => beginEdit(payment)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="Eliminar abono"
                            aria-label="Eliminar abono"
                            onClick={() => {
                              setDeleteTarget(payment);
                              setObservation("");
                              setErrors({});
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        Sin abonos registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!editTarget}
        onOpenChange={(next) => {
          if (!next && !isPending) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar abono</DialogTitle>
            <DialogDescription>El saldo pendiente se recalculará automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-payment-edit-date">Fecha</Label>
              <Input
                id="provider-payment-edit-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                aria-invalid={!!errors.paymentDate}
              />
              {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-payment-edit-amount">Monto</Label>
              <MoneyInput
                id="provider-payment-edit-amount"
                value={amount}
                onValueChange={setAmount}
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-payment-edit-note">Nota del abono</Label>
              <Input
                id="provider-payment-edit-note"
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="Nota opcional"
                aria-invalid={!!errors.paymentNote}
              />
              {errors.paymentNote && <p className="text-xs text-destructive">{errors.paymentNote}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-payment-edit-observation">Observación</Label>
              <Textarea
                id="provider-payment-edit-observation"
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                placeholder="Explica por qué editas este abono"
                rows={3}
                aria-invalid={!!errors.observation}
              />
              {errors.observation && <p className="text-xs text-destructive">{errors.observation}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar abono</DialogTitle>
            <DialogDescription>
              El monto volverá al saldo pendiente. La observación quedará registrada en Auditoría.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{formatDate(deleteTarget.paymentDate)}</p>
              <p className="mt-1 text-muted-foreground">{formatCurrency(deleteTarget.amount)}</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="provider-payment-delete-observation">Observación</Label>
            <Textarea
              id="provider-payment-delete-observation"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Explica por qué eliminas este abono"
              rows={3}
              aria-invalid={!!errors.observation}
            />
            {errors.observation && <p className="text-xs text-destructive">{errors.observation}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? "Eliminando..." : "Eliminar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManualProviderDebtSheet({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [debtDate, setDebtDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
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
            Registra manualmente un gasto a crédito para {provider}.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="provider-detail-debt-name">Proveedor</Label>
            <Input
              id="provider-detail-debt-name"
              value={provider}
              readOnly
              className="bg-muted/50 text-muted-foreground"
              aria-invalid={!!errors.provider}
            />
            {errors.provider && <p className="text-xs text-destructive">{errors.provider}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-detail-debt-amount">Monto</Label>
            <MoneyInput
              id="provider-detail-debt-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-detail-debt-date">Fecha</Label>
            <Input
              id="provider-detail-debt-date"
              type="date"
              value={debtDate}
              onChange={(event) => setDebtDate(event.target.value)}
              aria-invalid={!!errors.debtDate}
            />
            {errors.debtDate && <p className="text-xs text-destructive">{errors.debtDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-detail-debt-note">Nota</Label>
            <Input
              id="provider-detail-debt-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Compra administrativa a crédito"
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

export function ProviderDebtDetail({
  detail,
  accounts,
}: {
  detail: ProviderDebtDetail;
  accounts: PaymentMethod[];
}) {
  const [displayDetail, updateDisplayedDetail] = useOptimistic(detail, updateProviderDebtDisplay);
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PaymentHistoryTarget | null>(null);
  const [manualDebtOpen, setManualDebtOpen] = useState(false);

  function applySettlement(target: SettleTarget, amount: number) {
    updateDisplayedDetail({ type: "settlement", target, amount });
  }

  function applyDeletedPayment(payment: ProviderDebtPayment) {
    updateDisplayedDetail({ type: "payment-deleted", payment });
  }

  const pendingRowsCount =
    displayDetail.orders.length + displayDetail.workMovements.length + displayDetail.manualDebts.length;
  const debtRows = [
    ...displayDetail.orders.map((order) => ({ kind: "order" as const, order })),
    ...displayDetail.workMovements.map((movement) => ({ kind: "movement" as const, movement })),
    ...displayDetail.manualDebts.map((manual) => ({ kind: "manual" as const, manual })),
  ].sort((a, b) => {
    const aPending =
      a.kind === "order" ? a.order.pending : a.kind === "movement" ? a.movement.pending : a.manual.totalPending;
    const bPending =
      b.kind === "order" ? b.order.pending : b.kind === "movement" ? b.movement.pending : b.manual.totalPending;
    if (Math.abs(bPending - aPending) > 0.001) return bPending - aPending;
    const aDate =
      a.kind === "order" ? a.order.order_date : a.kind === "movement" ? a.movement.movementDate : a.manual.debt.debt_date;
    const bDate =
      b.kind === "order" ? b.order.order_date : b.kind === "movement" ? b.movement.movementDate : b.manual.debt.debt_date;
    return bDate.localeCompare(aDate);
  });

  return (
    <>
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            label="Deuda pendiente"
            value={formatCurrency(displayDetail.totalPending)}
            hint="Saldo pendiente del proveedor"
            icon={<Boxes className="size-5" />}
            accent
          />
          <Stat
            label="Abonado"
            value={formatCurrency(displayDetail.totalPaid)}
            hint="Pagos registrados"
            icon={<HandCoins className="size-5" />}
            tone="success"
          />
          <Stat
            label="Prestado"
            value={formatCurrency(displayDetail.totalAmount)}
            hint={`${pendingRowsCount} registro${pendingRowsCount === 1 ? "" : "s"} pendiente${
              pendingRowsCount === 1 ? "" : "s"
            }`}
            icon={<BadgeDollarSign className="size-5" />}
          />
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">Deudas del proveedor</h2>
              <p className="text-sm text-muted-foreground">
                Pedidos, egresos de obra y deudas manuales pendientes por saldar.
              </p>
            </div>
            <Button
              type="button"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => setManualDebtOpen(true)}
            >
              <Plus className="size-4" />
              Nueva deuda
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5">Origen</TableHead>
                  <TableHead className="px-5">Obra</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Abonado / saldado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="px-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtRows.map((row) => {
                  if (row.kind === "order") {
                    const { order } = row;
                    return (
                      <TableRow key={`order-${order.id}`}>
                        <TableCell className="px-5">
                          <span className="inline-flex rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand-foreground">
                            Pedido
                          </span>
                        </TableCell>
                        <TableCell className="px-5">
                          <div className="font-medium">{order.work.name}</div>
                          <div className="text-xs text-muted-foreground">{order.work.client.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="line-clamp-2">{order.material}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{order.category || "-"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {order.amount === null ? "-" : formatCurrency(order.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                          {formatCurrency(order.paid)}
                        </TableCell>
                        <TableCell className={cn("text-right font-semibold tabular-nums", pendingTone(order.pending, order.amount ?? 0))}>
                          {order.amount === null ? "-" : formatCurrency(order.pending)}
                        </TableCell>
                        <TableCell>
                          {order.paid > 0.001 ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                              Pagando
                            </span>
                          ) : (
                            <OrderStatusBadge status={order.status} />
                          )}
                        </TableCell>
                        <TableCell className="px-5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {order.paid > 0.001 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                title="Ver abonos"
                                aria-label="Ver abonos"
                                onClick={() =>
                                  setHistoryTarget({ sourceType: "work_order", sourceId: order.id, title: order.material })
                                }
                              >
                                <Eye className="size-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-brand text-brand-foreground hover:bg-brand/90"
                              disabled={order.pending <= 0.001}
                              onClick={() =>
                                setSettleTarget({
                                  sourceType: "work_order",
                                  sourceId: order.id,
                                  provider: displayDetail.provider,
                                  title: order.material,
                                  subtitle: `${order.work.name} · ${order.work.client.name}`,
                                  pending: order.pending,
                                })
                              }
                            >
                              <CheckCircle2 className="size-4" />
                              Saldar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (row.kind === "movement") {
                    const { movement } = row;
                    return (
                      <TableRow key={`movement-${movement.id}`}>
                        <TableCell className="px-5">
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            Obra
                          </span>
                        </TableCell>
                        <TableCell className="px-5">
                          <div className="font-medium">{movement.workName}</div>
                          <div className="text-xs text-muted-foreground">{movement.clientName}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(movement.movementDate)}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="line-clamp-2">{movement.concept}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{movement.category || "-"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(movement.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                          {formatCurrency(movement.settled)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-destructive">
                          {formatCurrency(movement.pending)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              movement.settled > 0.001
                                ? "bg-amber-100 text-amber-900"
                                : "bg-red-50 text-destructive",
                            )}
                          >
                            {movement.settled > 0.001 ? "Pagando" : "Por pagar"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {movement.settled > 0.001 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                title="Ver abonos"
                                aria-label="Ver abonos"
                                onClick={() =>
                                  setHistoryTarget({
                                    sourceType: "work_movement",
                                    sourceId: movement.id,
                                    title: movement.concept,
                                  })
                                }
                              >
                                <Eye className="size-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-brand text-brand-foreground hover:bg-brand/90"
                              disabled={movement.pending <= 0.001}
                              onClick={() =>
                                setSettleTarget({
                                  sourceType: "work_movement",
                                  sourceId: movement.id,
                                  provider: displayDetail.provider,
                                  title: movement.concept,
                                  subtitle: `${movement.workName} · ${movement.category || "Egreso de obra"}`,
                                  pending: movement.pending,
                                })
                              }
                            >
                              <CheckCircle2 className="size-4" />
                              Saldar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const { manual } = row;
                  return (
                    <TableRow key={`manual-${manual.debt.id}`}>
                      <TableCell className="px-5">
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                          Manual
                        </span>
                      </TableCell>
                      <TableCell className="px-5">
                        <div className="font-medium">Administrativo</div>
                        <div className="text-xs text-muted-foreground">Deuda manual</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(manual.debt.debt_date)}</TableCell>
                      <TableCell className="max-w-sm">
                        <div className="line-clamp-2">{manual.debt.note || "Gasto manual de proveedor"}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">Manual</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(manual.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                        {formatCurrency(manual.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-destructive">
                        {formatCurrency(manual.totalPending)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            manual.totalPaid > 0.001
                              ? "bg-amber-100 text-amber-900"
                              : "bg-red-50 text-destructive",
                          )}
                        >
                          {manual.totalPaid > 0.001 ? "Pagando" : "Por pagar"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {manual.totalPaid > 0.001 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title="Ver abonos"
                              aria-label="Ver abonos"
                              onClick={() =>
                                setHistoryTarget({
                                  sourceType: "manual_provider_debt",
                                  sourceId: manual.debt.id,
                                  title: manual.debt.note || "Gasto manual de proveedor",
                                })
                              }
                            >
                              <Eye className="size-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-brand text-brand-foreground hover:bg-brand/90"
                            disabled={manual.totalPending <= 0.001}
                            onClick={() =>
                              setSettleTarget({
                                sourceType: "manual_provider_debt",
                                sourceId: manual.debt.id,
                                provider: displayDetail.provider,
                                title: manual.debt.note || "Gasto manual de proveedor",
                                subtitle: `${displayDetail.provider} · deuda manual`,
                                pending: manual.totalPending,
                              })
                            }
                          >
                            <CheckCircle2 className="size-4" />
                            Saldar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {debtRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center text-muted-foreground">
                      Sin deudas pendientes para este proveedor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>

      {settleTarget && (
        <SettleProviderDebtSheet
          open={!!settleTarget}
          onOpenChange={(next) => !next && setSettleTarget(null)}
          target={settleTarget}
          onSettled={applySettlement}
          accounts={accounts}
        />
      )}
      {historyTarget && (
        <ProviderPaymentHistorySheet
          open={!!historyTarget}
          onOpenChange={(next) => !next && setHistoryTarget(null)}
          target={historyTarget}
          payments={displayDetail.payments.filter(
            (payment) =>
              payment.sourceType === historyTarget.sourceType && payment.sourceId === historyTarget.sourceId,
          )}
          onPaymentDeleted={applyDeletedPayment}
        />
      )}
      <ManualProviderDebtSheet
        open={manualDebtOpen}
        onOpenChange={setManualDebtOpen}
        provider={displayDetail.provider}
      />
    </>
  );
}
