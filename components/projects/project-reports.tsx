"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CircleDollarSign,
  Clock,
  Loader2,
  Plus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { registerInternalTransferAction } from "@/app/(dashboard)/projects/actions";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import { round2 } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import type {
  InternalTransferWithMethods,
  PaymentMethod,
  PaymentMethodReportRow,
  UtilityReportRow,
} from "@/lib/types";

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function signedTone(value: number) {
  if (value < -0.001) return "text-destructive";
  if (value > 0.001) return "text-brand-foreground";
  return "text-muted-foreground";
}

function Metric({
  label,
  value,
  icon,
  hint,
  tone,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  tone?: "success" | "danger" | "neutral";
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 p-4",
        accent && "border-transparent bg-brand text-brand-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium",
              accent ? "text-brand-foreground/75" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold leading-tight tabular-nums">
            {value}
          </p>
          {hint && (
            <p
              className={cn(
                "mt-1 text-xs",
                accent ? "text-brand-foreground/70" : "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            accent
              ? "bg-brand-foreground/15"
              : tone === "success"
                ? "bg-brand-muted text-brand-foreground"
                : tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
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
    setErrors({});
  }

  function submitTransfer() {
    setErrors({});
    startTransition(async () => {
      const result = await registerInternalTransferAction({
        description: description.trim(),
        amount: Number(amount),
        transferDate,
        fromPaymentMethodId: fromMethodId,
        toPaymentMethodId: toMethodId,
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
          <SheetTitle>Registrar traspaso interno</SheetTitle>
          <SheetDescription>
            Mueve saldo entre formas de pago sin afectar ningún proyecto.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="transfer-description">Descripción</Label>
            <Input
              id="transfer-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Cierre de proyectos varios"
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="from-method">Desde</Label>
            <Select
              value={fromMethodId}
              onValueChange={(value) => setFromMethodId(value ?? "")}
              items={methodItems}
            >
              <SelectTrigger
                id="from-method"
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
            <Label htmlFor="to-method">Hacia</Label>
            <Select
              value={toMethodId}
              onValueChange={(value) => setToMethodId(value ?? "")}
              items={methodItems}
            >
              <SelectTrigger
                id="to-method"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="transfer-date">Fecha</Label>
              <Input
                id="transfer-date"
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
              <Label htmlFor="transfer-amount">Monto</Label>
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
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
            Registrar traspaso
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ProjectReports({
  methods,
  paymentMethodRows,
  utilityRows,
  internalTransfers,
}: {
  methods: PaymentMethod[];
  paymentMethodRows: PaymentMethodReportRow[];
  utilityRows: UtilityReportRow[];
  internalTransfers: InternalTransferWithMethods[];
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const totalFinalBalance = round2(
    paymentMethodRows.reduce((sum, row) => sum + row.finalBalance, 0),
  );
  const totalClientMovements = round2(
    paymentMethodRows.reduce((sum, row) => sum + row.clientMovements, 0),
  );
  const totalInternalMovements = round2(
    paymentMethodRows.reduce((sum, row) => sum + row.internalMovements, 0),
  );
  const totalUtilities = round2(
    utilityRows.reduce((sum, row) => sum + row.utilityAmount, 0),
  );
  const transferCount = internalTransfers.length;
  const activeMethodCount = paymentMethodRows.filter(
    (row) => Math.abs(row.finalBalance) > 0.001,
  ).length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Saldo final"
          value={signedCurrency(totalFinalBalance)}
          hint={`${activeMethodCount} cuenta${activeMethodCount === 1 ? "" : "s"} con saldo`}
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Movimientos clientes"
          value={signedCurrency(totalClientMovements)}
          hint="Ingresos - egresos"
          icon={<CircleDollarSign className="size-5" />}
          tone="success"
        />
        <Metric
          label="Traspasos internos"
          value={String(transferCount)}
          hint={signedCurrency(totalInternalMovements)}
          icon={<ArrowLeftRight className="size-5" />}
          tone={totalInternalMovements < 0 ? "danger" : "neutral"}
        />
        <Metric
          label="Utilidades"
          value={formatCurrency(totalUtilities)}
          hint={`${utilityRows.length} mes${utilityRows.length === 1 ? "" : "es"} con ingresos`}
          icon={<TrendingUp className="size-5" />}
          tone="success"
        />
      </div>

      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="gap-0 overflow-hidden p-0">
            <SectionTitle
              title="Saldos por forma de pago"
              description="Balance actual de cada cuenta según cobros, pagos internos y traspasos registrados."
            />
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                    Forma de pago
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase text-muted-foreground">
                    Mov. clientes
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase text-muted-foreground">
                    Mov. internos
                  </TableHead>
                  <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                    Saldo final
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
                    <TableCell className={cn("text-right tabular-nums", signedTone(row.clientMovements))}>
                      {signedCurrency(row.clientMovements)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", signedTone(row.internalMovements))}>
                      {signedCurrency(row.internalMovements)}
                    </TableCell>
                    <TableCell className={cn("px-5 text-right font-semibold tabular-nums", signedTone(row.finalBalance))}>
                      {signedCurrency(row.finalBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <SectionTitle
              title="Utilidad mensual"
              description="30% de ingresos por mes."
              action={
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Meses:</span>
                  <span className="font-semibold tabular-nums">{utilityRows.length}</span>
                </div>
              }
            />
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5 text-xs uppercase text-muted-foreground">
                    Fecha
                  </TableHead>
                  <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">
                    Utilidad
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilityRows.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="px-5 capitalize">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full bg-brand" />
                        {monthLabel(row.month)}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                      {formatCurrency(row.utilityAmount)}
                    </TableCell>
                  </TableRow>
                ))}
                {utilityRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                      Sin ingresos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div>
          <Card className="gap-0 overflow-hidden p-0">
            <SectionTitle
              title="Traspasos internos"
              description="Movimientos entre caja, efectivo y cuentas internas."
              action={
                <Button onClick={() => setTransferOpen(true)}>
                  <Plus className="size-4" />
                  Nuevo traspaso
                </Button>
              }
            />
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
                {internalTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="px-5 text-muted-foreground">
                      {formatDate(transfer.transfer_date)}
                    </TableCell>
                    <TableCell className="font-medium">{transfer.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {transfer.fromMethod?.name ?? "Sin cuenta"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transfer.toMethod?.name ?? "Sin cuenta"}
                    </TableCell>
                    <TableCell className="px-5 text-right font-semibold tabular-nums">
                      {formatCurrency(transfer.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {internalTransfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      Sin traspasos internos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <TransferDrawer
        open={transferOpen}
        onOpenChange={setTransferOpen}
        methods={methods}
      />
    </>
  );
}
