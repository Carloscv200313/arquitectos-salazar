import { ArrowDownLeft, ArrowUpRight, FolderKanban, Wallet, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardSnapshot } from "@/lib/dashboard";

export function DashboardOverviewCards({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1.2fr_0.85fr]">
      <BalanceCard snapshot={snapshot} />
      <FlowCard snapshot={snapshot} />
      <ScoreCard snapshot={snapshot} />
    </div>
  );
}

function BalanceCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card className="gap-0 border-transparent bg-brand px-5 py-5 text-brand-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-foreground/80">Balance operativo</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(snapshot.totals.net)}
          </p>
          <p className="mt-1 text-sm text-brand-foreground/70">
            {snapshot.totals.projectCount} proyecto{snapshot.totals.projectCount === 1 ? "" : "s"} ·{" "}
            {snapshot.totals.activeClients} cliente{snapshot.totals.activeClients === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-foreground/10">
          <Wallet className="size-5" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MetricPill label="Ingresos" value={formatCurrency(snapshot.totals.income)} />
        <MetricPill label="Egresos" value={formatCurrency(snapshot.totals.expense)} dark />
      </div>
    </Card>
  );
}

function FlowCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card className="gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Flujo general</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lectura consolidada de cartera, cobros y pagos internos.
          </p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <FolderKanban className="size-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <MiniStat label="Ingresos" value={formatCurrency(snapshot.totals.income)} icon={ArrowDownLeft} tone="success" />
        <MiniStat label="Egresos" value={formatCurrency(snapshot.totals.expense)} icon={ArrowUpRight} tone="danger" />
        <MiniStat label="Por cobrar" value={formatCurrency(snapshot.totals.pending)} icon={Wallet} />
      </div>
    </Card>
  );
}

function ScoreCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card className="gap-0 px-5 py-5">
      <p className="text-sm font-medium text-muted-foreground">Salud de cobro</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{snapshot.score.label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <span className="text-sm text-muted-foreground">Ingreso sobre cartera</span>
        <span className="text-2xl font-semibold tabular-nums">{snapshot.score.percent.toFixed(0)}%</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${Math.min(snapshot.score.percent, 100)}%` }}
        />
      </div>
    </Card>
  );
}

function MetricPill({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-full px-3 py-2",
        dark ? "bg-brand-foreground text-background" : "bg-background/70 text-brand-foreground",
      )}
    >
      <p className={cn("text-[11px] font-medium", dark ? "text-background/70" : "text-brand-foreground/70")}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-xl",
            tone === "success"
              ? "bg-success/15 text-success-foreground"
              : tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
