"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { formatCurrency } from "@/lib/format";
import { todayISODate } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { PROJECT_SLICE_LABELS } from "@/lib/constants";
import { registerMovementAction } from "@/app/(dashboard)/projects/actions";

const INCOME_SUGGESTIONS = [
  "Anticipo inicial",
  "Pago parcial",
  "Pago final",
  "Ingreso general",
];

const EXPENSE_SUGGESTIONS = {
  proposal: "Pago de propuesta",
  modeling_3d: "Pago de modelado 3D",
  plans: "Pago de planos",
  render: "Pago de render",
} as const;

export function RegisterPaymentSheet({
  open,
  onOpenChange,
  projectId,
  projectName,
  pending,
  methods,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  projectName: string;
  pending: number;
  methods: PaymentMethod[];
}) {
  const [isPending, startTransition] = useTransition();
  const [movementType, setMovementType] = useState<"income" | "expense">("income");
  const [internalArea, setInternalArea] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amountNum = Number(amount);
  const overBalance =
    movementType === "income" && amountNum > 0 && amountNum > pending + 0.001;

  function reset() {
    setMovementType("income");
    setInternalArea("");
    setConcept("");
    setAmount("");
    setMethodId("");
    setDate(todayISODate());
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const res = await registerMovementAction({
        projectId,
        movementType,
        internalArea: movementType === "expense" ? internalArea : null,
        concept: concept.trim(),
        amount: Number(amount),
        paymentDate: date,
        paymentMethodId: methodId,
      });
      if (res.ok) {
        toast.success("Movimiento registrado", {
          description: `${formatCurrency(Number(amount))} · ${concept.trim()}`,
        });
        reset();
        onOpenChange(false);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar movimiento</SheetTitle>
          <SheetDescription>
            {projectName} · Por cobrar {formatCurrency(pending)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-2">
            <Label htmlFor="movement-type">Tipo de movimiento</Label>
            <Select
              value={movementType}
              onValueChange={(v) => {
                const next = (v ?? "income") as "income" | "expense";
                setMovementType(next);
                setInternalArea("");
                setConcept(
                  next === "expense" ? "" : "Anticipo inicial",
                );
              }}
              items={[
                { label: "Ingreso", value: "income" },
                { label: "Egreso", value: "expense" },
              ]}
            >
              <SelectTrigger id="movement-type" className="w-full">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Ingreso</SelectItem>
                <SelectItem value="expense">Egreso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {movementType === "expense" && (
            <div className="grid gap-2">
              <Label htmlFor="internal-area">Área interna</Label>
              <Select
                value={internalArea}
                onValueChange={(v) => {
                  const next = v ?? "";
                  setInternalArea(next);
                  if (next in EXPENSE_SUGGESTIONS) {
                    setConcept(EXPENSE_SUGGESTIONS[next as keyof typeof EXPENSE_SUGGESTIONS]);
                  }
                }}
                items={Object.entries(PROJECT_SLICE_LABELS).map(([value, label]) => ({
                  label,
                  value,
                }))}
              >
                <SelectTrigger
                  id="internal-area"
                  className="w-full"
                  aria-invalid={!!errors.internalArea}
                >
                  <SelectValue placeholder="Selecciona el área" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_SLICE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.internalArea && (
                <p className="text-xs text-destructive">{errors.internalArea}</p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="pay-concept">Concepto</Label>
            <Input
              id="pay-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={
                movementType === "income"
                  ? "Ej. Pago parcial"
                  : "Ej. Pago de modelado 3D"
              }
              aria-invalid={!!errors.concept}
            />
            <div className="flex flex-wrap gap-1.5">
              {(movementType === "income"
                ? INCOME_SUGGESTIONS
                : Object.values(EXPENSE_SUGGESTIONS)
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setConcept(s)}
                  className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            {errors.concept && (
              <p className="text-xs text-destructive">{errors.concept}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-amount">Monto</Label>
            <Input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-invalid={!!errors.amount || overBalance}
            />
            {overBalance && (
              <p className="text-xs text-warning-foreground">
                Advertencia: el ingreso supera el saldo pendiente (
                {formatCurrency(pending)}).
              </p>
            )}
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-method">Forma de pago</Label>
            <Select
              value={methodId}
              onValueChange={(v) => setMethodId(v ?? "")}
              items={methods.map((m) => ({ label: m.name, value: m.id }))}
            >
              <SelectTrigger id="pay-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
                <SelectValue placeholder="Selecciona forma de pago" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMethodId && (
              <p className="text-xs text-destructive">{errors.paymentMethodId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-date">Fecha del pago</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              max={todayISODate()}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.paymentDate}
            />
            {errors.paymentDate && (
              <p className="text-xs text-destructive">{errors.paymentDate}</p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Registrar movimiento
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
