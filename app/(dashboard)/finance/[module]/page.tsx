import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DebtsView } from "@/components/finance/debts-view";
import { GeneralBalanceView } from "@/components/finance/general-balance-view";
import { InternalTransfersView } from "@/components/finance/internal-transfers-view";
import { UtilitiesView } from "@/components/finance/utilities-view";
import { listPaymentMethods } from "@/lib/data/projects";
import {
  getWorksPaymentMethodReport,
  listWorkInternalTransfers,
} from "@/lib/data/works";
import {
  getDebtReport,
  getFinanceUtilityReport,
  getGeneralBalanceReport,
} from "@/lib/data/finance";
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
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = FINANCE_MODULES.find((entry) => entry.slug === module);
  if (!item) notFound();
  const Icon = item.icon;
  const [balance, debts, utilities, internalTransferData] = await Promise.all([
    item.slug === "balance-general" ? getGeneralBalanceReport() : Promise.resolve(null),
    item.slug === "deudas" ? getDebtReport() : Promise.resolve(null),
    item.slug === "utilidades" ? getFinanceUtilityReport() : Promise.resolve(null),
    item.slug === "movimientos-internos"
      ? Promise.all([
          listPaymentMethods(),
          getWorksPaymentMethodReport(),
          listWorkInternalTransfers(),
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
        <DebtsView rows={debts} />
      ) : utilities ? (
        <UtilitiesView report={utilities} />
      ) : internalTransferData ? (
        <InternalTransfersView
          methods={internalTransferData[0]}
          paymentMethodRows={internalTransferData[1]}
          transfers={internalTransferData[2]}
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
