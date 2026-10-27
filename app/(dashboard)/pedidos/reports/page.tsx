
import { requirePermission } from "@/lib/auth/authorize";
import { traceScreen } from "@/lib/supabase/telemetry";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderReports } from "@/components/orders/order-reports";
import { listOrderWorks } from "@/lib/data/orders";

export const metadata = { title: "Reportes de pedidos" };

export default async function OrderReportsPage() {
  const user = await requirePermission("orders.view");
  return traceScreen("orders-reports", user.id, async () => {

  const works = await listOrderWorks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/pedidos"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Pedidos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes de pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Métricas de compras: pagado, pendiente y saldo por obra y proveedor.
        </p>
      </div>

      <OrderReports works={works} />
    </div>
  );
  });
}
