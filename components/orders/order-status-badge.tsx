import { Badge } from "@/components/ui/badge";
import type { WorkOrderStatus } from "@/lib/types";

const LABELS: Record<WorkOrderStatus, string> = {
  pending_quote: "Sin monto",
  quoted: "Por pagar",
  partial: "Abono parcial",
  paid: "Pagado",
};

export function OrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const className =
    status === "paid"
      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : status === "partial"
        ? "border-brand/30 bg-brand-muted text-brand-foreground"
        : status === "pending_quote"
          ? "bg-muted text-muted-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive";

  return <Badge variant="outline" className={className}>{LABELS[status]}</Badge>;
}
