import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-black/5">
        <Image
          src="/logo-salazar.svg"
          alt="Logo Arquitectos Salazar"
          width={36}
          height={36}
          className="size-full object-cover"
        />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Arquitectos</p>
        <p className="text-[11px] font-medium text-muted-foreground -mt-0.5">
          Salazar
        </p>
      </div>
    </div>
  );
}
