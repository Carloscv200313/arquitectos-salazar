import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { PaymentStatus } from "@/lib/types";

const styles: Record<PaymentStatus, string> = {
  pending: "bg-muted text-muted-foreground ring-border",
  partial: "bg-warning/15 text-warning-foreground ring-warning/30",
  paid: "bg-success/15 text-success-foreground ring-success/30",
};

const dot: Record<PaymentStatus, string> = {
  pending: "bg-muted-foreground/50",
  partial: "bg-warning",
  paid: "bg-success",
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot[status])} />
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
