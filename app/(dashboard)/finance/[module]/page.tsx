import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DebtsView } from "@/components/finance/debts-view";
import { GeneralBalanceView } from "@/components/finance/general-balance-view";
import { InternalTransfersView } from "@/components/finance/internal-transfers-view";
import { SalaryView } from "@/components/finance/salary-view";
import { UtilitiesView } from "@/components/finance/utilities-view";
import { getDebtReport, getFinanceUtilityReport, getGeneralBalanceReport, getProviderDebtDetails, getSalaryReport } from "@/lib/data/finance";
import { getProjectsInternalAreaPaid, listPaymentMethods, listProjects } from "@/lib/data/projects";
import {
  getWorksPaymentMethodReport,
  listWorkInternalTransfers,
  listWorks,
} from "@/lib/data/works";
import { FINANCE_MODULES } from "@/lib/finance-modules";

export async function generateStaticParams() {
  return FINANCE_MODULES.map((item) => ({ module: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = FINANCE_MODULES.find((entry) => entry.slug === module);
  return { title: item?.title ?? "Finanzas" };
}

export default async function FinanceModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { module } = await params;
  const filters = await searchParams;
  const item = FINANCE_MODULES.find((entry) => entry.slug === module);
  if (!item) notFound();
  const Icon = item.icon;
  const [balance, debts, utilities, internalTransferData, salaryData] = await Promise.all([
    item.slug === "balance-general" ? getGeneralBalanceReport() : Promise.resolve(null),
    item.slug === "deudas"
      ? Promise.all([getDebtReport(), getProviderDebtDetails(), listPaymentMethods()])
      : Promise.resolve(null),
    item.slug === "utilidades" ? getFinanceUtilityReport() : Promise.resolve(null),
    item.slug === "movimientos-internos"
      ? Promise.all([
          listPaymentMethods(),
          getWorksPaymentMethodReport(),
          listWorkInternalTransfers(),
        ])
      : Promise.resolve(null),
    item.slug === "salario"
      ? Promise.all([
          getSalaryReport({
            year: filters.year ? Number(filters.year) : undefined,
            month: filters.month ? Number(filters.month) : undefined,
          }),
          listProjects(),
          listWorks(),
          getProjectsInternalAreaPaid(),
        ])
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-muted text-brand-foreground">
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        </div>
      </div>

      {balance ? (
        <GeneralBalanceView report={balance} />
      ) : debts ? (
        <DebtsView rows={debts[0]} providerDetails={debts[1]} />
      ) : utilities ? (
        <UtilitiesView report={utilities} />
      ) : internalTransferData ? (
        <InternalTransfersView
          methods={internalTransferData[0]}
          paymentMethodRows={internalTransferData[1]}
          transfers={internalTransferData[2]}
        />
      ) : salaryData ? (
        <SalaryView
          report={salaryData[0]}
          projectOptions={salaryData[1].map((project) => ({
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
              Propuesta: salaryData[3][project.id]?.proposal ?? 0,
              "Modelado 3D": salaryData[3][project.id]?.modeling_3d ?? 0,
              Planos: salaryData[3][project.id]?.plans ?? 0,
              Render: salaryData[3][project.id]?.render ?? 0,
            },
            assignments: [
              { employeeName: project.proposal_responsible, taskName: "Propuesta" },
              { employeeName: project.modeling_3d_responsible, taskName: "Modelado 3D" },
              { employeeName: project.plans_responsible, taskName: "Planos" },
              { employeeName: project.render_responsible, taskName: "Render" },
            ],
          }))}
          workOptions={salaryData[2].map((work) => ({
            id: work.id,
            name: work.name,
          }))}
        />
      ) : (
        <Card className="border-dashed p-8 text-center">
          <p className="font-medium">Submódulo habilitado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aquí se integrará la información específica de {item.title.toLowerCase()}.
          </p>
        </Card>
      )}
    </div>
  );
}
