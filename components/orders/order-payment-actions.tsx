"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayISODate } from "@/lib/format";
import type { PaymentMethod, WorkOrderPaymentWithMethod } from "@/lib/types";
import {
  editWorkOrderPaymentAction,
  deleteWorkOrderPaymentAction,
} from "@/app/(dashboard)/pedidos/actions";

function realMethods(methods: PaymentMethod[]) {
  return methods.filter((m) => m.name.toLowerCase() !== "cuentas por pagar");
}

export function OrderPaymentActions({
  payment,
  workId,
  methods,
}: {
  payment: WorkOrderPaymentWithMethod;
  workId: string;
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [description, setDescription] = useState(payment.description);
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.payment_date);
  const [methodId, setMethodId] = useState(payment.payment_method_id);
  const [editNote, setEditNote] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  const options = realMethods(methods);

  function resetEdit() {
    setDescription(payment.description);
    setAmount(String(payment.amount));
    setDate(payment.payment_date);
    setMethodId(payment.payment_method_id);
    setEditNote("");
    setErrors({});
  }

  function submitEdit() {
    setErrors({});
    startTransition(async () => {
      const res = await editWorkOrderPaymentAction({
        paymentId: payment.id,
        workId,
        description: description.trim(),
        amount: Number(amount),
        paymentDate: date,
        paymentMethodId: methodId,
        note: editNote.trim(),
      });
      if (res.ok) {
        toast.success("Abono actualizado");
        setEditOpen(false);
        router.refresh();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  function submitDelete() {
    setErrors({});
    startTransition(async () => {
      const res = await deleteWorkOrderPaymentAction({
        paymentId: payment.id,
        workId,
        note: deleteNote.trim(),
      });
      if (res.ok) {
        toast.success("Abono eliminado");
        setDeleteOpen(false);
        router.refresh();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => {
          resetEdit();
          setEditOpen(true);
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg border transition-colors hover:bg-accent"
        title="Editar abono"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setDeleteNote("");
          setErrors({});
          setDeleteOpen(true);
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg border text-destructive transition-colors hover:bg-destructive/10"
        title="Eliminar abono"
      >
        <Trash2 className="size-3.5" />
      </button>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar abono</SheetTitle>
            <SheetDescription>
              El saldo del pedido y de la cuenta se recalculan automáticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="grid gap-2">
              <Label htmlFor="op-desc">Descripción</Label>
              <Input
                id="op-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="op-amount">Monto</Label>
              <MoneyInput
                id="op-amount"
                value={amount}
                onValueChange={setAmount}
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="op-method">Forma de pago</Label>
              <Select
                value={methodId}
                onValueChange={(v) => setMethodId(v ?? "")}
                items={options.map((m) => ({ label: m.name, value: m.id }))}
              >
                <SelectTrigger id="op-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
                  <SelectValue placeholder="Selecciona forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((m) => (
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
              <Label htmlFor="op-date">Fecha</Label>
              <Input
                id="op-date"
                type="date"
                value={date}
                max={todayISODate()}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.paymentDate}
              />
              {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="op-note">Motivo del cambio</Label>
              <Textarea
                id="op-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Explica por qué editas este abono (queda en auditoría)…"
                rows={3}
                aria-invalid={!!errors.note}
              />
              {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
            </div>
          </div>

          <SheetFooter>
            <Button onClick={submitEdit} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar abono</DialogTitle>
            <DialogDescription>
              Esta acción desactiva el abono, revierte el traspaso de la cuenta y recalcula los
              saldos. Escribe el motivo: quedará en auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="op-del-note">Motivo de la eliminación</Label>
            <Textarea
              id="op-del-note"
              value={deleteNote}
              onChange={(e) => setDeleteNote(e.target.value)}
              placeholder="Ej. Abono duplicado / monto incorrecto…"
              rows={3}
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
