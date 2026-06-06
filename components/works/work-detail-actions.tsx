"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegisterWorkMovementSheet } from "./register-work-movement-sheet";
import { DeleteWorkDialog } from "./delete-work-dialog";
import type { PaymentMethod } from "@/lib/types";

export function WorkDetailActions({
  workId,
  workName,
  methods,
}: {
  workId: string;
  workName: string;
  methods: PaymentMethod[];
}) {
  const [movementOpen, setMovementOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMovementOpen(true)}>
          <Plus className="size-4" /> Registrar movimiento
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/obras/${workId}/edit`} />}
        >
          <Pencil className="size-4" /> Editar
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </div>

      <RegisterWorkMovementSheet
        open={movementOpen}
        onOpenChange={setMovementOpen}
        workId={workId}
        workName={workName}
        methods={methods}
      />
      <DeleteWorkDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workId={workId}
        workName={workName}
        redirectTo="/obras"
      />
    </>
  );
}
