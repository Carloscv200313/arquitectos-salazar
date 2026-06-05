import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProject, listClients } from "@/lib/data/projects";
import { EditProjectForm } from "@/components/projects/edit-project-form";

export const metadata = { title: "Editar proyecto" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients] = await Promise.all([getProject(id), listClients()]);
  if (!project) notFound();

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
      <EditProjectForm project={project} clients={clients} />
    </div>
  );
}
