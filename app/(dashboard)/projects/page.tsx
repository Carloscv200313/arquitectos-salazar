import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listProjects, listPaymentMethods, type ProjectFilters } from "@/lib/data/projects";
import { SummaryCards } from "@/components/projects/summary-cards";
import { ProjectsFilters } from "@/components/projects/projects-filters";
import { ProjectsTable } from "@/components/projects/projects-table";
import { ProjectsEmptyState } from "@/components/projects/empty-state";
import { ExportButton, type ExportRow } from "@/components/projects/export-button";
import { FadeIn } from "@/components/motion/fade-in";
import { formatDate } from "@/lib/format";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { PaymentStatus } from "@/lib/types";

export const metadata = { title: "Proyectos" };

type SearchParams = Promise<{
  search?: string;
  client?: string;
  status?: string;
  from?: string;
  to?: string;
}>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = (sp.status as PaymentStatus | "all" | undefined) ?? "all";
  const filters: ProjectFilters = {
    search: sp.search,
    client: sp.client,
    status,
    dateFrom: sp.from,
    dateTo: sp.to,
  };

  const [projects, methods] = await Promise.all([
    listProjects(filters),
    listPaymentMethods(),
  ]);

  const hasFilters = !!(sp.search || sp.client || (sp.status && sp.status !== "all") || sp.from || sp.to);

  const exportRows: ExportRow[] = projects.map((p) => ({
    proyecto: p.name,
    cliente: p.client.name,
    montoTotal: p.total_amount,
    montoProyecto: p.project_amount,
    ingresos: p.finance.income,
    egresos: p.finance.expense,
    porCobrar: p.finance.pending,
    estado: PAYMENT_STATUS_LABELS[p.finance.status],
    fechaCreacion: formatDate(p.created_at),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona montos, movimientos e hitos internos de cada proyecto.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/projects/new" />}>
          <Plus className="size-4" /> Nuevo proyecto
        </Button>
      </div>

      <SummaryCards projects={projects} />

      <FadeIn delay={0.1}>
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Suspense fallback={<div className="h-10 flex-1" />}>
                <ProjectsFilters />
              </Suspense>
              <ExportButton rows={exportRows} />
            </div>
            {projects.length === 0 ? (
              <ProjectsEmptyState filtered={hasFilters} />
            ) : (
              <ProjectsTable projects={projects} methods={methods} />
            )}
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
