"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  WORK_EXPENSE_CATEGORIES,
  WORK_INCOME_CATEGORY,
  WORK_PROVIDERS,
} from "@/lib/constants";
import { formatCurrency, todayISODate } from "@/lib/format";
import { registerWorkMovementAction } from "@/app/(dashboard)/obras/actions";
import type { PaymentMethod } from "@/lib/types";

export function RegisterWorkMovementSheet({
  open,
  onOpenChange,
  workId,
  workName,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workId: string;
  workName: string;
  methods: PaymentMethod[];
}) {
  const [isPending, startTransition] = useTransition();
  const [movementType, setMovementType] = useState<"income" | "expense">("expense");
  const [receipt, setReceipt] = useState("");
  const [movementDate, setMovementDate] = useState(todayISODate());
  const [concept, setConcept] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [observations, setObservations] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoryItems = WORK_EXPENSE_CATEGORIES.map((item) => ({ label: item, value: item }));
  const providerItems = WORK_PROVIDERS.map((item) => ({ label: item, value: item }));
  const methodItems = methods.map((method) => ({ label: method.name, value: method.id }));

  function reset() {
    setMovementType("expense");
    setReceipt("");
    setMovementDate(todayISODate());
    setConcept("");
    setSupplier("");
    setCategory("");
    setPaymentMethodId("");
    setAmount("");
    setObservations("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await registerWorkMovementAction({
        workId,
        receipt,
        movementDate,
        concept,
        supplier: movementType === "expense" ? supplier : "",
        category: movementType === "income" ? WORK_INCOME_CATEGORY : category,
        movementType,
        amount: Number(amount),
        paymentMethodId,
        observations,
      });
      if (result.ok) {
        toast.success("Movimiento registrado", {
          description: `${formatCurrency(Number(amount))} · ${concept}`,
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Registrar movimiento</SheetTitle>
          <SheetDescription>{workName}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="work-movement-type">Tipo de movimiento</Label>
            <Select
              value={movementType}
              onValueChange={(value) => {
                const next = (value ?? "expense") as "income" | "expense";
                setMovementType(next);
                setCategory(next === "income" ? WORK_INCOME_CATEGORY : "");
                setSupplier("");
              }}
              items={[
                { label: "Entrada", value: "income" },
                { label: "Salida", value: "expense" },
              ]}
            >
              <SelectTrigger id="work-movement-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">
                  <ArrowDownLeft className="size-4" /> Entrada
                </SelectItem>
                <SelectItem value="expense">
                  <ArrowUpRight className="size-4" /> Salida
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="receipt">Recibo</Label>
              <Input id="receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} aria-invalid={!!errors.receipt} />
              {errors.receipt && <p className="text-xs text-destructive">{errors.receipt}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="movement-date">Fecha</Label>
              <Input id="movement-date" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} aria-invalid={!!errors.movementDate} />
              {errors.movementDate && <p className="text-xs text-destructive">{errors.movementDate}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="concept">Concepto</Label>
            <Input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={movementType === "income" ? "Ej. Abono inicial" : "Ej. Compra de material"}
              aria-invalid={!!errors.concept}
            />
            {errors.concept && <p className="text-xs text-destructive">{errors.concept}</p>}
          </div>

          {movementType === "expense" && (
            <div className="grid gap-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Select
                value={supplier}
                onValueChange={(value) => setSupplier(value ?? "")}
                items={providerItems}
              >
                <SelectTrigger id="supplier" className="w-full" aria-invalid={!!errors.supplier}>
                  <SelectValue placeholder="Selecciona proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_PROVIDERS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoría</Label>
              {movementType === "income" ? (
                <Input
                  id="category"
                  value={WORK_INCOME_CATEGORY}
                  readOnly
                  className="bg-muted/50 text-muted-foreground"
                />
              ) : (
                <Select value={category} onValueChange={(value) => setCategory(value ?? "")} items={categoryItems}>
                  <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_EXPENSE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-method">Forma de pago</Label>
              <Select
                value={paymentMethodId}
                onValueChange={(value) => setPaymentMethodId(value ?? "")}
                items={methodItems}
              >
                <SelectTrigger
                  id="payment-method"
                  className="w-full"
                  aria-invalid={!!errors.paymentMethodId}
                >
                  <SelectValue placeholder="Selecciona forma" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paymentMethodId && (
                <p className="text-xs text-destructive">{errors.paymentMethodId}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Monto</Label>
            <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={!!errors.amount} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observations">Observaciones</Label>
            <Textarea id="observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Notas adicionales" />
          </div>

          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownLeft className="size-4" />}
            Guardar movimiento
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
