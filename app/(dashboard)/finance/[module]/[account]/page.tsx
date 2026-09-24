import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BalanceAccountDetail } from "@/components/finance/balance-account-detail";
import { DebtorDebtDetail } from "@/components/finance/debtor-debt-detail";
import { ProviderDebtDetail } from "@/components/finance/provider-debt-detail";
import {
  getGeneralBalanceAccountReport,
  getManualDebtorDetail,
  getProviderDebtDetail,
} from "@/lib/data/finance";
import { listPaymentMethods } from "@/lib/data/projects";

function debtorIdFromAccountParam(account: string) {
  return account.startsWith("deudor-") ? account.slice("deudor-".length) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string; account: string }>;
}) {
  const { module, account } = await params;
  if (module === "balance-general") {
    const report = await getGeneralBalanceAccountReport(account);
    return { title: report?.account.label ?? "Caja y Bancos" };
  }
  if (module === "deudas") {
    const debtorId = debtorIdFromAccountParam(account);
    if (debtorId) {
      const detail = await getManualDebtorDetail(debtorId);
      return { title: detail?.debtor.name ?? "Deudor" };
    }
    const detail = await getProviderDebtDetail(account);
    return { title: detail?.provider ?? "Proveedor" };
  }
  return { title: "Finanzas" };
}

export default async function FinanceAccountPage({
  params,
}: {
  params: Promise<{ module: string; account: string }>;
}) {
  const { module, account } = await params;
  if (module === "balance-general") {
    const report = await getGeneralBalanceAccountReport(account);
    if (!report) notFound();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/finance/balance-general"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Caja y Bancos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {report.account.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            Historial de movimientos de la cuenta.
          </p>
        </div>

        <BalanceAccountDetail report={report} />
      </div>
    );
  }

  if (module === "deudas") {
    const debtorId = debtorIdFromAccountParam(account);
    if (debtorId) {
      const [detail, accounts] = await Promise.all([
        getManualDebtorDetail(debtorId),
        listPaymentMethods(),
      ]);
      if (!detail) notFound();

      return (
        <div className="flex flex-col gap-6">
          <div>
            <Link
              href="/finance/deudas"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Deudas
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{detail.debtor.name}</h1>
            <p className="text-sm text-muted-foreground">
              Flujo de cobranza, cuenta del préstamo y abonos registrados.
            </p>
          </div>

          <DebtorDebtDetail detail={detail} accounts={accounts} />
        </div>
      );
    }

    const detail = await getProviderDebtDetail(account);
    if (!detail) notFound();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/finance/deudas"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Deudas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.provider}</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos pendientes, abonos e historial del proveedor.
          </p>
        </div>

        <ProviderDebtDetail detail={detail} />
      </div>
    );
  }

  notFound();
}
