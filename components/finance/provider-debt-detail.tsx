"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeDollarSign, Boxes, CheckCircle2, HandCoins, Loader2 } from "lucide-react";
import { settleProviderDebtAction } from "@/app/(dashboard)/finance/actions";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
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
import type { ProviderDebtDetail } from "@/lib/types";

type SettleTarget =
  | { sourceType: "work_order"; sourceId: string; provider: string; title: string; subtitle: string; pending: number }
  | { sourceType: "work_movement"; sourceId: string; provider: string; title: string; subtitle: string; pending: number };

function pendingTone(pending: number, total: number) {
  if (total <= 0.001 || pending <= 0.001) return "text-muted-foreground";
  return Math.abs(pending - total) < 0.001 ? "text-destructive" : "text-brand-foreground";
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

function SettleProviderDebtSheet({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SettleTarget;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settlementDate, setSettlementDate] = useState(todayISODate());
  const [amount, setAmount] = useState(String(target.pending));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setSettlementDate(todayISODate());
    setAmount(String(target.pending));
    setNote("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await settleProviderDebtAction({
        provider: target.provider,
        sourceType: target.sourceType,
        sourceId: target.sourceId,
        amount: Number(amount),
        settlementDate,
        note,
      });
      if (result.ok) {
        toast.success("Deuda saldada", {
          description: `${formatCurrency(Number(amount))} · ${target.provider}`,
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
          <SheetTitle>Saldar deuda</SheetTitle>
          <SheetDescription>
            {target.title} · pendiente {formatCurrency(target.pending)}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <Card className="bg-brand-muted/50 p-4">
            <p className="font-medium">{target.subtitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">Este registro dejará de aparecer como deuda pendiente.</p>
          </Card>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-date">Fecha</Label>
            <Input
              id="settle-provider-date"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              aria-invalid={!!errors.settlementDate}
            />
            {errors.settlementDate && <p className="text-xs text-destructive">{errors.settlementDate}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-amount">Monto a saldar</Label>
            <MoneyInput
              id="settle-provider-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settle-provider-note">Nota</Label>
            <Input
              id="settle-provider-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Liquidado por administración"
              aria-invalid={!!errors.note}
            />
            {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
          </div>
          <Button onClick={submit} disabled={isPending} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Saldar deuda
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ProviderDebtDetail({
  detail,
}: {
  detail: ProviderDebtDetail;
}) {
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const pendingRowsCount = detail.orders.length + detail.workMovements.length;
  const debtRows = [
    ...detail.orders.map((order) => ({ kind: "order" as const, order })),
    ...detail.workMovements.map((movement) => ({ kind: "movement" as const, movement })),
  ].sort((a, b) => {
    const aPending = a.kind === "order" ? a.order.pending : a.movement.pending;
    const bPending = b.kind === "order" ? b.order.pending : b.movement.pending;
    if (Math.abs(bPending - aPending) > 0.001) return bPending - aPending;
    const aDate = a.kind === "order" ? a.order.order_date : a.movement.movementDate;
    const bDate = b.kind === "order" ? b.order.order_date : b.movement.movementDate;
    return bDate.localeCompare(aDate);
  });

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
            label="Registros con saldo"
            value={String(pendingRowsCount)}
            hint="Registros pendientes"
            icon={<BadgeDollarSign className="size-5" />}
          />
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Deudas del proveedor</h2>
            <p className="text-sm text-muted-foreground">
              Pedidos y egresos de obra pendientes por saldar.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="px-5">Origen</TableHead>
                  <TableHead className="px-5">Obra</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Abonado / saldado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="px-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtRows.map((row) => {
                  if (row.kind === "order") {
                    const { order } = row;
                    return (
                      <TableRow key={`order-${order.id}`}>
                        <TableCell className="px-5">
                          <span className="inline-flex rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand-foreground">
                            Pedido
                          </span>
                        </TableCell>
                        <TableCell className="px-5">
                          <div className="font-medium">{order.work.name}</div>
                          <div className="text-xs text-muted-foreground">{order.work.client.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="line-clamp-2">{order.material}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{order.category || "-"}</TableCell>
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
                            className="bg-brand text-brand-foreground hover:bg-brand/90"
                            disabled={order.pending <= 0.001}
                            onClick={() =>
                              setSettleTarget({
                                sourceType: "work_order",
                                sourceId: order.id,
                                provider: detail.provider,
                                title: order.material,
                                subtitle: `${order.work.name} · ${order.work.client.name}`,
                                pending: order.pending,
                              })
                            }
                          >
                            <CheckCircle2 className="size-4" />
                            Saldar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const { movement } = row;
                  return (
                    <TableRow key={`movement-${movement.id}`}>
                      <TableCell className="px-5">
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          Obra
                        </span>
                      </TableCell>
                      <TableCell className="px-5">
                        <div className="font-medium">{movement.workName}</div>
                        <div className="text-xs text-muted-foreground">{movement.clientName}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(movement.movementDate)}</TableCell>
                      <TableCell className="max-w-sm">
                        <div className="line-clamp-2">{movement.concept}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{movement.category || "-"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(movement.amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-brand-foreground">
                        {formatCurrency(movement.settled)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-destructive">
                        {formatCurrency(movement.pending)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-destructive">
                          Por pagar
                        </span>
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        <Button
                          size="sm"
                          className="bg-brand text-brand-foreground hover:bg-brand/90"
                          disabled={movement.pending <= 0.001}
                          onClick={() =>
                            setSettleTarget({
                              sourceType: "work_movement",
                              sourceId: movement.id,
                              provider: detail.provider,
                              title: movement.concept,
                              subtitle: `${movement.workName} · ${movement.category || "Egreso de obra"}`,
                              pending: movement.pending,
                            })
                          }
                        >
                          <CheckCircle2 className="size-4" />
                          Saldar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {debtRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center text-muted-foreground">
                      Sin deudas pendientes para este proveedor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>

      {settleTarget && (
        <SettleProviderDebtSheet
          open={!!settleTarget}
          onOpenChange={(next) => !next && setSettleTarget(null)}
          target={settleTarget}
        />
      )}
    </>
  );
}
