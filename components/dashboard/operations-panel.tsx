import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DashboardInsight } from "@/lib/dashboard";

export function DashboardOperationsPanel({
  insights,
}: {
  insights: DashboardInsight[];
}) {
  return (
    <Card className="gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Panel operativo</p>
          <p className="mt-1 text-sm text-muted-foreground">Prioridades sugeridas a partir del estado actual de la cartera.</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-full bg-brand-muted text-brand-foreground">
          <Bot className="size-5" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-muted/15 px-5 py-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand-foreground">
          <Sparkles className="size-6" />
        </div>
        <p className="mt-4 text-lg font-semibold tracking-tight">Que revisar hoy</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tres focos concretos para mantener la cobranza y la ejecución interna bajo control.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {insights.map((insight) => (
          <Link
            key={insight.title}
            href={insight.href}
            className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/35"
          >
            <div>
              <p className="font-medium text-foreground">{insight.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
            </div>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
