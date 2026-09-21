"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Plus, WalletCards } from "lucide-react";
import { registerFinanceInternalTransferAction } from "@/app/(dashboard)/finance/actions";
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
import { round2 } from "@/lib/calculations";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import type {
  InternalTransferBucket,
  PaymentMethod,
  PaymentMethodReportRow,
  WorkInternalTransferWithMethods,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCOUNT_BUCKET_OPTIONS: Array<{ value: InternalTransferBucket; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "office", label: "Cuenta de oficina" },
];

function bucketLabel(bucket: InternalTransferBucket | undefined) {
  return ACCOUNT_BUCKET_OPTIONS.find((option) => option.value === bucket)?.label ?? "Normal";
}

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function TransferDrawer({
  open,
  onOpenChange,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: PaymentMethod[];
}) {
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(todayISODate());
  const [fromMethodId, setFromMethodId] = useState("");
  const [toMethodId, setToMethodId] = useState("");
  const [fromAccountBucket, setFromAccountBucket] = useState<InternalTransferBucket>("normal");
  const [toAccountBucket, setToAccountBucket] = useState<InternalTransferBucket>("normal");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const methodItems = useMemo(
    () => methods.map((method) => ({ label: method.name, value: method.id })),
    [methods],
  );

  function reset() {
    setDescription("");
    setAmount("");
    setTransferDate(todayISODate());
    setFromMethodId("");
    setToMethodId("");
    setFromAccountBucket("normal");
    setToAccountBucket("normal");
    setErrors({});
  }

  function submitTransfer() {
    setErrors({});
    startTransition(async () => {
      const result = await registerFinanceInternalTransferAction({
        description: description.trim(),
        amount: Number(amount),
        transferDate,
        fromPaymentMethodId: fromMethodId,
        toPaymentMethodId: toMethodId,
        fromAccountBucket,
        toAccountBucket,
      });

      if (result.ok) {
        toast.success("Traspaso interno registrado", {
          description: `${formatCurrency(Number(amount))} · ${description.trim()}`,
        });
        reset();
        onOpenChange(false);
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
          <SheetTitle>Registrar movimiento interno</SheetTitle>
          <SheetDescription>
            Mueve saldo entre formas de pago y cuentas internas.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="finance-transfer-description">Descripción</Label>
            <Input
              id="finance-transfer-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Cierre de obras varias"
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2">
              <Label htmlFor="finance-from-method">Desde</Label>
              <Select
                value={fromMethodId}
                onValueChange={(value) => setFromMethodId(value ?? "")}
                items={methodItems}
              >
                <SelectTrigger
                  id="finance-from-method"
                  className="w-full"
                  aria-invalid={!!errors.fromPaymentMethodId}
                >
                  <SelectValue placeholder="Cuenta origen" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fromPaymentMethodId && (
                <p className="text-xs text-destructive">{errors.fromPaymentMethodId}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-from-bucket">Apartado origen</Label>
              <Select
                value={fromAccountBucket}
                onValueChange={(value) => setFromAccountBucket((value as InternalTransferBucket) ?? "normal")}
                items={ACCOUNT_BUCKET_OPTIONS}
              >
                <SelectTrigger id="finance-from-bucket" className="w-full" aria-invalid={!!errors.fromAccountBucket}>
                  <SelectValue placeholder="Apartado origen" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_BUCKET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fromAccountBucket && (
                <p className="text-xs text-destructive">{errors.fromAccountBucket}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2">
              <Label htmlFor="finance-to-method">Hacia</Label>
              <Select
                value={toMethodId}
                onValueChange={(value) => setToMethodId(value ?? "")}
                items={methodItems}
              >
                <SelectTrigger
                  id="finance-to-method"
                  className="w-full"
                  aria-invalid={!!errors.toPaymentMethodId}
                >
                  <SelectValue placeholder="Cuenta destino" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.toPaymentMethodId && (
                <p className="text-xs text-destructive">{errors.toPaymentMethodId}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-to-bucket">Apartado destino</Label>
              <Select
                value={toAccountBucket}
                onValueChange={(value) => setToAccountBucket((value as InternalTransferBucket) ?? "normal")}
                items={ACCOUNT_BUCKET_OPTIONS}
              >
                <SelectTrigger id="finance-to-bucket" className="w-full" aria-invalid={!!errors.toAccountBucket}>
                  <SelectValue placeholder="Apartado destino" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_BUCKET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.toAccountBucket && (
                <p className="text-xs text-destructive">{errors.toAccountBucket}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="finance-transfer-date">Fecha</Label>
              <Input
                id="finance-transfer-date"
                type="date"
                value={transferDate}
                onChange={(event) => setTransferDate(event.target.value)}
                aria-invalid={!!errors.transferDate}
              />
              {errors.transferDate && (
                <p className="text-xs text-destructive">{errors.transferDate}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-transfer-amount">Monto</Label>
              <MoneyInput
                id="finance-transfer-amount"
                value={amount}
                onValueChange={setAmount}
                placeholder="0.00"
                aria-invalid={!!errors.amount}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
            </div>
          </div>

          <Button onClick={submitTransfer} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="size-4" />
            )}
            Registrar movimiento
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
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
            accent ? "bg-brand-foreground/10" : "bg-brand-muted text-brand-foreground",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function InternalTransfersView({
  methods,
  paymentMethodRows,
  transfers,
}: {
  methods: PaymentMethod[];
  paymentMethodRows: PaymentMethodReportRow[];
  transfers: WorkInternalTransferWithMethods[];
}) {
  const [open, setOpen] = useState(false);
  const totalInternalMovements = round2(
    paymentMethodRows.reduce((sum, row) => sum + row.internalMovements, 0),
  );
  const touchedAccounts = paymentMethodRows.filter(
    (row) => Math.abs(row.internalMovements) > 0.001 || Math.abs(row.officeBalance) > 0.001,
  ).length;

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Movimientos internos"
            value={String(transfers.length)}
            hint="Traspasos registrados"
            icon={<ArrowLeftRight className="size-5" />}
            accent
          />
          <Metric
            label="Balance interno"
            value={signedCurrency(totalInternalMovements)}
            hint="Suma neta de traspasos"
            icon={<WalletCards className="size-5" />}
          />
          <Metric
            label="Cuentas afectadas"
            value={String(touchedAccounts)}
            hint="Con movimiento interno"
            icon={<WalletCards className="size-5" />}
          />
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Saldos por cuenta</h2>
            <p className="text-sm text-muted-foreground">
              Separación entre saldo normal y Cuenta de oficina.
            </p>
          </div>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                  Cuenta
                </TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">
                  Normal
                </TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">
                  Cuenta de oficina
                </TableHead>
                <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethodRows.map((row) => (
                <TableRow key={row.methodId}>
                  <TableCell className="px-5 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-brand" />
                      {row.methodName}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.normalBalance < -0.001 && "text-destructive")}>
                    {signedCurrency(row.normalBalance)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.officeBalance < -0.001 && "text-destructive")}>
                    {signedCurrency(row.officeBalance)}
                  </TableCell>
                  <TableCell className={cn("px-5 text-right font-semibold tabular-nums", row.finalBalance < -0.001 && "text-destructive")}>
                    {signedCurrency(row.finalBalance)}
                  </TableCell>
                </TableRow>
              ))}
              {paymentMethodRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Sin cuentas activas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Movimientos internos</h2>
              <p className="text-sm text-muted-foreground">
                Traspasos entre caja, efectivo y cuentas internas.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Nuevo movimiento
            </Button>
          </div>

          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                  Fecha
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">
                  Descripción
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">
                  Desde
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">
                  Hacia
                </TableHead>
                <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                  Monto
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="px-5 text-muted-foreground">
                    {formatDate(transfer.transfer_date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transfer.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transfer.fromMethod?.name ?? "Sin cuenta"} · {bucketLabel(transfer.from_account_bucket)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transfer.toMethod?.name ?? "Sin cuenta"} · {bucketLabel(transfer.to_account_bucket)}
                  </TableCell>
                  <TableCell className="px-5 text-right font-semibold tabular-nums">
                    {formatCurrency(transfer.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {transfers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Sin movimientos internos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <TransferDrawer open={open} onOpenChange={setOpen} methods={methods} />
    </>
  );
}
