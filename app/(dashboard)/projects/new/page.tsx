import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listClients, listPaymentMethods } from "@/lib/data/projects";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export const metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const [clients, methods] = await Promise.all([
    listClients(),
    listPaymentMethods(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/projects"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Proyectos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
        <p className="text-sm text-muted-foreground">
          Registra el proyecto, su cliente y la distribución automática del monto.
        </p>
      </div>

      <CreateProjectForm clients={clients} methods={methods} />
    </div>
  );
}
