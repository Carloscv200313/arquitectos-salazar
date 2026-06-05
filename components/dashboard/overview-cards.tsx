import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardSnapshot } from "@/lib/dashboard";

export function DashboardOverviewCards({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr_0.85fr]">
      <BalanceCard snapshot={snapshot} />
      <FlowCard snapshot={snapshot} />
      <ScoreCard snapshot={snapshot} />
    </div>
  );
}

function BalanceCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { totals } = snapshot;
  return (
    <Card className="relative gap-0 overflow-hidden border-transparent bg-brand px-5 py-5 text-brand-foreground">
      <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-brand-foreground/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-brand-foreground/5" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-foreground/80">Cartera total</p>
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-foreground/15">
            <Wallet className="size-4.5" />
          </span>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(totals.portfolio)}
        </p>
        <p className="mt-1 text-sm text-brand-foreground/70">
          Balance neto {formatCurrency(totals.net)} · {totals.projectCount} proyecto
          {totals.projectCount === 1 ? "" : "s"}
        </p>

        <div className="mt-auto flex gap-2 pt-5">
          <Button
            nativeButton={false}
            render={<Link href="/projects/new" />}
            className="flex-1 bg-brand-foreground text-brand hover:bg-brand-foreground/90"
          >
            <Plus className="size-4" /> Nuevo proyecto
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/projects" />}
            className="flex-1 border-transparent bg-brand-foreground/15 text-brand-foreground hover:bg-brand-foreground/25"
          >
            Ver proyectos <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FlowCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { totals } = snapshot;
  return (
    <Card className="gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Resumen financiero</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Acumulado de movimientos</p>
        </div>
      </div>

      <div className="mt-5 grid flex-1 gap-3 sm:grid-cols-3">
        <MiniStat
          label="Ingresos"
          value={formatCurrency(totals.income)}
          icon={ArrowDownLeft}
          tone="success"
        />
        <MiniStat
          label="Egresos"
          value={formatCurrency(totals.expense)}
          icon={ArrowUpRight}
          tone="danger"
        />
        <MiniStat
          label="Por cobrar"
          value={formatCurrency(totals.pending)}
          icon={Clock3}
        />
      </div>
    </Card>
  );
}

function ScoreCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { score, totals } = snapshot;
  return (
    <Card className="gap-0 px-5 py-5">
      <p className="text-sm font-semibold">Salud de cobro</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Ingreso sobre cartera</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold tracking-tight">{score.label}</span>
        <span className="text-3xl font-semibold tabular-nums">{score.percent.toFixed(0)}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${Math.min(score.percent, 100)}%` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>Cobrado {formatCurrency(totals.income)}</span>
        <span>Meta {formatCurrency(totals.portfolio)}</span>
      </div>
    </Card>
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
    <div className="flex min-w-0 flex-col justify-between rounded-xl border bg-muted/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            tone === "success"
              ? "bg-brand-muted text-brand-foreground"
              : tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className="mt-3 whitespace-nowrap text-base font-semibold leading-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
