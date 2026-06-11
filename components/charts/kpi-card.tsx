import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "./charts";

export interface KpiDelta {
  value: number; // percentage, signed
  label?: string;
  goodWhenUp?: boolean; // default true
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  delta,
  spark,
  sparkColor,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
  delta?: KpiDelta;
  spark?: number[];
  sparkColor?: string;
}) {
  const up = (delta?.value ?? 0) >= 0;
  const goodWhenUp = delta?.goodWhenUp ?? true;
  const positive = up === goodWhenUp;

  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden p-5",
        accent && "border-transparent bg-brand text-brand-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight">{value}</p>
          {hint ? (
            <p className={cn("mt-1 text-xs", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>
              {hint}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              accent ? "bg-brand-foreground/10" : "bg-brand-muted text-brand-foreground",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              accent
                ? "bg-brand-foreground/10 text-brand-foreground"
                : positive
                  ? "bg-success/15 text-success-foreground"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta.value).toFixed(1)}%
            {delta.label ? <span className="font-normal opacity-80">· {delta.label}</span> : null}
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 1 ? (
          <div className="w-24">
            <Sparkline values={spark} color={accent ? "#1a2e05" : sparkColor ?? "#84cc16"} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
