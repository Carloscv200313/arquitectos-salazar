"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { registerGeneralBalanceAccountMovementAction } from "@/app/(dashboard)/finance/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
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
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  GeneralBalanceAccountReport,
  GeneralBalanceMovementType,
} from "@/lib/types";

function EntryDrawer({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: GeneralBalanceAccountReport["account"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movementType, setMovementType] =
    useState<GeneralBalanceMovementType>("income");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [movementDate, setMovementDate] = useState(todayISODate());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setMovementType("income");
    setDescription("");
    setAmount("");
    setMovementDate(todayISODate());
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await registerGeneralBalanceAccountMovementAction({
        accountId: account.id,
        movementType,
        description: description.trim(),
        amount: Number(amount),
        movementDate,
      });

      if (result.ok) {
        toast.success("Registro agregado", {
          description: `${formatCurrency(Number(amount))} · ${description.trim()}`,
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
          <SheetTitle>Agregar registro</SheetTitle>
          <SheetDescription>
            Registra un ingreso o egreso directo para esta cuenta.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label>Tipo de movimiento</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={movementType === "income" ? "default" : "outline"}
                onClick={() => setMovementType("income")}
              >
                Ingreso
              </Button>
              <Button
                type="button"
                variant={movementType === "expense" ? "default" : "outline"}
                onClick={() => setMovementType("expense")}
              >
                Egreso
              </Button>
            </div>
            {errors.movementType && (
              <p className="text-xs text-destructive">{errors.movementType}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="balance-entry-description">Descripción</Label>
            <Input
              id="balance-entry-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Préstamo a bloquera"
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="balance-entry-date">Fecha</Label>
              <Input
                id="balance-entry-date"
                type="date"
                value={movementDate}
                onChange={(event) => setMovementDate(event.target.value)}
                aria-invalid={!!errors.movementDate}
              />
              {errors.movementDate && (
                <p className="text-xs text-destructive">{errors.movementDate}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="balance-entry-amount">Monto</Label>
              <MoneyInput
                id="balance-entry-amount"
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

          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Agregar registro
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function BalanceAccountDetail({
  report,
}: {
  report: GeneralBalanceAccountReport;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="border-transparent bg-brand p-5 text-brand-foreground">
            <p className="text-sm font-medium text-brand-foreground/80">Cuenta</p>
            <p className="mt-2 text-2xl font-semibold">{report.account.label}</p>
            <p className="mt-1 text-xs text-brand-foreground/70">
              {report.account.description}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Saldo actual</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatCurrency(report.account.amount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Según movimientos consolidados.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Movimientos</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {report.history.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Historial de la cuenta.
            </p>
          </Card>
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Historial de movimientos</h2>
              <p className="text-sm text-muted-foreground">
                Entradas, salidas y traspasos asociados a esta cuenta.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Nuevo registro
            </Button>
          </div>

          <div className="overflow-x-auto">
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
                {report.history.map((row) => {
                  const isExpense = row.expenseAccount === report.account.label;
                  const isIncome = row.incomeAccount === report.account.label;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="px-5 whitespace-nowrap text-muted-foreground">
                        {formatDate(row.date)}
                      </TableCell>
                      <TableCell className="font-medium">{row.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.expenseAccount}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.incomeAccount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "px-5 text-right font-semibold tabular-nums",
                          isExpense && "text-red-500",
                          isIncome && "text-emerald-700",
                        )}
                      >
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {report.history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Sin movimientos registrados para esta cuenta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <EntryDrawer
        open={open}
        onOpenChange={setOpen}
        account={report.account}
      />
    </>
  );
}
