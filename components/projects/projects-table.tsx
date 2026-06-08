"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Eye,
  Plus,
  Pencil,
  Trash2,
  History,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { RegisterPaymentSheet } from "./register-payment-sheet";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, ProjectWithFinance } from "@/lib/types";

function moneyTone(value: number, intent: "positive" | "pending" = "positive") {
  if (Math.abs(value) < 0.001) return "text-muted-foreground";
  if (intent === "pending") return "text-destructive";
  return "text-brand-foreground";
}

export function ProjectsTable({
  projects,
  methods,
}: {
  projects: ProjectWithFinance[];
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [payTarget, setPayTarget] = useState<ProjectWithFinance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithFinance | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-48">Proyecto</TableHead>
              <TableHead className="min-w-40">Cliente</TableHead>
              <TableHead className="text-right">Monto proyecto</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Por cobrar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creación</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.payments_count} movimiento{p.payments_count === 1 ? "" : "s"} ·{" "}
                    {p.finance.collectionPercentage.toFixed(0)}% cobrado
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.client.name}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(p.total_amount)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    moneyTone(p.finance.income),
                  )}
                >
                  {formatCurrency(p.finance.income)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium",
                    moneyTone(p.finance.pending, "pending"),
                  )}
                >
                  {formatCurrency(p.finance.pending)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.finance.status} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDate(p.created_at)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 border-brand/30 bg-brand-muted text-brand-foreground hover:bg-brand hover:text-brand-foreground"
                      onClick={() => setPayTarget(p)}
                      title="Registrar movimiento"
                    >
                      <Plus className="size-4" />
                      <span className="sr-only">Registrar movimiento</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="outline" size="icon" className="size-8" />}
                      >
                        <Settings2 className="size-4" />
                        <span className="sr-only">Acciones</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => router.push(`/projects/${p.id}`)}>
                          <Eye className="size-4" /> Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/projects/${p.id}/edit`)}
                        >
                          <Pencil className="size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/projects/${p.id}#historial`)}
                        >
                          <History className="size-4" /> Historial de movimientos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
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

      {payTarget && (
        <RegisterPaymentSheet
          open={!!payTarget}
          onOpenChange={(o) => !o && setPayTarget(null)}
          projectId={payTarget.id}
          projectName={payTarget.name}
          pending={payTarget.finance.pending}
          methods={methods}
        />
      )}
      {deleteTarget && (
        <DeleteProjectDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
        />
      )}
    </>
  );
}
