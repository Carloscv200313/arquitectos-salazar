import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listClients } from "@/lib/data/projects";
import { WorkForm } from "@/components/works/work-form";

export const metadata = { title: "Nueva obra" };

export default async function NewWorkPage() {
  const clients = await listClients();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/obras"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Obras
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva obra</h1>
        <p className="text-sm text-muted-foreground">
          Registra una obra asociada a un cliente.
        </p>
      </div>

      <WorkForm clients={clients} />
    </div>
  );
}
