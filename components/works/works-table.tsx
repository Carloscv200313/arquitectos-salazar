"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, History, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, WorkWithFinance } from "@/lib/types";
import { WorkStatusBadge } from "./work-status-badge";
import { RegisterWorkMovementSheet } from "./register-work-movement-sheet";
import { DeleteWorkDialog } from "./delete-work-dialog";

function amountTone(value: number, positive = true) {
  if (Math.abs(value) < 0.001) return "text-muted-foreground";
  return positive ? "text-brand-foreground" : "text-destructive";
}

export function WorksTable({
  works,
  methods,
}: {
  works: WorkWithFinance[];
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [movementTarget, setMovementTarget] = useState<WorkWithFinance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkWithFinance | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-52">Obra</TableHead>
              <TableHead className="min-w-40">Cliente</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Salidas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creación</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.map((work) => (
              <TableRow
                key={work.id}
                className="cursor-pointer"
                onClick={() => router.push(`/obras/${work.id}`)}
              >
                <TableCell>
                  <div className="font-medium">{work.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {work.finance.movementsCount} movimiento
                    {work.finance.movementsCount === 1 ? "" : "s"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{work.client.name}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", amountTone(work.finance.income))}>
                  {formatCurrency(work.finance.income)}
                </TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", amountTone(work.finance.expense, false))}>
                  {formatCurrency(work.finance.expense)}
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", work.finance.balance < 0 ? "text-destructive" : amountTone(work.finance.balance))}>
                  {formatCurrency(work.finance.balance)}
                </TableCell>
                <TableCell>
                  <WorkStatusBadge status={work.status} balance={work.finance.balance} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(work.created_at)}
                </TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 border-brand/30 bg-brand-muted text-brand-foreground hover:bg-brand hover:text-brand-foreground"
                      onClick={() => setMovementTarget(work)}
                      title="Registrar movimiento"
                    >
                      <Plus className="size-4" />
                      <span className="sr-only">Registrar movimiento</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="size-8" />}>
                        <Settings2 className="size-4" />
                        <span className="sr-only">Acciones</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => router.push(`/obras/${work.id}`)}>
                          <Eye className="size-4" /> Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/obras/${work.id}/edit`)}>
                          <Pencil className="size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/obras/${work.id}#movimientos`)}>
                          <History className="size-4" /> Historial
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(work)}>
                          <Trash2 className="size-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {movementTarget && (
        <RegisterWorkMovementSheet
          open={!!movementTarget}
          onOpenChange={(open) => !open && setMovementTarget(null)}
          workId={movementTarget.id}
          workName={movementTarget.name}
          methods={methods}
        />
      )}
      {deleteTarget && (
        <DeleteWorkDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          workId={deleteTarget.id}
          workName={deleteTarget.name}
        />
      )}
    </>
  );
}
