import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, WalletCards } from "lucide-react";
import { SalaryWeekDetailView } from "@/components/finance/salary-view";
import { getSalaryWeekDetailReport } from "@/lib/data/finance";
import { getProjectsInternalAreaPaid, listProjects } from "@/lib/data/projects";
import { listWorks } from "@/lib/data/works";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const report = await getSalaryWeekDetailReport(weekId);
  if (!report) return { title: "Semana de salario" };

  return {
    title: `Salario ${formatDate(report.week.week_start_date)} - ${formatDate(report.week.week_end_date)}`,
  };
}

export default async function SalaryWeekPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const [report, projects, works, areaPaid] = await Promise.all([
    getSalaryWeekDetailReport(weekId),
    listProjects(),
    listWorks(),
    getProjectsInternalAreaPaid(),
  ]);

  if (!report) notFound();

  const backHref = `/finance/salario?year=${report.week.year}&month=${report.week.month}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Salario
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-muted text-brand-foreground">
            <WalletCards className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Semana {formatDate(report.week.week_start_date)} - {formatDate(report.week.week_end_date)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Revisa actividades, pagos por cuenta y registra pagos de empleados.
            </p>
          </div>
        </div>
      </div>

      <SalaryWeekDetailView
        week={report.week}
        projectOptions={projects.map((project) => ({
          id: project.id,
          name: project.name,
          clientName: project.client.name,
          taskBudgets: {
            Propuesta: project.proposal_amount,
            "Modelado 3D": project.modeling_3d_amount,
            Planos: project.plans_amount,
            Render: project.render_amount,
          },
          taskPaid: {
            Propuesta: areaPaid[project.id]?.proposal ?? 0,
            "Modelado 3D": areaPaid[project.id]?.modeling_3d ?? 0,
            Planos: areaPaid[project.id]?.plans ?? 0,
            Render: areaPaid[project.id]?.render ?? 0,
          },
          assignments: [
            { employeeName: project.proposal_responsible, taskName: "Propuesta" },
            { employeeName: project.modeling_3d_responsible, taskName: "Modelado 3D" },
            { employeeName: project.plans_responsible, taskName: "Planos" },
            { employeeName: project.render_responsible, taskName: "Render" },
          ],
        }))}
        workOptions={works.map((work) => ({
          id: work.id,
          name: work.name,
        }))}
        taskTypes={report.taskTypes}
        taskRates={report.taskRates}
        paymentMethods={report.paymentMethods}
      />
    </div>
  );
}
