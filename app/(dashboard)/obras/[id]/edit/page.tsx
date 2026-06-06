import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listClients } from "@/lib/data/projects";
import { getWork } from "@/lib/data/works";
import { WorkForm } from "@/components/works/work-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const work = await getWork(id);
  return { title: work ? `Editar ${work.name}` : "Editar obra" };
}

export default async function EditWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
