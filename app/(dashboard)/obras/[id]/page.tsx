import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, User } from "lucide-react";
import {
  getWork,
  getWorkAdministrationUtilities,
  getWorkCategorySummary,
  listWorkMovements,
} from "@/lib/data/works";
import { listPaymentMethods } from "@/lib/data/projects";
import {
  WorkCategorySummaryTable,
  WorkFinanceOverview,
  WorkAdministrationUtilityTable,
  WorkMovementsTable,
} from "@/components/works/work-detail";
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
  const [work, movements, categorySummary, administrationUtilities, methods] = await Promise.all([
    getWork(id),
    listWorkMovements(id),
    getWorkCategorySummary(id),
    getWorkAdministrationUtilities(id),
    listPaymentMethods(),
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
            <WorkStatusBadge status={work.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" /> {work.client.name}
            </span>
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
        <WorkDetailActions workId={work.id} workName={work.name} methods={methods} />
      </div>

      <WorkFinanceOverview finance={work.finance} />
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <WorkCategorySummaryTable rows={categorySummary} />
        <WorkAdministrationUtilityTable rows={administrationUtilities} />
      </div>
      <WorkMovementsTable movements={movements} />
    </div>
  );
}
