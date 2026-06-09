import { OrderWorksList } from "@/components/orders/order-works-list";
import { listOrderWorks } from "@/lib/data/orders";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage() {
  const works = await listOrderWorks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">
          Revisa pedidos por obra, proveedores y abonos pendientes.
        </p>
      </div>

      <OrderWorksList works={works} />
    </div>
  );
}
