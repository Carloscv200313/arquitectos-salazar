import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WORK_STATUS_LABELS } from "@/lib/constants";
import type { WorkStatus } from "@/lib/types";

export function WorkStatusBadge({
  status,
  balance = 0,
}: {
  status: WorkStatus;
  balance?: number;
}) {
  const displayStatus = balance < -0.001 ? "debtor" : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        displayStatus === "active" && "border-brand/30 bg-brand-muted text-brand-foreground",
        displayStatus === "debtor" && "border-destructive/30 bg-destructive/10 text-destructive",
        displayStatus === "finished" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      )}
    >
      {WORK_STATUS_LABELS[displayStatus]}
    </Badge>
  );
}
