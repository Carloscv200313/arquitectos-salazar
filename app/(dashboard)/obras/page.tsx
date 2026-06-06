import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listWorks, type WorkFilters } from "@/lib/data/works";
import { listPaymentMethods } from "@/lib/data/projects";
import { WorksOverview } from "@/components/works/works-overview";
import { WorksTable } from "@/components/works/works-table";
import { WORK_STATUS_LABELS, WORK_STATUSES } from "@/lib/constants";
import type { WorkStatus } from "@/lib/types";

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
  const status = (sp.status as WorkStatus | "all" | undefined) ?? "all";
  const filters: WorkFilters = {
    search: sp.search,
    client: sp.client,
    status,
  };
  const [works, methods] = await Promise.all([
    listWorks(filters),
    listPaymentMethods(),
  ]);
  const statusItems = [
    { label: "Todos los estados", value: "all" },
    ...WORK_STATUSES.map((item) => ({ label: WORK_STATUS_LABELS[item], value: item })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
          <p className="text-sm text-muted-foreground">
            Controla entradas, salidas y saldos de cada obra.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/obras/new" />}>
          <Plus className="size-4" /> Nueva obra
        </Button>
      </div>

      <WorksOverview works={works} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <form className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_180px]">
              <Input name="search" placeholder="Buscar obra..." defaultValue={sp.search ?? ""} />
              <Input name="client" placeholder="Cliente..." defaultValue={sp.client ?? ""} />
              <select
                name="status"
                defaultValue={status}
                className="h-8 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {statusItems.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" type="submit">
              Filtrar
            </Button>
          </form>
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
