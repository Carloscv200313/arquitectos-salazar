import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderWorksList } from "@/components/orders/order-works-list";
import { listOrderWorks } from "@/lib/data/orders";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage() {
  const works = await listOrderWorks();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            Revisa pedidos por obra, proveedores y abonos pendientes.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/pedidos/reports" />}>
          <FileText className="size-4" /> Reportes
        </Button>
      </div>

      <OrderWorksList works={works} />
    </div>
  );
}
