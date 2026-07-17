"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeDollarSign, Boxes, HandCoins, History, Hammer, Loader2 } from "lucide-react";
import { registerWorkOrderPaymentAction } from "@/app/(dashboard)/pedidos/actions";
import { OrderPaymentActions } from "@/components/orders/order-payment-actions";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import type { PaymentMethod, ProviderDebtDetail, WorkOrderWithRelations } from "@/lib/types";

function pendingTone(pending: number, total: number) {
  if (total <= 0.001 || pending <= 0.001) return "text-muted-foreground";
  return Math.abs(pending - total) < 0.001 ? "text-destructive" : "text-brand-foreground";
}

function realPaymentMethods(methods: PaymentMethod[]) {
  return methods.filter((method) => method.name.toLowerCase() !== "cuentas por pagar");
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

function ProviderPaymentSheet({
  open,
  onOpenChange,
  order,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const methodItems = realPaymentMethods(methods).map((method) => ({
    label: method.name,
    value: method.id,
  }));

  function reset() {
    setPaymentDate(todayISODate());
    setDescription("");
    setAmount("");
    setPaymentMethodId("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await registerWorkOrderPaymentAction({
        orderId: order.id,
        paymentDate,
        description,
        amount: Number(amount),
        paymentMethodId,
      });
      if (result.ok) {
        toast.success("Abono registrado", {
          description: `${formatCurrency(Number(amount))} · ${order.supplier}`,
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
            Pendiente: {formatCurrency(order.pending)} · {order.material}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="provider-payment-date">Fecha</Label>
            <Input
              id="provider-payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              aria-invalid={!!errors.paymentDate}
            />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-payment-amount">Monto</Label>
            <Input
              id="provider-payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-payment-method">Forma de pago</Label>
            <Select value={paymentMethodId} onValueChange={(value) => setPaymentMethodId(value ?? "")} items={methodItems}>
              <SelectTrigger id="provider-payment-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {realPaymentMethods(methods).map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMethodId && <p className="text-xs text-destructive">{errors.paymentMethodId}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-payment-description">Descripción</Label>
            <Input
              id="provider-payment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Abono a proveedor"
              aria-invalid={!!errors.description}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <BadgeDollarSign className="size-4" />}
            Guardar abono
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderPaymentHistorySheet({
  open,
  onOpenChange,
  order,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
  methods: PaymentMethod[];
}) {
  const payments = [...order.payments].sort((a, b) => {
    const byDate = b.payment_date.localeCompare(a.payment_date);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:!w-[min(92vw,1180px)] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>Historial de abonos</SheetTitle>
          <SheetDescription>
            {order.work.name} · {order.material}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Monto"
              value={order.amount === null ? "-" : formatCurrency(order.amount)}
              hint="Total del pedido"
              icon={<BadgeDollarSign className="size-5" />}
              accent
            />
            <Stat
              label="Obra"
              value={order.work.name}
              hint=""
              icon={<Hammer className="size-5" />}
              compactValue
            />
            <Stat
              label="Abonado"
              value={formatCurrency(order.paid)}
              hint="Pagos registrados"
              icon={<HandCoins className="size-5" />}
              tone="success"
            />
            <Stat
              label="Pendiente"
              value={order.amount === null ? "-" : formatCurrency(order.pending)}
              hint="Saldo restante"
              icon={<Boxes className="size-5" />}
              tone="danger"
            />
          </div>

          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">Abonos de esta deuda</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Historial de pagos registrados para este pedido.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-5">Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="px-5 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="px-5 text-muted-foreground">
                        {formatDate(payment.payment_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{payment.description}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.method?.name ?? "Sin cuenta"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        <OrderPaymentActions payment={payment} workId={order.work.id} methods={methods} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Aún no hay abonos registrados para esta deuda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ProviderDebtDetail({
  detail,
  methods,
}: {
  detail: ProviderDebtDetail;
  methods: PaymentMethod[];
}) {
  const [paymentTarget, setPaymentTarget] = useState<WorkOrderWithRelations | null>(null);
  const [historyTarget, setHistoryTarget] = useState<WorkOrderWithRelations | null>(null);

  return (
    <>
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            label="Deuda pendiente"
            value={formatCurrency(detail.totalPending)}
            hint="Saldo pendiente del proveedor"
            icon={<Boxes className="size-5" />}
            accent
          />
          <Stat
            label="Abonado"
            value={formatCurrency(detail.totalPaid)}
            hint="Pagos registrados"
            icon={<HandCoins className="size-5" />}
            tone="success"
          />
          <Stat
            label="Pedidos con saldo"
            value={String(detail.orders.length)}
            hint="Registros pendientes"
            icon={<BadgeDollarSign className="size-5" />}
          />
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Deudas del proveedor</h2>
            <p className="text-sm text-muted-foreground">
              Cada fila representa un pedido pendiente por abonar.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5">Obra</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="px-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="px-5">
                      <div className="font-medium">{order.work.name}</div>
                      <div className="text-xs text-muted-foreground">{order.work.client.name}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                    <TableCell className="max-w-sm">
                      <div className="line-clamp-2">{order.material}</div>
                    </TableCell>
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
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="px-5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={order.pending <= 0.001}
                          onClick={() => setPaymentTarget(order)}
                        >
                          <BadgeDollarSign className="size-4" />
                          Abonar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoryTarget(order)}
                        >
                          <History className="size-4" />
                          Historial
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>

      {paymentTarget && (
        <ProviderPaymentSheet
          open={!!paymentTarget}
          onOpenChange={(next) => !next && setPaymentTarget(null)}
          order={paymentTarget}
          methods={methods}
        />
      )}
      {historyTarget && (
        <OrderPaymentHistorySheet
          open={!!historyTarget}
          onOpenChange={(next) => !next && setHistoryTarget(null)}
          order={historyTarget}
          methods={methods}
        />
      )}
    </>
  );
}
