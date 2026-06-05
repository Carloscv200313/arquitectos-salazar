import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DashboardInsight } from "@/lib/dashboard";

export function DashboardOperationsPanel({
  insights,
}: {
  insights: DashboardInsight[];
}) {
  return (
    <Card className="flex h-full flex-col gap-0 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Prioridades</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Qué revisar hoy según el estado de la cartera
          </p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-brand-muted text-brand-foreground">
          <Sparkles className="size-4.5" />
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-2.5">
        {insights.map((insight, i) => (
          <Link
            key={insight.title}
            href={insight.href}
            className="group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-xs font-semibold text-brand-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{insight.detail}</p>
            </div>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
