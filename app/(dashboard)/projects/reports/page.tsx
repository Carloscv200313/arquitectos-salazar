import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getPaymentMethodReport,
  getUtilityReport,
  listInternalTransfers,
  listPaymentMethods,
} from "@/lib/data/projects";
import { ProjectReports } from "@/components/projects/project-reports";

export const metadata = { title: "Reportes de proyectos" };

export default async function ProjectReportsPage() {
  const [methods, paymentMethodRows, utilityRows, internalTransfers] =
    await Promise.all([
      listPaymentMethods(),
      getPaymentMethodReport(),
      getUtilityReport(),
      listInternalTransfers(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/projects"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Proyectos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reportes de proyectos
        </h1>
        <p className="text-sm text-muted-foreground">
          Revisa saldos por forma de pago, traspasos internos y utilidades mensuales.
        </p>
      </div>

      <ProjectReports
        methods={methods}
        paymentMethodRows={paymentMethodRows}
        utilityRows={utilityRows}
        internalTransfers={internalTransfers}
      />
    </div>
  );
}
