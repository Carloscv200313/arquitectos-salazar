import {
  Wallet,
  ArrowDownLeft,
  Clock3,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectFinance } from "@/lib/types";

export function FinanceOverview({ finance }: { finance: ProjectFinance }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monto del proyecto"
          value={formatCurrency(finance.total)}
          hint="Total a cobrar del cliente"
          icon={Wallet}
          accent
        />
        <StatCard
          label="Ingresos"
          value={formatCurrency(finance.income)}
          hint="Cobros registrados"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="Por cobrar"
          value={formatCurrency(finance.pending)}
          hint="Pendiente de ingreso"
          icon={Clock3}
        />
        <StatCard
          label="Egresos internos"
          value={formatCurrency(finance.expense)}
          hint="Pagos del proyecto"
          icon={ArrowUpRight}
        />
      </div>

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Avance de cobro</span>
          <span className="font-medium tabular-nums">
            {finance.collectionPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${Math.min(finance.collectionPercentage, 100)}%` }}
          />
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 p-5",
        accent && "border-transparent bg-brand text-brand-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              accent ? "text-brand-foreground/80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p
            className={cn(
              "mt-1 text-xs",
              accent ? "text-brand-foreground/70" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accent ? "bg-brand-foreground/10" : "bg-muted",
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
