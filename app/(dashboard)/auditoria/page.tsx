import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/features/auth/get-user";
import { hasPermission } from "@/lib/auth/permissions";
import { listAuditLogs } from "@/lib/data/audit";
import { listPaymentMethods } from "@/lib/data/projects";
import { AuditView } from "@/components/audit/audit-view";

export const metadata = { title: "Auditoría" };

export default async function AuditPage() {
  const user = await getCurrentAppUser();
  // Solo quien tenga el permiso puede ver el log central.
  if (user && !hasPermission(user.permissions, "audit.view")) notFound();

  const [logs, methods] = await Promise.all([
    listAuditLogs({ limit: 300 }),
    listPaymentMethods(),
  ]);
  // Mapa id→nombre para mostrar la forma de pago legible en los cambios.
  const methodNames = Object.fromEntries(methods.map((m) => [m.id, m.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Registro central de todos los movimientos: creados, editados y eliminados.
        </p>
      </div>
      <AuditView logs={logs} methodNames={methodNames} />
    </div>
  );
}
