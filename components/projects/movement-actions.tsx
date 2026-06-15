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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayISODate } from "@/lib/format";
import { PROJECT_SLICE_LABELS } from "@/lib/constants";
import type { PaymentMethod, PaymentWithMethod } from "@/lib/types";
import {
  editProjectMovementAction,
  deleteProjectMovementAction,
} from "@/app/(dashboard)/projects/actions";

export function ProjectMovementActions({
  payment,
  projectId,
  methods,
}: {
  payment: PaymentWithMethod;
  projectId: string;
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [concept, setConcept] = useState(payment.concept);
  const [amount, setAmount] = useState(String(payment.amount));
  const [methodId, setMethodId] = useState(payment.payment_method_id);
  const [date, setDate] = useState(payment.payment_date);
  const [internalArea, setInternalArea] = useState(payment.internal_area ?? "");
  const [editNote, setEditNote] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  const isExpense = payment.movement_type === "expense";

  function resetEdit() {
    setConcept(payment.concept);
    setAmount(String(payment.amount));
    setMethodId(payment.payment_method_id);
    setDate(payment.payment_date);
    setInternalArea(payment.internal_area ?? "");
    setEditNote("");
    setErrors({});
  }

  function submitEdit() {
    setErrors({});
    startTransition(async () => {
      const res = await editProjectMovementAction({
        paymentId: payment.id,
        projectId,
        movementType: payment.movement_type,
        concept: concept.trim(),
        amount: Number(amount),
        paymentDate: date,
        paymentMethodId: methodId,
        internalArea: isExpense ? internalArea : null,
        note: editNote.trim(),
      });
      if (res.ok) {
        toast.success("Movimiento actualizado");
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
      const res = await deleteProjectMovementAction({
        paymentId: payment.id,
        projectId,
        note: deleteNote.trim(),
      });
      if (res.ok) {
        toast.success("Movimiento eliminado");
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
        title="Editar movimiento"
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
        title="Eliminar movimiento"
      >
        <Trash2 className="size-3.5" />
      </button>

      {/* Editar */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar movimiento</SheetTitle>
            <SheetDescription>
              {payment.movement_type === "income" ? "Ingreso" : "Egreso"} · el saldo se recalcula
              automáticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {isExpense && (
              <div className="grid gap-2">
                <Label htmlFor="edit-area">Área interna</Label>
                <Select
                  value={internalArea}
                  onValueChange={(v) => setInternalArea(v ?? "")}
                  items={Object.entries(PROJECT_SLICE_LABELS).map(([value, label]) => ({ label, value }))}
                >
                  <SelectTrigger id="edit-area" className="w-full" aria-invalid={!!errors.internalArea}>
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
                {errors.internalArea && <p className="text-xs text-destructive">{errors.internalArea}</p>}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="edit-concept">Concepto</Label>
              <Input
                id="edit-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                aria-invalid={!!errors.concept}
              />
              {errors.concept && <p className="text-xs text-destructive">{errors.concept}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-amount">Monto</Label>
              <Input
                id="edit-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-method">Forma de pago</Label>
              <Select
                value={methodId}
                onValueChange={(v) => setMethodId(v ?? "")}
                items={methods.map((m) => ({ label: m.name, value: m.id }))}
              >
                <SelectTrigger id="edit-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
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
              <Label htmlFor="edit-date">Fecha</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                max={todayISODate()}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.paymentDate}
              />
              {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-note">Motivo del cambio</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Explica por qué editas este movimiento (queda en auditoría)…"
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

      {/* Eliminar */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
            <DialogDescription>
              Esta acción desactiva el movimiento y recalcula el saldo. Escribe el motivo: quedará
              registrado en auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="del-note">Motivo de la eliminación</Label>
            <Textarea
              id="del-note"
              value={deleteNote}
              onChange={(e) => setDeleteNote(e.target.value)}
              placeholder="Ej. Movimiento duplicado / monto incorrecto…"
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
