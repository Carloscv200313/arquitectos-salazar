import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  action,
  legend,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden rounded-2xl p-0", className)}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-5">
        {legend ? <div className="mb-4">{legend}</div> : null}
        {children}
      </div>
    </Card>
  );
}
