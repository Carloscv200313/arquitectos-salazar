"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegisterPaymentSheet } from "./register-payment-sheet";
import { DeleteProjectDialog } from "./delete-project-dialog";
import type { PaymentMethod } from "@/lib/types";

export function ProjectDetailActions({
  projectId,
  projectName,
  pending,
  methods,
}: {
  projectId: string;
  projectName: string;
  pending: number;
  methods: PaymentMethod[];
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPayOpen(true)}>
          <Plus className="size-4" /> Registrar movimiento
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/projects/${projectId}/edit`} />}
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

      <RegisterPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        projectId={projectId}
        projectName={projectName}
        pending={pending}
        methods={methods}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={projectId}
        projectName={projectName}
        redirectTo="/projects"
      />
    </>
  );
}
