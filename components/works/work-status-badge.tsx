import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WORK_STATUS_LABELS } from "@/lib/constants";
import type { WorkStatus } from "@/lib/types";

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "active" && "border-brand/30 bg-brand-muted text-brand-foreground",
        status === "paused" && "border-warning/30 bg-warning/10 text-warning-foreground",
        status === "finished" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      )}
    >
      {WORK_STATUS_LABELS[status]}
    </Badge>
  );
}
