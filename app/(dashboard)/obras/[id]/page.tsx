import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, User, MapPin } from "lucide-react";
import {
  getWork,
  getWorkAdministrationUtilities,
  getWorkCategorySummary,
  listWorkMovements,
} from "@/lib/data/works";
import { listPaymentMethods } from "@/lib/data/projects";
import { listProviderNames, listWorkCategoryNames } from "@/services/config.service";
import {
  WorkFinanceOverview,
} from "@/components/works/work-detail";
import { WorkCategorySummaryTable } from "@/components/works/work-category-summary-table";
import { WorkMovementsTable } from "@/components/works/work-movements-table";
import { WorkDetailActions } from "@/components/works/work-detail-actions";
import { WorkStatusBadge } from "@/components/works/work-status-badge";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const work = await getWork(id);
  return { title: work?.name ?? "Obra" };
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [work, movements, categorySummary, administrationUtilities, methods, providers, categories] =
    await Promise.all([
      getWork(id),
      listWorkMovements(id),
      getWorkCategorySummary(id),
      getWorkAdministrationUtilities(id),
      listPaymentMethods(),
      listProviderNames(),
      listWorkCategoryNames(),
    ]);
  if (!work) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/obras"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Obras
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{work.name}</h1>
            <WorkStatusBadge status={work.status} balance={work.finance.balance} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" /> {work.client.name}
            </span>
            {work.address?.trim() && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {work.address}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Creado {formatDate(work.created_at)}
            </span>
          </div>
          {work.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {work.description}
            </p>
          )}
        </div>
        <WorkDetailActions workId={work.id} workName={work.name} methods={methods} providers={providers} categories={categories} />
      </div>

      <WorkFinanceOverview
        finance={work.finance}
        administrationUtilities={administrationUtilities}
      />
      <WorkCategorySummaryTable
        workId={work.id}
        workName={work.name}
        clientName={work.client.name}
        initialFiles={work.files}
        rows={categorySummary}
      />
      <WorkMovementsTable
        movements={movements}
        workId={work.id}
        workName={work.name}
        clientName={work.client.name}
        methods={methods}
        providers={providers}
        categories={categories}
      />
    </div>
  );
}
