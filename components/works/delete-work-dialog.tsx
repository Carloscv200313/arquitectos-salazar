"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteWorkAction } from "@/app/(dashboard)/obras/actions";

export function DeleteWorkDialog({
  open,
  onOpenChange,
  workId,
  workName,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workId: string;
  workName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteWorkAction(workId);
      if (result.ok) {
        toast.success("Obra eliminada", { description: workName });
        onOpenChange(false);
        if (redirectTo) router.push(redirectTo);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar obra</DialogTitle>
          <DialogDescription>
            Esta acción eliminará la obra y todos sus movimientos registrados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remove} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
