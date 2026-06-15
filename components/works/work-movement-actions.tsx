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
import type { PaymentMethod, WorkMovementWithBalance } from "@/lib/types";
import {
  editWorkMovementAction,
  deleteWorkMovementAction,
} from "@/app/(dashboard)/obras/actions";

export function WorkMovementActions({
  movement,
  workId,
  methods,
  providers,
  categories,
}: {
  movement: WorkMovementWithBalance;
  workId: string;
  methods: PaymentMethod[];
  providers: string[];
  categories: string[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isExpense = movement.movement_type === "expense";

  const [receipt, setReceipt] = useState(movement.receipt ?? "");
  const [concept, setConcept] = useState(movement.concept);
  const [supplier, setSupplier] = useState(movement.supplier ?? "");
  const [category, setCategory] = useState(movement.category ?? "");
  const [amount, setAmount] = useState(String(movement.amount));
  const [methodId, setMethodId] = useState(movement.payment_method_id);
  const [date, setDate] = useState(movement.movement_date);
  const [observations, setObservations] = useState(movement.observations ?? "");
  const [editNote, setEditNote] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  function resetEdit() {
    setReceipt(movement.receipt ?? "");
    setConcept(movement.concept);
    setSupplier(movement.supplier ?? "");
    setCategory(movement.category ?? "");
    setAmount(String(movement.amount));
    setMethodId(movement.payment_method_id);
    setDate(movement.movement_date);
    setObservations(movement.observations ?? "");
    setEditNote("");
    setErrors({});
  }

  function submitEdit() {
    setErrors({});
    startTransition(async () => {
      const res = await editWorkMovementAction({
        movementId: movement.id,
        workId,
        movementType: movement.movement_type,
        receipt: isExpense ? receipt.trim() : "",
        movementDate: date,
        concept: concept.trim(),
        supplier: isExpense ? supplier.trim() : "Cliente",
        category,
        amount: Number(amount),
        paymentMethodId: methodId,
        observations: observations.trim(),
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
      const res = await deleteWorkMovementAction({
        movementId: movement.id,
        workId,
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

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar movimiento</SheetTitle>
            <SheetDescription>
              {isExpense ? "Salida" : "Entrada"} · el saldo se recalcula automáticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {isExpense && (
              <div className="grid gap-2">
                <Label htmlFor="wm-receipt">Recibo</Label>
                <Input
                  id="wm-receipt"
                  value={receipt}
                  onChange={(e) => setReceipt(e.target.value)}
                  aria-invalid={!!errors.receipt}
                />
                {errors.receipt && <p className="text-xs text-destructive">{errors.receipt}</p>}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="wm-concept">Concepto</Label>
              <Input
                id="wm-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                aria-invalid={!!errors.concept}
              />
              {errors.concept && <p className="text-xs text-destructive">{errors.concept}</p>}
            </div>

            {isExpense && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="wm-supplier">Proveedor</Label>
                  <Select
                    value={supplier}
                    onValueChange={(v) => setSupplier(v ?? "")}
                    items={providers.map((p) => ({ label: p, value: p }))}
                  >
                    <SelectTrigger id="wm-supplier" className="w-full" aria-invalid={!!errors.supplier}>
                      <SelectValue placeholder="Selecciona proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="wm-category">Categoría</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v ?? "")}
                    items={categories.map((c) => ({ label: c, value: c }))}
                  >
                    <SelectTrigger id="wm-category" className="w-full" aria-invalid={!!errors.category}>
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="wm-amount">Monto</Label>
              <Input
                id="wm-amount"
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
              <Label htmlFor="wm-method">Forma de pago</Label>
              <Select
                value={methodId}
                onValueChange={(v) => setMethodId(v ?? "")}
                items={methods.map((m) => ({ label: m.name, value: m.id }))}
              >
                <SelectTrigger id="wm-method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
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
              <Label htmlFor="wm-date">Fecha</Label>
              <Input
                id="wm-date"
                type="date"
                value={date}
                max={todayISODate()}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.movementDate}
              />
              {errors.movementDate && <p className="text-xs text-destructive">{errors.movementDate}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wm-obs">Observaciones (opcional)</Label>
              <Textarea
                id="wm-obs"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wm-note">Motivo del cambio</Label>
              <Textarea
                id="wm-note"
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
            <Label htmlFor="wm-del-note">Motivo de la eliminación</Label>
            <Textarea
              id="wm-del-note"
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
