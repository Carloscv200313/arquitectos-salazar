import Link from "next/link";
import { FolderOpen, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProjectsEmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </div>
        <div>
          <p className="font-medium">Sin resultados</p>
          <p className="text-sm text-muted-foreground">
            Ningún proyecto coincide con los filtros aplicados.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-muted text-brand-foreground">
        <FolderOpen className="size-7" />
      </div>
      <div>
        <p className="text-lg font-semibold">Aún no hay proyectos</p>
        <p className="text-sm text-muted-foreground">
          Crea tu primer proyecto para empezar a gestionar montos y movimientos.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/projects/new" />}>
        <Plus className="size-4" /> Nuevo proyecto
      </Button>
    </div>
  );
}
