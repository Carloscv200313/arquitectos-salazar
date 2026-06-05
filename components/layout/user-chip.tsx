import { cn } from "@/lib/utils";

export function UserChip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-sm font-semibold text-brand-foreground">
        AS
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">Administrador</p>
        <p className="truncate text-xs text-muted-foreground">Cuenta interna</p>
      </div>
    </div>
  );
}
