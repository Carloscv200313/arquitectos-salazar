import { Suspense } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listWorks, type WorkFilters } from "@/lib/data/works";
import { listPaymentMethods } from "@/lib/data/projects";
import { WorksOverview } from "@/components/works/works-overview";
import { WorksTable } from "@/components/works/works-table";
import { WorksFilters } from "@/components/works/works-filters";
import type { WorkFilterStatus } from "@/lib/types";

export const metadata = { title: "Obras" };

type SearchParams = Promise<{
  search?: string;
  client?: string;
  status?: string;
}>;

export default async function WorksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = (sp.status as WorkFilterStatus | "all" | undefined) ?? "all";
  const filters: WorkFilters = {
    search: sp.search,
    client: sp.client,
    status,
  };
  const [works, methods] = await Promise.all([
    listWorks(filters),
    listPaymentMethods(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
          <p className="text-sm text-muted-foreground">
            Controla entradas, salidas y saldos de cada obra.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/obras/reports" />}
          >
            <FileText className="size-4" /> Reportes
          </Button>
          <Button nativeButton={false} render={<Link href="/obras/new" />}>
            <Plus className="size-4" /> Nueva obra
          </Button>
        </div>
      </div>

      <WorksOverview works={works} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <Suspense fallback={<div className="h-8" />}>
            <WorksFilters />
          </Suspense>
          {works.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay obras para mostrar.
            </div>
          ) : (
            <WorksTable works={works} methods={methods} />
          )}
        </div>
      </Card>
    </div>
  );
}
