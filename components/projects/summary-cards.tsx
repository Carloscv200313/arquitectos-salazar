import { FolderKanban, Wallet, CircleCheckBig, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { round2 } from "@/lib/calculations";
import type { ProjectWithFinance } from "@/lib/types";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5",
        accent && "bg-brand text-brand-foreground border-transparent",
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
          {hint && (
            <p
              className={cn(
                "mt-1 text-xs",
                accent ? "text-brand-foreground/70" : "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
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

export function SummaryCards({ projects }: { projects: ProjectWithFinance[] }) {
  const totalCartera = round2(
    projects.reduce((s, p) => s + p.total_amount, 0),
  );
  const totalAbonado = round2(projects.reduce((s, p) => s + p.finance.income, 0));
  const totalPendiente = round2(
    projects.reduce((s, p) => s + p.finance.pending, 0),
  );
  const pct =
    totalCartera > 0 ? round2((totalAbonado / totalCartera) * 100) : 0;

  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem>
        <StatCard
          label="Cartera total"
          value={formatCurrency(totalCartera)}
          hint={`${projects.length} proyecto${projects.length === 1 ? "" : "s"}`}
          icon={Wallet}
          accent
        />
      </StaggerItem>
      <StaggerItem>
        <StatCard
          label="Proyectos"
          value={String(projects.length)}
          hint="Según filtros aplicados"
          icon={FolderKanban}
        />
      </StaggerItem>
      <StaggerItem>
        <StatCard
          label="Ingresos registrados"
          value={formatCurrency(totalAbonado)}
          hint={`${pct.toFixed(1)}% de la cartera`}
          icon={CircleCheckBig}
        />
      </StaggerItem>
      <StaggerItem>
        <StatCard
          label="Por cobrar"
          value={formatCurrency(totalPendiente)}
          hint="Pendiente de ingreso"
          icon={Clock}
        />
      </StaggerItem>
    </Stagger>
  );
}
