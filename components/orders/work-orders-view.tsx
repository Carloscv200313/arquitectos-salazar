"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Boxes,
  ClipboardPlus,
  CreditCard,
  Eye,
  History,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import {
  createWorkOrderAction,
  editWorkOrderAction,
  quoteWorkOrderAction,
  registerWorkOrderPaymentAction,
  toggleWorkOrderRequestedAction,
} from "@/app/(dashboard)/pedidos/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, WorkOrderWithRelations, WorkWithFinance } from "@/lib/types";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderPaymentActions } from "./order-payment-actions";

function pendingTone(pending: number, total: number) {
  if (total <= 0.001 || pending <= 0.001) return "text-muted-foreground";
  return Math.abs(pending - total) < 0.001
    ? "text-destructive"
    : "text-brand-foreground";
}

function shortText(value: string | null | undefined, max = 10) {
  const text = value?.trim() || "-";
  if (text === "-" || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function payableMethod(methods: PaymentMethod[]) {
  return methods.find((method) => method.name.toLowerCase() === "cuentas por pagar");
}

function realPaymentMethods(methods: PaymentMethod[]) {
  const payable = payableMethod(methods);
  return methods.filter((method) => method.id !== payable?.id);
}

function PaymentProgressPanel({ order }: { order: WorkOrderWithRelations }) {
  const amount = order.amount ?? 0;
  const progress = amount > 0 ? Math.min((order.paid / amount) * 100, 100) : 0;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="grid gap-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Avance de pago
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {amount > 0 ? `${progress.toFixed(1)}%` : "Sin monto"}
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-3 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="text-sm font-semibold tabular-nums sm:text-base">
                {order.amount === null ? "-" : formatCurrency(order.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Abonado</p>
              <p className="text-sm font-semibold tabular-nums text-brand-foreground sm:text-base">
                {formatCurrency(order.paid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums sm:text-base",
                  pendingTone(order.pending, amount),
                )}
              >
                {order.amount === null ? "-" : formatCurrency(order.pending)}
              </p>
            </div>
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

function NewOrderSheet({
  open,
  onOpenChange,
  work,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work: WorkWithFinance;
  providers: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orderDate, setOrderDate] = useState(todayISODate());
  const [supplier, setSupplier] = useState("");
  const [material, setMaterial] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const providerItems = providers.map((item) => ({ label: item, value: item }));

  function reset() {
    setOrderDate(todayISODate());
    setSupplier("");
    setMaterial("");
    setDescription("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await createWorkOrderAction({
        workId: work.id,
        orderDate,
        supplier,
        material,
        description,
      });
      if (result.ok) {
        toast.success("Pedido registrado", { description: material });
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
    <Sheet open={open} onOpenChange={(next) => {
      if (!next) reset();
      onOpenChange(next);
    }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nuevo pedido</SheetTitle>
          <SheetDescription>{work.name} · {work.client.name}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="order-date">Fecha</Label>
              <Input id="order-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} aria-invalid={!!errors.orderDate} />
              {errors.orderDate && <p className="text-xs text-destructive">{errors.orderDate}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Para</Label>
              <Input value={work.client.name} readOnly className="bg-muted/50 text-muted-foreground" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-supplier">Proveedor</Label>
            <Select value={supplier} onValueChange={(value) => setSupplier(value ?? "")} items={providerItems}>
              <SelectTrigger id="order-supplier" className="w-full" aria-invalid={!!errors.supplier}>
                <SelectValue placeholder="Selecciona proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-material">Material</Label>
            <Textarea
              id="order-material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Ej. 15 varillas de 3/8, 2 viajes de tepetate, cemento y accesorios"
              maxLength={1000}
              className="min-h-28"
              aria-invalid={!!errors.material}
            />
            <div className="flex items-center justify-between gap-3">
              {errors.material ? (
                <p className="text-xs text-destructive">{errors.material}</p>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Describe todos los materiales del pedido.
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {material.length}/1000
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-description">Observación</Label>
            <Textarea id="order-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notas para el proveedor" aria-invalid={!!errors.description} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}
            Registrar pedido
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuoteOrderSheet({
  open,
  onOpenChange,
  order,
  methods,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
  methods: PaymentMethod[];
  categories: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quoteDate, setQuoteDate] = useState(todayISODate());
  const [category, setCategory] = useState("Material de construcción");
  const [amount, setAmount] = useState("");
  const [registerAdvance, setRegisterAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advancePaymentMethodId, setAdvancePaymentMethodId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categoryItems = categories.map((item) => ({ label: item, value: item }));
  const methodItems = realPaymentMethods(methods).map((method) => ({
    label: method.name,
    value: method.id,
  }));

  function reset() {
    setQuoteDate(todayISODate());
    setCategory("Material de construcción");
    setAmount("");
    setRegisterAdvance(false);
    setAdvanceAmount("");
    setAdvancePaymentMethodId("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await quoteWorkOrderAction({
        orderId: order.id,
        quoteDate,
        category,
        amount: Number(amount),
        registerAdvance,
        advanceAmount: registerAdvance ? Number(advanceAmount) : undefined,
        advancePaymentMethodId: registerAdvance ? advancePaymentMethodId : "",
      });
      if (result.ok) {
        toast.success("Monto registrado", {
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
    <Sheet open={open} onOpenChange={(next) => {
      if (!next) reset();
      onOpenChange(next);
    }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Asignar monto</SheetTitle>
          <SheetDescription>{order.material} · {order.supplier}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="quote-date">Fecha</Label>
              <Input id="quote-date" type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} aria-invalid={!!errors.quoteDate} />
              {errors.quoteDate && <p className="text-xs text-destructive">{errors.quoteDate}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quote-amount">Monto del pedido</Label>
              <MoneyInput id="quote-amount" value={amount} onValueChange={setAmount} placeholder="0.00" aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quote-category">Categoría</Label>
            <Select value={category} onValueChange={(value) => setCategory(value ?? "")} items={categoryItems}>
              <SelectTrigger id="quote-category" className="w-full" aria-invalid={!!errors.category}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>

          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={registerAdvance}
              onChange={(event) => setRegisterAdvance(event.target.checked)}
              className="size-4 accent-lime-400"
            />
            Registrar adelanto ahora
          </label>

          {registerAdvance && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="advance-amount">Adelanto</Label>
                <MoneyInput id="advance-amount" value={advanceAmount} onValueChange={setAdvanceAmount} placeholder="0.00" aria-invalid={!!errors.advanceAmount} />
                {errors.advanceAmount && <p className="text-xs text-destructive">{errors.advanceAmount}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="advance-method">Forma de pago</Label>
                <Select value={advancePaymentMethodId} onValueChange={(value) => setAdvancePaymentMethodId(value ?? "")} items={methodItems}>
                  <SelectTrigger id="advance-method" className="w-full" aria-invalid={!!errors.advancePaymentMethodId}>
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {realPaymentMethods(methods).map((method) => (
                      <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.advancePaymentMethodId && <p className="text-xs text-destructive">{errors.advancePaymentMethodId}</p>}
              </div>
            </div>
          )}

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
            Guardar monto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaymentSheet({
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
    <Sheet open={open} onOpenChange={(next) => {
      if (!next) reset();
      onOpenChange(next);
    }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar abono</SheetTitle>
          <SheetDescription>
            Pendiente: {formatCurrency(order.pending)} · {order.supplier}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-date">Fecha</Label>
            <Input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} aria-invalid={!!errors.paymentDate} />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Monto</Label>
            <MoneyInput id="payment-amount" value={amount} onValueChange={setAmount} placeholder="0.00" aria-invalid={!!errors.amount} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-method">Forma de pago</Label>
            <Select value={paymentMethodId} onValueChange={(value) => setPaymentMethodId(value ?? "")} items={methodItems}>
              <SelectTrigger id="payment-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {realPaymentMethods(methods).map((method) => (
                  <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMethodId && <p className="text-xs text-destructive">{errors.paymentMethodId}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-description">Descripción</Label>
            <Input id="payment-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Abono a proveedor" aria-invalid={!!errors.description} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            Guardar abono
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditOrderSheet({
  open,
  onOpenChange,
  order,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
  providers: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supplier, setSupplier] = useState(order.supplier);
  const [material, setMaterial] = useState(order.material);
  const [amount, setAmount] = useState(order.amount === null ? "" : String(order.amount));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const providerItems = providers.map((item) => ({ label: item, value: item }));

  function reset() {
    setSupplier(order.supplier);
    setMaterial(order.material);
    setAmount(order.amount === null ? "" : String(order.amount));
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await editWorkOrderAction({
        orderId: order.id,
        workId: order.work.id,
        supplier,
        material,
        amount: order.amount === null ? null : Number(amount),
        note,
      });
      if (result.ok) {
        toast.success("Pedido actualizado", {
          description: `${supplier} · ${shortText(material, 24)}`,
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
          <SheetTitle>Editar pedido</SheetTitle>
          <SheetDescription>
            Actualiza proveedor, material y monto con observación obligatoria.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-order-supplier">Proveedor</Label>
            <Select value={supplier} onValueChange={(value) => setSupplier(value ?? "")} items={providerItems}>
              <SelectTrigger id="edit-order-supplier" className="w-full" aria-invalid={!!errors.supplier}>
                <SelectValue placeholder="Selecciona proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-order-material">Material</Label>
            <Textarea
              id="edit-order-material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="min-h-28"
              maxLength={1000}
              aria-invalid={!!errors.material}
            />
            <div className="flex items-center justify-between gap-3">
              {errors.material ? (
                <p className="text-xs text-destructive">{errors.material}</p>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Describe los materiales del pedido.
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{material.length}/1000</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-order-amount">Monto</Label>
            <MoneyInput
              id="edit-order-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder={order.amount === null ? "Asigna el monto desde el botón Monto" : "0.00"}
              disabled={order.amount === null}
              aria-invalid={!!errors.amount}
            />
            {errors.amount ? (
              <p className="text-xs text-destructive">{errors.amount}</p>
            ) : order.amount === null ? (
              <p className="text-xs text-muted-foreground">
                Este pedido aún no tiene monto. Usa el botón <span className="font-medium">Monto</span> para asignarlo.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No puede ser menor a lo ya abonado.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-order-note">Observación del cambio</Label>
            <Textarea
              id="edit-order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explica por qué se está modificando este pedido"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            Guardar cambios
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaymentHistorySheet({
  open,
  onOpenChange,
  order,
  workId,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
  workId: string;
  methods: PaymentMethod[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto   sm:!w-[min(50vw,920px)] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>Historial de abonos</SheetTitle>
          <SheetDescription>
            {order.material} · {order.supplier}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-5">
          <PaymentProgressPanel order={order} />

          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">Abonos del pedido</h3>
              <p className="text-sm text-muted-foreground">
                Pagos aplicados contra este proveedor y pedido.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-5">Fecha</TableHead>
                    <TableHead className="min-w-40">Forma de pago</TableHead>
                    <TableHead className="min-w-56">Descripción</TableHead>
                    <TableHead className="px-5 text-right">Monto</TableHead>
                    <TableHead className="px-5 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="px-5 whitespace-nowrap text-muted-foreground">
                        {formatDate(payment.payment_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.method?.name ?? "Sin forma"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.description}
                      </TableCell>
                      <TableCell className="px-5 text-right font-semibold tabular-nums text-brand-foreground">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        <OrderPaymentActions payment={payment} workId={workId} methods={methods} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {order.payments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Este pedido todavía no tiene abonos registrados.
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

function OrderDetailSheet({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderWithRelations;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:!w-[min(92vw,620px)] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>Detalle del pedido</SheetTitle>
          <SheetDescription>
            {order.supplier} · {formatDate(order.order_date)}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-5">
          <PaymentProgressPanel order={order} />

          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex flex-col gap-5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Para
                  </p>
                  <p className="mt-1 font-semibold">{order.work.client.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pedido creado el {formatDate(order.order_date)}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="grid gap-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Material
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 leading-relaxed">
                  {order.material}
                </p>
              </div>

              <div className="grid gap-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Observación
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/30 px-3 py-2 leading-relaxed text-muted-foreground">
                  {order.description || "-"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WorkOrdersView({
  work,
  orders,
  methods,
  providers,
  categories,
}: {
  work: WorkWithFinance;
  orders: WorkOrderWithRelations[];
  methods: PaymentMethod[];
  providers: string[];
  categories: string[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<WorkOrderWithRelations | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<WorkOrderWithRelations | null>(null);
  const [historyTarget, setHistoryTarget] = useState<WorkOrderWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<WorkOrderWithRelations | null>(null);
  const [editTarget, setEditTarget] = useState<WorkOrderWithRelations | null>(null);
  const [isUpdatingRequested, startRequestedTransition] = useTransition();
  const totalAmount = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  const totalPaid = orders.reduce((sum, order) => sum + order.paid, 0);
  const totalPending = orders.reduce((sum, order) => sum + order.pending, 0);

  function toggleRequested(order: WorkOrderWithRelations, isRequested: boolean) {
    startRequestedTransition(async () => {
      const result = await toggleWorkOrderRequestedAction({
        orderId: order.id,
        isRequested,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isRequested ? "Pedido marcado como solicitado" : "Pedido marcado como pendiente");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-transparent bg-brand p-5 text-brand-foreground">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand-foreground/80">
                  Pendiente
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatCurrency(totalPending)}
                </p>
                <p className="mt-1 text-xs text-brand-foreground/70">
                  Por abonar a proveedores
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-foreground/10">
                <BadgeDollarSign className="size-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Abonado</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-brand-foreground">
                  {formatCurrency(totalPaid)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pagos a proveedores</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand-foreground">
                <CreditCard className="size-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monto total</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pedidos con monto</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <WalletCards className="size-5" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {orders.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{work.client.name}</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Boxes className="size-5" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Pedidos de la obra</h2>
              <p className="text-sm text-muted-foreground">
                Registra materiales, monto acordado y abonos por proveedor.
              </p>
            </div>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              Nuevo pedido
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5 text-center">Solicitado</TableHead>
                  <TableHead className="px-5">Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-56 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="px-5 text-center">
                      <input
                        type="checkbox"
                        checked={order.is_requested}
                        disabled={isUpdatingRequested}
                        onChange={(event) => toggleRequested(order, event.target.checked)}
                        aria-label={
                          order.is_requested
                            ? "Marcar pedido como pendiente"
                            : "Marcar pedido como solicitado"
                        }
                        className="size-4 rounded border-input accent-lime-400"
                      />
                    </TableCell>
                    <TableCell className="px-5 whitespace-nowrap text-muted-foreground">
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell className="font-medium">{order.supplier}</TableCell>
                    <TableCell className="text-muted-foreground" title={work.client.name}>
                      {shortText(work.client.name)}
                    </TableCell>
                    <TableCell title={order.material}>
                      {shortText(order.material)}
                    </TableCell>
                    <TableCell className="text-muted-foreground" title={order.description || undefined}>
                      {shortText(order.description)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {order.amount === null ? "-" : formatCurrency(order.amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                      {formatCurrency(order.paid)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        pendingTone(order.pending, order.amount ?? 0),
                      )}
                    >
                      {order.amount === null ? "-" : formatCurrency(order.pending)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.amount === null ? (
                          <Button size="sm" variant="outline" onClick={() => setQuoteTarget(order)}>
                            Monto
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-8 border-brand/30 bg-brand-muted text-brand-foreground hover:bg-brand hover:text-brand-foreground"
                            disabled={order.pending <= 0.001}
                            onClick={() => setPaymentTarget(order)}
                            title="Registrar abono"
                          >
                            <BadgeDollarSign className="size-4" />
                            <span className="sr-only">Registrar abono</span>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => setEditTarget(order)}
                          title="Editar pedido"
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Editar pedido</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => setDetailTarget(order)}
                          title="Ver detalle del pedido"
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">Ver detalle del pedido</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => setHistoryTarget(order)}
                          title="Ver historial de abonos"
                        >
                          <History className="size-4" />
                          <span className="sr-only">Ver historial de abonos</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                      Aún no hay pedidos registrados para esta obra.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <NewOrderSheet open={newOpen} onOpenChange={setNewOpen} work={work} providers={providers} />
      {quoteTarget && (
        <QuoteOrderSheet
          open={!!quoteTarget}
          onOpenChange={(open) => !open && setQuoteTarget(null)}
          order={quoteTarget}
          methods={methods}
          categories={categories}
        />
      )}
      {paymentTarget && (
        <PaymentSheet
          open={!!paymentTarget}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          order={paymentTarget}
          methods={methods}
        />
      )}
      {historyTarget && (
        <PaymentHistorySheet
          open={!!historyTarget}
          onOpenChange={(open) => !open && setHistoryTarget(null)}
          order={historyTarget}
          workId={work.id}
          methods={methods}
        />
      )}
      {detailTarget && (
        <OrderDetailSheet
          open={!!detailTarget}
          onOpenChange={(open) => !open && setDetailTarget(null)}
          order={detailTarget}
        />
      )}
      {editTarget && (
        <EditOrderSheet
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          order={editTarget}
          providers={providers}
        />
      )}
    </>
  );


  
}
