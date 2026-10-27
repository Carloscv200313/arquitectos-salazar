
import { requirePermission } from "@/lib/auth/authorize";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listClients } from "@/lib/data/projects";
import { getWork, getWorkName } from "@/lib/data/works";
import { WorkForm } from "@/components/works/work-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("works.view");

  const { id } = await params;
  const name = await getWorkName(id);
  return { title: name ? `Editar ${name}` : "Editar obra" };
}

export default async function EditWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("works.view");

  const { id } = await params;
  const [clients, work] = await Promise.all([listClients(), getWork(id)]);
  if (!work) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/obras/${work.id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {work.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar obra</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza la información general de la obra.
        </p>
      </div>

      <WorkForm clients={clients} work={work} />
    </div>
  );
}
