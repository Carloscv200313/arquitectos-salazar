"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type {
  WorkAdministrationUtilityRow,
  WorkFinance,
} from "@/lib/types";

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
  accent,
  footer,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "success" | "danger";
  accent?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5", accent && "border-transparent bg-brand text-brand-foreground")}>
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
            "flex size-10 items-center justify-center rounded-xl",
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
      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  );
}

export function WorkFinanceOverview({
  finance,
  administrationUtilities,
}: {
  finance: WorkFinance;
  administrationUtilities: WorkAdministrationUtilityRow[];
}) {
  const sortedUtilities = useMemo(
    () => administrationUtilities.slice().sort((a, b) => b.month.localeCompare(a.month)),
    [administrationUtilities],
  );
  const [selectedMonth, setSelectedMonth] = useState(sortedUtilities[0]?.month ?? "");
  const selectedUtility =
    sortedUtilities.find((row) => row.month === selectedMonth) ?? sortedUtilities[0] ?? null;
  const monthItems = sortedUtilities.map((row) => ({
    label: monthLabel(row.month),
    value: row.month,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Saldo actual"
        value={formatCurrency(finance.balance)}
        hint="Disponible en la obra"
        icon={<Wallet className="size-5" />}
        accent
      />
      <Stat
        label="Entradas"
        value={formatCurrency(finance.income)}
        hint="Ingresos registrados"
        icon={<ArrowDownLeft className="size-5" />}
        tone="success"
      />
      <Stat
        label="Salidas"
        value={formatCurrency(finance.expense)}
        hint="Egresos registrados"
        icon={<ArrowUpRight className="size-5" />}
        tone="danger"
      />
      <Stat
        label="Utilidad por adm."
        value={formatCurrency(selectedUtility?.amount ?? 0)}
        hint={
          sortedUtilities.length === 0
            ? "Sin meses con honorarios"
            : `${monthLabel(selectedUtility?.month ?? selectedMonth)}`
        }
        icon={<TrendingUp className="size-5" />}
        tone="success"
        footer={
          sortedUtilities.length > 0 ? (
            <Select value={selectedUtility?.month ?? selectedMonth} onValueChange={(value) => setSelectedMonth(value ?? "")} items={monthItems}>
              <SelectTrigger size="sm" className="w-full bg-background">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {sortedUtilities.map((row) => (
                  <SelectItem key={row.month} value={row.month}>
                    {monthLabel(row.month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />
    </div>
  );
}
