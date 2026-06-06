import { ArrowDownLeft, ArrowUpRight, Hammer, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { WorkWithFinance } from "@/lib/types";

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Card
      className={cn(
        "p-5",
        accent && "border-transparent bg-brand text-brand-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          <p className={cn("mt-1 text-xs", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accent
              ? "bg-brand-foreground/10"
              : tone === "success"
                ? "bg-brand-muted text-brand-foreground"
                : tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function WorksOverview({ works }: { works: WorkWithFinance[] }) {
  const income = works.reduce((sum, work) => sum + work.finance.income, 0);
  const expense = works.reduce((sum, work) => sum + work.finance.expense, 0);
  const balance = income - expense;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Saldo total"
        value={formatCurrency(balance)}
        hint={`${works.length} obra${works.length === 1 ? "" : "s"}`}
        icon={<Wallet className="size-5" />}
        accent
      />
      <StatCard
        label="Obras"
        value={String(works.length)}
        hint="Según filtros aplicados"
        icon={<Hammer className="size-5" />}
      />
      <StatCard
        label="Entradas"
        value={formatCurrency(income)}
        hint="Ingresos registrados"
        icon={<ArrowDownLeft className="size-5" />}
        tone="success"
      />
      <StatCard
        label="Salidas"
        value={formatCurrency(expense)}
        hint="Egresos registrados"
        icon={<ArrowUpRight className="size-5" />}
        tone="danger"
      />
    </div>
  );
}
