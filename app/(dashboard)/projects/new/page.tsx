import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listClients, listPaymentMethods } from "@/lib/data/projects";
import { listEmployees } from "@/lib/data/finance";
import { CreateProjectWizard } from "@/components/projects/create-project-wizard";

export const metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const [clients, methods, employees] = await Promise.all([
    listClients(),
    listPaymentMethods(),
    listEmployees(),
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
          Elige una plantilla, completa los datos y confirma.
        </p>
      </div>

      <CreateProjectWizard clients={clients} methods={methods} employees={employees} />
    </div>
  );
}
