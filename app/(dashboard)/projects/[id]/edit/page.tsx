import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProject, listClients, listMovements } from "@/lib/data/projects";
import { round2 } from "@/lib/calculations";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import type { InternalArea } from "@/lib/types";

export const metadata = { title: "Editar proyecto" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients, payments] = await Promise.all([
    getProject(id),
    listClients(),
    listMovements(id),
  ]);
  if (!project) notFound();

  const paidByArea = payments.reduce<Record<InternalArea, number>>(
    (acc, p) => {
      if (p.movement_type !== "expense" || !p.internal_area) return acc;
      acc[p.internal_area] = round2(acc[p.internal_area] + p.amount);
      return acc;
    },
    { proposal: 0, modeling_3d: 0, plans: 0, render: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar proyecto</h1>
      </div>
      <EditProjectForm project={project} clients={clients} paidByArea={paidByArea} />
    </div>
  );
}
