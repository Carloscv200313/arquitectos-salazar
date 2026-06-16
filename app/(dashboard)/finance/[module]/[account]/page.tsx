import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BalanceAccountDetail } from "@/components/finance/balance-account-detail";
import { getGeneralBalanceAccountReport } from "@/lib/data/finance";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string; account: string }>;
}) {
  const { module, account } = await params;
  if (module !== "balance-general") return { title: "Finanzas" };
  const report = await getGeneralBalanceAccountReport(account);
  return { title: report?.account.label ?? "Caja y Bancos" };
}

export default async function FinanceAccountPage({
  params,
}: {
  params: Promise<{ module: string; account: string }>;
}) {
  const { module, account } = await params;
  if (module !== "balance-general") notFound();

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
