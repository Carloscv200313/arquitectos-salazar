import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WorkOrdersView } from "@/components/orders/work-orders-view";
import { Button } from "@/components/ui/button";
import { listPaymentMethods } from "@/lib/data/projects";
import { listWorkOrders } from "@/lib/data/orders";
import { getWork } from "@/lib/data/works";
import { listProviderNames, listWorkCategoryNames } from "@/services/config.service";

export const metadata = { title: "Pedidos de obra" };

export default async function WorkOrdersPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const [work, orders, methods, providers, categories] = await Promise.all([
    getWork(workId),
    listWorkOrders(workId),
    listPaymentMethods(),
    listProviderNames(),
    listWorkCategoryNames(),
  ]);

  if (!work) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          nativeButton={false}
          render={<Link href="/pedidos" />}
        >
          <ArrowLeft className="size-4" /> Pedidos
        </Button>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold tracking-tight">{work.name}</h1>
          <p className="text-muted-foreground">
            Pedidos, montos acordados y abonos a proveedores.
          </p>
        </div>
      </div>

      <WorkOrdersView work={work} orders={orders} methods={methods} providers={providers} categories={categories} />
    </div>
  );
}
