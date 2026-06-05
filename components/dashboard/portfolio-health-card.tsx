import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type {
  DashboardExpenseArea,
  DashboardPendingProject,
  DashboardStatusPoint,
} from "@/lib/dashboard";

export function DashboardPortfolioHealthCard({
  status,
  pendingProjects,
  expenseAreas,
}: {
  status: DashboardStatusPoint[];
  pendingProjects: DashboardPendingProject[];
  expenseAreas: DashboardExpenseArea[];
}) {
  const totalProjects = Math.max(
    1,
    status.reduce((sum, item) => sum + item.count, 0),
  );
  const segments = [
    { value: status.find((item) => item.status === "paid")?.count ?? 0, color: "var(--brand)" },
    { value: status.find((item) => item.status === "partial")?.count ?? 0, color: "var(--warning)" },
    { value: status.find((item) => item.status === "pending")?.count ?? 0, color: "var(--chart-3)" },
  ];
  const gradient = segments.reduce((parts, segment, index) => {
    const previous = parts.offset;
    const next = previous + (segment.value / totalProjects) * 100;
    parts.stops.push(`${segment.color} ${previous}% ${next}%`);
    parts.offset = next;
    if (index === segments.length - 1 && next < 100) {
      parts.stops.push(`${segment.color} ${next}% 100%`);
    }
    return parts;
  }, { offset: 0, stops: [] as string[] }).stops.join(", ");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-0 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Estado de cartera</p>
            <p className="mt-1 text-sm text-muted-foreground">Distribución actual de proyectos por nivel de cobro.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div
            className="relative flex size-36 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="flex size-24 flex-col items-center justify-center rounded-full bg-card text-center">
              <span className="text-3xl font-semibold tracking-tight">{totalProjects}</span>
              <span className="text-xs text-muted-foreground">proyectos</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {status.map((item, index) => (
              <div key={item.status} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: segments[index]?.color ?? "#d6dae2" }}
                  />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-semibold tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Egresos por área</p>
          <div className="mt-3 space-y-3">
            {expenseAreas.slice(0, 4).map((area) => (
              <div key={area.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{area.label}</span>
                <span className="font-medium tabular-nums">{formatCurrency(area.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="gap-0 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Proyectos por cobrar</p>
            <p className="mt-1 text-sm text-muted-foreground">Casos que requieren seguimiento comercial inmediato.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {pendingProjects.length === 0 ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No hay proyectos con saldo pendiente relevante.
            </div>
          ) : (
            pendingProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{project.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{project.clientName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(project.pending)}</p>
                  <p className="text-xs text-muted-foreground">
                    Cobrado {formatCurrency(project.income)}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
