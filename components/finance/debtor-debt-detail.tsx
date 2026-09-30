"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, HandCoins, Loader2, Trash2, WalletCards } from "lucide-react";
import {
  deleteManualDebtorPaymentAction,
  registerManualDebtorPaymentAction,
} from "@/app/(dashboard)/finance/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ManualDebtorDetail, PaymentMethod } from "@/lib/types";

function Stat({
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

function DebtorPaymentSheet({
  open,
  onOpenChange,
  detail,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ManualDebtorDetail;
  accounts: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [amount, setAmount] = useState(String(detail.totalPending));
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const accountItems = accounts.map((account) => ({ value: account.id, label: account.name }));

  function reset() {
    setPaymentDate(todayISODate());
    setAmount(String(detail.totalPending));
    setToAccountId("");
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await registerManualDebtorPaymentAction({
        debtorId: detail.debtor.id,
        paymentDate,
        amount: Number(amount),
        toAccountId,
        note,
      });
      if (result.ok) {
        toast.success("Abono registrado", {
          description: `${formatCurrency(Number(amount))} · ${detail.debtor.name}`,
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
            {detail.debtor.name} · pendiente {formatCurrency(detail.totalPending)}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="debtor-detail-payment-date">Fecha de pago</Label>
            <Input
              id="debtor-detail-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              aria-invalid={!!errors.paymentDate}
            />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="debtor-detail-payment-amount">Monto del abono</Label>
            <MoneyInput
              id="debtor-detail-payment-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="debtor-detail-payment-account">Cuenta donde entra el pago</Label>
            <Select value={toAccountId} onValueChange={(value) => setToAccountId(value ?? "")} items={accountItems}>
              <SelectTrigger id="debtor-detail-payment-account" className="w-full" aria-invalid={!!errors.toAccountId}>
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
            <Label htmlFor="debtor-detail-payment-note">Nota</Label>
            <Input
              id="debtor-detail-payment-note"
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

export function DebtorDebtDetail({
  detail,
  accounts,
}: {
  detail: ManualDebtorDetail;
  accounts: PaymentMethod[];
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManualDebtorDetail["payments"][number] | null>(null);
  const [deleteNote, setDeleteNote] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletePending, startDeleteTransition] = useTransition();
  const router = useRouter();

  function submitDelete() {
    const note = deleteNote.trim();
    if (note.length < 3) {
      setDeleteError("Escribe una observación de al menos 3 caracteres.");
      return;
    }
    if (!deleteTarget) return;

    setDeleteError("");
    startDeleteTransition(async () => {
      const result = await deleteManualDebtorPaymentAction({
        paymentId: deleteTarget.id,
        note,
      });
      if (!result.ok) {
        setDeleteError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Abono eliminado", { description: "La observación quedó registrada en auditoría." });
      setDeleteTarget(null);
      setDeleteNote("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            label="Saldo pendiente"
            value={formatCurrency(detail.totalPending)}
            hint="Por cobrar al deudor"
            icon={<WalletCards className="size-5" />}
            accent
          />
          <Stat
            label="Abonado"
            value={formatCurrency(detail.totalPaid)}
            hint={`${detail.payments.length} abono${detail.payments.length === 1 ? "" : "s"}`}
            icon={<HandCoins className="size-5" />}
            tone="success"
          />
          <Stat
            label="Prestado"
            value={formatCurrency(detail.totalAmount)}
            hint={detail.debtor.project_id ? "Proyecto a crédito" : (detail.debtor.account?.name ?? "Cuenta sin especificar")}
            icon={<CalendarDays className="size-5" />}
          />
        </div>

        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold">Datos del préstamo</h2>
              <p className="text-sm text-muted-foreground">
                Salida desde{" "}
                {detail.debtor.project_id ? "proyecto a crédito" : (detail.debtor.account?.name ?? "cuenta sin especificar")} el{" "}
                {formatDate(detail.debtor.loan_date)}.
              </p>
              {detail.debtor.note && (
                <p className="mt-2 text-sm text-muted-foreground">{detail.debtor.note}</p>
              )}
            </div>
            <Button
              onClick={() => setPaymentOpen(true)}
              disabled={detail.totalPending <= 0.001}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <CheckCircle2 className="size-4" />
              Registrar abono
            </Button>
          </div>
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Flujo de cobranza</h2>
            <p className="text-sm text-muted-foreground">
              Abonos registrados y cuenta donde entró cada pago.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5">Fecha</TableHead>
                  <TableHead>Cuenta destino</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="px-5 text-right">Monto</TableHead>
                  <TableHead className="w-14 px-3 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="px-5 whitespace-nowrap text-muted-foreground">
                      {formatDate(payment.payment_date)}
                    </TableCell>
                    <TableCell className="font-medium">{payment.account?.name ?? "Cuenta"}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.note || "-"}</TableCell>
                    <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="px-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar abono"
                        title="Eliminar abono"
                        onClick={() => {
                          setDeleteTarget(payment);
                          setDeleteNote("");
                          setDeleteError("");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {detail.payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      Sin abonos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <DebtorPaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        detail={detail}
        accounts={accounts}
      />
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (open || isDeletePending) return;
          setDeleteTarget(null);
          setDeleteNote("");
          setDeleteError("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar abono</DialogTitle>
            <DialogDescription>
              {deleteTarget?.project_payment_id
                ? "Este abono también se eliminará de los movimientos del proyecto. La observación quedará en auditoría."
                : "El abono se quitará de los registros activos y el saldo se recalculará. La observación quedará en auditoría."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{formatDate(deleteTarget.payment_date)}</p>
              <p className="mt-1 text-muted-foreground">
                {deleteTarget.account?.name ?? "Cuenta"} · {formatCurrency(deleteTarget.amount)}
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="delete-debtor-payment-note">Observación</Label>
            <Textarea
              id="delete-debtor-payment-note"
              value={deleteNote}
              onChange={(event) => setDeleteNote(event.target.value)}
              placeholder="Explica por qué eliminas este abono"
              rows={3}
              aria-invalid={!!deleteError}
              disabled={isDeletePending}
            />
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeletePending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={isDeletePending}>
              {isDeletePending && <Loader2 className="size-4 animate-spin" />}
              Eliminar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
