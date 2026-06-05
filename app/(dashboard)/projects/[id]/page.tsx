import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CalendarDays } from "lucide-react";
import { getProject, listMovements, listPaymentMethods } from "@/lib/data/projects";
import { StatusBadge } from "@/components/projects/status-badge";
import { FinanceOverview } from "@/components/projects/finance-overview";
import { ProjectDistributionCard } from "@/components/projects/project-distribution-card";
import { PaymentHistory } from "@/components/projects/payment-history";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Proyecto" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, payments, methods] = await Promise.all([
    getProject(id),
    listMovements(id),
    listPaymentMethods(),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/projects"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Proyectos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.finance.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" /> {project.client.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Creado {formatDate(project.created_at)}
            </span>
          </div>
        </div>
        <ProjectDetailActions
          projectId={project.id}
          projectName={project.name}
          pending={project.finance.pending}
          methods={methods}
        />
      </div>

      <FinanceOverview finance={project.finance} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ProjectDistributionCard project={project} />
        <PaymentHistory payments={payments} />
      </div>
    </div>
  );
}
