import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getWorksAdministrationUtilityReport,
  getWorksPaymentMethodReport,
  listWorks,
} from "@/lib/data/works";
import { WorkReports } from "@/components/works/work-reports";

export const metadata = { title: "Reportes de obras" };

export default async function WorkReportsPage() {
  const [works, paymentMethodRows, administrationUtilities] = await Promise.all([
    listWorks(),
    getWorksPaymentMethodReport(),
    getWorksAdministrationUtilityReport(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/obras"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Obras
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes de obras</h1>
        <p className="text-sm text-muted-foreground">
          Revisa saldos por forma de pago, traspasos internos y administración mensual.
        </p>
      </div>

      <WorkReports
        works={works}
        paymentMethodRows={paymentMethodRows}
        administrationUtilities={administrationUtilities}
      />
    </div>
  );
}
