"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

export function UserChip({
  className,
  name = "Administrador",
  subtitle = "Cuenta interna",
}: {
  className?: string;
  name?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-sm font-semibold text-brand-foreground">
          {initials(name)}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
